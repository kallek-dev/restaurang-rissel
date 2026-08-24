"use client";

import { useEffect, useState } from "react";
import SettingsTab, { Settings } from "./SettingsTab";
import BookingsTab, { Booking } from "./BookingsTab";
import RequestsTab, { GroupRequest } from "./RequestsTab";
import StatisticsTab from "./StatisticsTab";
import ManualBookingModal, { ManualBookingPrefill } from "./ManualBookingModal";
import EditRequestModal from "./EditRequestModal";

type Tab = "bookings" | "requests" | "statistics" | "settings";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("bookings");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<ManualBookingPrefill | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [editingRequest, setEditingRequest] = useState<GroupRequest | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadSettings();
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 60000); // pollar varje minut
    return () => clearInterval(interval);
  }, []);

  function loadSettings() {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }

  function loadPendingCount() {
    fetch("/api/admin/group-requests/pending-count")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.count ?? 0))
      .catch(() => {});
  }

  async function saveSettings(patch: Partial<Settings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } finally {
      setSavingSettings(false);
    }
  }

  function openNewBooking(date?: string) {
    setEditingBooking(null);
    setModalPrefill(date ? { date } : null);
    setModalOpen(true);
  }

  function openEditBooking(booking: Booking) {
    setEditingBooking(booking);
    setModalPrefill(null);
    setModalOpen(true);
  }

  function openBookIn(request: GroupRequest) {
    setEditingBooking(null);
    setModalPrefill({
      date: request.date,
      name: request.name,
      email: request.email,
      phone: request.phone,
      partySize: request.partySize,
      message: request.message,
      groupRequestId: request.id,
    });
    setModalOpen(true);
  }

  // Redigera en förfrågan: om den redan är kopplad till en riktig
  // bokning, öppna DEN (samma data lever bara på ett ställe) — annars
  // redigera förfrågans egna fält.
  async function openEditRequest(request: GroupRequest) {
    if (request.linkedBookingId) {
      const res = await fetch(`/api/admin/bookings/${request.linkedBookingId}`);
      if (res.ok) {
        const booking = await res.json();
        openEditBooking(booking);
        return;
      }
    }
    setEditingRequest(request);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingBooking(null);
  }

  function handleBooked() {
    setRefreshKey((k) => k + 1);
    loadPendingCount();
  }

  function handleRequestSaved() {
    setRefreshKey((k) => k + 1);
  }

  if (!settings) {
    return <p className="text-sage font-mono text-sm">Laddar inställningar…</p>;
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "bookings", label: "Bokningar" },
    { id: "requests", label: "Förfrågningar" },
    { id: "statistics", label: "Statistik" },
    { id: "settings", label: "Inställningar" },
  ];

  return (
    <div>
      <nav className="flex gap-1 border-b border-ink/10 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "px-4 py-2 text-sm font-display uppercase tracking-wide border-b-2 -mb-px transition-colors flex items-center gap-1.5",
              tab === t.id
                ? "border-ink text-ink"
                : "border-transparent text-sage hover:text-ink",
            ].join(" ")}
          >
            {t.label}
            {t.id === "requests" && pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brick text-white text-[10px] font-mono">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === "bookings" && (
        <BookingsTab
          key={`bookings-${refreshKey}`}
          settings={settings}
          onNewBooking={openNewBooking}
          onEditBooking={openEditBooking}
        />
      )}
      {tab === "requests" && (
        <RequestsTab
          key={`requests-${refreshKey}`}
          onBookIn={openBookIn}
          onEditRequest={openEditRequest}
        />
      )}
      {tab === "statistics" && <StatisticsTab key={`stats-${refreshKey}`} />}
      {tab === "settings" && (
        <SettingsTab
          settings={settings}
          saveSettings={saveSettings}
          saving={savingSettings}
          saved={settingsSaved}
        />
      )}

      {modalOpen && (
        <ManualBookingModal
          settings={settings}
          prefill={modalPrefill}
          editingBooking={editingBooking}
          onClose={closeModal}
          onBooked={handleBooked}
        />
      )}

      {editingRequest && (
        <EditRequestModal
          request={editingRequest}
          sittings={settings.sittings}
          onClose={() => setEditingRequest(null)}
          onSaved={handleRequestSaved}
        />
      )}
    </div>
  );
}

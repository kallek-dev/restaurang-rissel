"use client";

import { useEffect, useState } from "react";
import SettingsTab, { Settings } from "./SettingsTab";
import TodayTab from "./TodayTab";
import BookingsTab, { Booking } from "./BookingsTab";
import RequestsTab from "./RequestsTab";
import ManualBookingModal, { ManualBookingPrefill } from "./ManualBookingModal";

type GroupRequest = {
  id: string;
  date: string;
  sitting: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  message: string;
};

type Tab = "today" | "bookings" | "requests" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Idag" },
  { id: "bookings", label: "Bokningar" },
  { id: "requests", label: "Förfrågningar" },
  { id: "settings", label: "Inställningar" },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("today");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<ManualBookingPrefill | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadSettings();
  }, []);

  function loadSettings() {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
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

  function closeModal() {
    setModalOpen(false);
    setEditingBooking(null);
  }

  function handleBooked() {
    setRefreshKey((k) => k + 1);
  }

  if (!settings) {
    return <p className="text-sage font-mono text-sm">Laddar inställningar…</p>;
  }

  return (
    <div>
      <nav className="flex gap-1 border-b border-ink/10 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "px-4 py-2 text-sm font-display uppercase tracking-wide border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-ink text-ink"
                : "border-transparent text-sage hover:text-ink",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "today" && (
        <TodayTab
          key={`today-${refreshKey}`}
          settings={settings}
          onNewBooking={openNewBooking}
          onEditBooking={openEditBooking}
        />
      )}
      {tab === "bookings" && (
        <BookingsTab
          key={`bookings-${refreshKey}`}
          settings={settings}
          onNewBooking={openNewBooking}
          onEditBooking={openEditBooking}
        />
      )}
      {tab === "requests" && (
        <RequestsTab key={`requests-${refreshKey}`} onBookIn={openBookIn} />
      )}
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
    </div>
  );
}

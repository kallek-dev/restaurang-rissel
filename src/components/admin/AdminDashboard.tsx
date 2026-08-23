"use client";

import { useEffect, useState } from "react";

type TableType = {
  id: string;
  label: string;
  seats: number;
  minPeople: number;
  count: number;
};

type Settings = {
  id: number;
  systemOpen: boolean;
  openDays: number[];
  sittings: string[];
  sittingWindowMinutes: number;
  slotIntervalMinutes: number;
  maxTablesPerSlot: number;
  maxPartiesPerSlot: number;
  tableTypes: TableType[];
  maxOnlinePartySize: number;
  contactEmail: string;
  retentionMonths: number;
  restaurantName: string;
};

type Booking = {
  id: string;
  date: string;
  timeSlot: string;
  partySize: number;
  tableTypeId: string;
  name: string;
  email: string;
  phone: string;
  allergies: string;
  status: string;
  createdAt: string;
};

const WEEKDAYS = [
  { value: 1, label: "Mån" },
  { value: 2, label: "Tis" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lör" },
  { value: 0, label: "Sön" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [dateFilter, setDateFilter] = useState<string>(todayISO());
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    loadBookings(dateFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  function loadSettings() {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }

  function loadBookings(date: string) {
    setLoadingBookings(true);
    const url = date ? `/api/admin/bookings?date=${date}` : `/api/admin/bookings`;
    fetch(url)
      .then((r) => r.json())
      .then(setBookings)
      .finally(() => setLoadingBookings(false));
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

  function toggleWeekday(day: number) {
    if (!settings) return;
    const has = settings.openDays.includes(day);
    const next = has
      ? settings.openDays.filter((d) => d !== day)
      : [...settings.openDays, day];
    saveSettings({ openDays: next });
  }

  async function cancelBooking(id: string) {
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    loadBookings(dateFilter);
  }

  function updateTableTypeCount(id: string, count: number) {
    if (!settings) return;
    const next = settings.tableTypes.map((t) =>
      t.id === id ? { ...t, count } : t
    );
    saveSettings({ tableTypes: next });
  }

  if (!settings) {
    return <p className="text-sage font-mono text-sm">Laddar inställningar…</p>;
  }

  return (
    <div className="space-y-12">
      {/* Systemstatus */}
      <section className="border border-ink/10 rounded-sm p-6 bg-paper-50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display uppercase text-lg tracking-wide">
              Bokningssystem
            </h2>
            <p className="text-sm text-sage mt-1">
              {settings.systemOpen
                ? "Öppet — gäster kan boka bord."
                : "Stängt — bokningssidan visar ett meddelande istället."}
            </p>
          </div>
          <ToggleButton
            active={settings.systemOpen}
            onClick={() => saveSettings({ systemOpen: !settings.systemOpen })}
            labelOn="Öppet"
            labelOff="Stängt"
          />
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-sage mb-2">
            Öppna dagar
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((w) => {
              const active = settings.openDays.includes(w.value);
              return (
                <button
                  key={w.value}
                  onClick={() => toggleWeekday(w.value)}
                  className={[
                    "px-4 py-2 rounded-sm border text-sm font-medium transition-colors",
                    active
                      ? "bg-ink text-paper border-ink"
                      : "border-ink/20 text-ink/50 hover:border-ink/50",
                  ].join(" ")}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        {(savingSettings || settingsSaved) && (
          <p className="text-xs text-sage mt-4 font-mono">
            {savingSettings ? "Sparar…" : "Sparat ✓"}
          </p>
        )}
      </section>

      {/* Avancerat */}
      <section className="border border-ink/10 rounded-sm p-6">
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="font-display uppercase text-lg tracking-wide flex items-center gap-2"
        >
          Avancerade inställningar
          <span className="text-sage text-sm font-body">
            {advancedOpen ? "▲" : "▼"}
          </span>
        </button>

        {advancedOpen && (
          <div className="mt-6 space-y-8">
            <div className="grid sm:grid-cols-2 gap-6">
              <NumberField
                label="Max bord per kvart"
                value={settings.maxTablesPerSlot}
                onCommit={(v) => saveSettings({ maxTablesPerSlot: v })}
              />
              <NumberField
                label="Max sällskap per kvart"
                value={settings.maxPartiesPerSlot}
                onCommit={(v) => saveSettings({ maxPartiesPerSlot: v })}
              />
              <NumberField
                label="Störst sällskap som får boka online"
                value={settings.maxOnlinePartySize}
                onCommit={(v) => saveSettings({ maxOnlinePartySize: v })}
              />
              <NumberField
                label="Spara bokningar i (månader) — GDPR"
                value={settings.retentionMonths}
                onCommit={(v) => saveSettings({ retentionMonths: v })}
              />
              <TextField
                label="Kontaktmail (frågor & stora sällskap)"
                value={settings.contactEmail}
                onCommit={(v) => saveSettings({ contactEmail: v })}
              />
              <TextField
                label="Restaurangens namn"
                value={settings.restaurantName}
                onCommit={(v) => saveSettings({ restaurantName: v })}
              />
              <TextField
                label="Sittningstider (kommaseparerat, t.ex. 11:30,12:30)"
                value={settings.sittings.join(",")}
                onCommit={(v) =>
                  saveSettings({
                    sittings: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>

            <p className="text-xs text-sage">
              Bokningar (namn, mail, telefon, ev. allergier) raderas
              automatiskt varje natt när de blir äldre än inställningen
              ovan. Ändringen gäller från nästa körning, inte bakåt i
              tiden.
            </p>

            <div>
              <p className="text-xs uppercase tracking-widest text-sage mb-3">
                Bordstyper
              </p>
              <div className="space-y-2">
                {settings.tableTypes.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center gap-4 border border-ink/10 rounded-sm p-3"
                  >
                    <span className="font-medium min-w-[140px]">
                      {t.label}
                    </span>
                    <span className="text-xs text-sage">
                      {t.minPeople}–{t.seats} personer
                    </span>
                    <label className="flex items-center gap-2 ml-auto text-sm">
                      Antal bord
                      <input
                        type="number"
                        min={0}
                        defaultValue={t.count}
                        onBlur={(e) =>
                          updateTableTypeCount(
                            t.id,
                            Number(e.target.value) || 0
                          )
                        }
                        className="w-20 border border-ink/20 rounded-sm px-2 py-1"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Bokningar */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display uppercase text-lg tracking-wide">
              Bokningar
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                Datum
              </span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-ink/20 rounded-sm px-3 py-2"
              />
            </label>
            <button
              onClick={() => setDateFilter("")}
              className="text-sm underline decoration-dotted text-sage hover:text-ink"
            >
              Visa alla
            </button>
            <a
              href={
                dateFilter
                  ? `/api/admin/bookings/export?from=${dateFilter}&to=${dateFilter}`
                  : "/api/admin/bookings/export"
              }
              className="px-4 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm hover:bg-ink-700"
            >
              Ladda ner Excel
            </a>
          </div>
        </div>

        {loadingBookings && (
          <p className="text-sage font-mono text-sm">Laddar bokningar…</p>
        )}

        {!loadingBookings && bookings && bookings.length === 0 && (
          <p className="text-sage text-sm">Inga bokningar hittades.</p>
        )}

        {!loadingBookings && bookings && bookings.length > 0 && (
          <div className="overflow-x-auto border border-ink/10 rounded-sm">
            <table className="w-full text-sm">
              <thead className="bg-paper-100 text-left">
                <tr>
                  <Th>Datum</Th>
                  <Th>Tid</Th>
                  <Th>Namn</Th>
                  <Th>Antal</Th>
                  <Th>Bord</Th>
                  <Th>Telefon</Th>
                  <Th>Mail</Th>
                  <Th>Allergier</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-t border-ink/10 ${
                      b.status === "cancelled" ? "opacity-40" : ""
                    }`}
                  >
                    <Td>{b.date}</Td>
                    <Td className="font-mono">{b.timeSlot}</Td>
                    <Td>{b.name}</Td>
                    <Td>{b.partySize}</Td>
                    <Td>{b.tableTypeId}</Td>
                    <Td>{b.phone}</Td>
                    <Td>{b.email}</Td>
                    <Td className="max-w-[160px] truncate" title={b.allergies}>
                      {b.allergies || "—"}
                    </Td>
                    <Td>{b.status === "cancelled" ? "Avbokad" : "Bekräftad"}</Td>
                    <Td>
                      {b.status !== "cancelled" && (
                        <button
                          onClick={() => cancelBooking(b.id)}
                          className="text-brick underline decoration-dotted text-xs"
                        >
                          Avboka
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  labelOn,
  labelOff,
}: {
  active: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-5 py-2 rounded-sm font-display uppercase tracking-widest text-sm transition-colors",
        active ? "bg-sage text-white" : "bg-brick text-white",
      ].join(" ")}
    >
      {active ? labelOn : labelOff}
    </button>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-widest text-sage mb-1">
        {label}
      </span>
      <input
        type="number"
        defaultValue={value}
        onBlur={(e) => onCommit(Number(e.target.value) || 0)}
        className="w-full border border-ink/20 rounded-sm px-3 py-2"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-widest text-sage mb-1">
        {label}
      </span>
      <input
        type="text"
        defaultValue={value}
        onBlur={(e) => onCommit(e.target.value)}
        className="w-full border border-ink/20 rounded-sm px-3 py-2"
      />
    </label>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td className={`px-3 py-2 ${className ?? ""}`} title={title}>
      {children}
    </td>
  );
}

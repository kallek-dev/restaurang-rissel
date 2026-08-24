"use client";

import { useEffect, useState } from "react";
import type { Settings } from "./SettingsTab";
import DayBookingsTable, { Booking } from "./DayBookingsTable";

type CapacitySlot = {
  time: string;
  tablesBooked: number;
  tableAvailability: { id: string; label: string; booked: number; total: number }[];
};
type CapacitySitting = { sitting: string; slots: CapacitySlot[] };
type CapacityData = { date: string; open: boolean; sittingGroups: CapacitySitting[] };

type Props = {
  settings: Settings;
  onNewBooking: (date: string) => void;
  onEditBooking: (booking: Booking) => void;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12));
  return date.toISOString().slice(0, 10);
}
function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export default function TodayTab({ settings, onNewBooking, onEditBooking }: Props) {
  const [date, setDate] = useState(todayISO());
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [showCapacity, setShowCapacity] = useState(false);

  useEffect(() => {
    load();
    fetch(`/api/admin/availability?date=${date}`)
      .then((r) => r.json())
      .then(setCapacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function load() {
    setLoading(true);
    fetch(`/api/admin/bookings?date=${date}`)
      .then((r) => r.json())
      .then(setBookings)
      .finally(() => setLoading(false));
  }

  async function cancelBooking(id: string) {
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    load();
  }

  const active = bookings?.filter((b) => b.status !== "cancelled") ?? [];
  const totalGuests = active.reduce((sum, b) => sum + b.partySize, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDate((d) => addDays(d, -1))}
            className="w-9 h-9 border border-ink/20 rounded-sm hover:border-ink/50"
          >
            ‹
          </button>
          <div className="text-center min-w-[220px]">
            <p className="font-display uppercase text-lg">
              {date === todayISO() ? "Idag" : formatDateLabel(date)}
            </p>
            {date !== todayISO() && (
              <p className="text-xs text-sage">{date}</p>
            )}
          </div>
          <button
            onClick={() => setDate((d) => addDays(d, 1))}
            className="w-9 h-9 border border-ink/20 rounded-sm hover:border-ink/50"
          >
            ›
          </button>
          {date !== todayISO() && (
            <button
              onClick={() => setDate(todayISO())}
              className="text-sm underline decoration-dotted text-sage hover:text-ink"
            >
              Till idag
            </button>
          )}
        </div>
        <button
          onClick={() => onNewBooking(date)}
          className="px-4 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm hover:bg-ink-700"
        >
          + Ny bokning
        </button>
      </div>

      <div className="mb-6">
        <button
          onClick={() => setShowCapacity((v) => !v)}
          className="text-sm font-display uppercase tracking-wide text-sage hover:text-ink flex items-center gap-2"
        >
          Bordsläge, detaljerat {showCapacity ? "▲" : "▼"}
        </button>
        {showCapacity && capacity && (
          <div className="mt-3 border border-ink/10 rounded-sm p-4 space-y-4">
            {capacity.sittingGroups.map((sg) => (
              <div key={sg.sitting}>
                <p className="text-xs uppercase tracking-widest text-sage mb-2">
                  {sg.sitting}-passet
                </p>
                <div className="overflow-x-auto">
                  <table className="text-sm">
                    <tbody>
                      {sg.slots.map((slot) => (
                        <tr key={slot.time}>
                          <td className="font-mono pr-4 py-1">{slot.time}</td>
                          {slot.tableAvailability.map((t) => (
                            <td key={t.id} className="pr-4 py-1 text-sage">
                              {t.label}:{" "}
                              <span
                                className={
                                  t.booked >= t.total
                                    ? "text-brick font-medium"
                                    : "text-ink"
                                }
                              >
                                {t.booked}/{t.total}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}

      {!loading && (
        <>
          <p className="text-xs text-sage mb-3">
            {active.length} {active.length === 1 ? "bokning" : "bokningar"},{" "}
            {totalGuests} gäster totalt
          </p>
          <DayBookingsTable
            bookings={bookings ?? []}
            sittings={settings.sittings}
            tableTypes={settings.tableTypes}
            onEdit={onEditBooking}
            onCancel={cancelBooking}
          />
        </>
      )}
    </div>
  );
}

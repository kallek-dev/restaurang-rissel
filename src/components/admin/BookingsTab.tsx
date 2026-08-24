"use client";

import { useEffect, useMemo, useState } from "react";
import type { Settings } from "./SettingsTab";
import DayBookingsTable, { Booking } from "./DayBookingsTable";
import Calendar from "@/components/Calendar";

export type { Booking };

type Props = {
  settings: Settings;
  onNewBooking: (date?: string) => void;
  onEditBooking: (booking: Booking) => void;
};

const WEEKDAY_LABELS = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12));
  return date.toISOString().slice(0, 10);
}
function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}
function mondayOf(dateStr: string): string {
  const w = weekdayOf(dateStr); // 0=sön ... 6=lör
  const diff = w === 0 ? -6 : 1 - w;
  return addDays(dateStr, diff);
}
function formatDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${WEEKDAY_LABELS[weekdayOf(dateStr)]} ${d}/${m}`;
}
function formatWeekRangeLabel(mondayStr: string): string {
  const sunday = addDays(mondayStr, 6);
  const [, m1, d1] = mondayStr.split("-").map(Number);
  const [, m2, d2] = sunday.split("-").map(Number);
  return `${d1}/${m1} – ${d2}/${m2}`;
}

export default function BookingsTab({ settings, onNewBooking, onEditBooking }: Props) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [singleDate, setSingleDate] = useState<string | null>(null); // satt = avsmalnad till en dag
  const [showAll, setShowAll] = useState(false);

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(true);

  const rangeFrom = singleDate ?? weekStart;
  const rangeTo = singleDate ?? addDays(weekStart, 6);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, singleDate, showAll]);

  function load() {
    setLoading(true);
    const url = showAll
      ? `/api/admin/bookings`
      : singleDate
      ? `/api/admin/bookings?date=${singleDate}`
      : `/api/admin/bookings?from=${weekStart}&to=${addDays(weekStart, 6)}`;
    fetch(url)
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

  function selectDayInCalendar(date: string) {
    setShowAll(false);
    setSingleDate(date);
    setWeekStart(mondayOf(date));
  }

  // Dagar att visa: om "visa alla", varje dag som förekommer i datan.
  // Om avsmalnad till en dag, bara den. Annars alla öppna dagar i
  // veckan (även utan bokningar, så tomt syns tydligt).
  const days = useMemo(() => {
    if (showAll) {
      if (!bookings) return [];
      return Array.from(new Set(bookings.map((b) => b.date))).sort();
    }
    if (singleDate) return [singleDate];
    if (!bookings) return [];
    const active = bookings.filter((b) => b.status !== "cancelled");
    const set = new Set<string>(active.map((b) => b.date));
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      if (settings.openDays.includes(weekdayOf(d))) set.add(d);
    }
    return Array.from(set).sort();
  }, [bookings, settings.openDays, weekStart, singleDate, showAll]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
        <div>
          <Calendar
            selectedDate={singleDate}
            onSelect={selectDayInCalendar}
            openDays={settings.openDays}
            allowAllDays
          />
          <div className="flex gap-3 mt-2">
            {(singleDate || showAll) && (
              <button
                onClick={() => {
                  setSingleDate(null);
                  setShowAll(false);
                }}
                className="text-sm underline decoration-dotted text-sage hover:text-ink"
              >
                ← Visa veckan
              </button>
            )}
            {!singleDate && !showAll && weekStart !== mondayOf(todayISO()) && (
              <button
                onClick={() => setWeekStart(mondayOf(todayISO()))}
                className="text-sm underline decoration-dotted text-sage hover:text-ink"
              >
                Denna vecka
              </button>
            )}
            {!showAll && (
              <button
                onClick={() => {
                  setShowAll(true);
                  setSingleDate(null);
                }}
                className="text-sm underline decoration-dotted text-sage hover:text-ink"
              >
                Visa alla bokningar
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div>
            <p className="font-display uppercase text-lg text-right">
              {showAll
                ? "Alla bokningar"
                : singleDate
                ? formatDayLabel(singleDate)
                : weekStart === mondayOf(todayISO())
                ? "Denna vecka"
                : "Vecka"}
            </p>
            {!singleDate && !showAll && (
              <p className="text-xs text-sage text-right">{formatWeekRangeLabel(weekStart)}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={
                showAll
                  ? "/api/admin/bookings/export"
                  : `/api/admin/bookings/export?from=${rangeFrom}&to=${rangeTo}`
              }
              className="px-4 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm hover:bg-ink-700"
            >
              Ladda ner Excel
            </a>
            <button
              onClick={() => onNewBooking(singleDate ?? undefined)}
              className="px-4 py-2 border border-ink/20 text-sm font-display uppercase tracking-wide rounded-sm hover:border-ink/50"
            >
              + Ny bokning
            </button>
          </div>
        </div>
      </div>

      {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}

      {!loading && days.length === 0 && (
        <p className="text-sage text-sm">Inga bokningar hittades.</p>
      )}

      <div className="space-y-10">
        {days.map((date) => (
          <div key={date}>
            {(!singleDate || showAll) && (
              <h3 className="font-display uppercase text-base mb-3 pb-2 border-b border-ink/10">
                {formatDayLabel(date)}
              </h3>
            )}
            <DayBookingsTable
              bookings={(bookings ?? []).filter((b) => b.date === date)}
              sittings={settings.sittings}
              tableTypes={settings.tableTypes}
              onEdit={onEditBooking}
              onCancel={cancelBooking}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

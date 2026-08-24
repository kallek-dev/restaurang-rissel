"use client";

import { useEffect, useMemo, useState } from "react";
import type { Settings } from "./SettingsTab";
import DayBookingsTable, { Booking } from "./DayBookingsTable";
import Calendar from "@/components/Calendar";

export type { Booking };

type CapacityData = {
  date: string;
  open: boolean;
  sittingGroups: {
    sitting: string;
    slots: {
      time: string;
      tableAvailability: { id: string; label: string; booked: number; total: number }[];
    }[];
  }[];
};

type Props = {
  settings: Settings;
  onNewBooking: (date?: string) => void;
  onEditBooking: (booking: Booking) => void;
};

const WEEKDAY_LABELS = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
const MONTH_NAMES = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

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
  const w = weekdayOf(dateStr);
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
function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad2(month + 1)}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`;
  return { start, end };
}

type Mode = "week" | "month" | "day" | "search";

type SearchResult = {
  id: string;
  date: string;
  timeSlot: string;
  name: string;
  email: string;
  phone: string;
  partySize: number;
  tableTypeId: string;
  status: string;
};

export default function BookingsTab({ settings, onNewBooking, onEditBooking }: Props) {
  const [mode, setMode] = useState<Mode>("week");
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [browsedMonth, setBrowsedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [singleDate, setSingleDate] = useState<string | null>(null);

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [showCapacity, setShowCapacity] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const rangeFrom =
    mode === "day" && singleDate
      ? singleDate
      : mode === "month"
      ? monthRange(browsedMonth.year, browsedMonth.month).start
      : weekStart;
  const rangeTo =
    mode === "day" && singleDate
      ? singleDate
      : mode === "month"
      ? monthRange(browsedMonth.year, browsedMonth.month).end
      : addDays(weekStart, 6);

  useEffect(() => {
    if (mode === "search") return;
    load();
    if (mode === "day" && singleDate) {
      fetch(`/api/admin/availability?date=${singleDate}`)
        .then((r) => r.json())
        .then(setCapacity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, weekStart, browsedMonth, singleDate]);

  function load() {
    setLoading(true);
    let url = "/api/admin/bookings";
    if (mode === "day" && singleDate) {
      url += `?date=${singleDate}`;
    } else {
      url += `?from=${rangeFrom}&to=${rangeTo}`;
    }
    fetch(url)
      .then((r) => r.json())
      .then(setBookings)
      .finally(() => setLoading(false));
  }

  function handleSelectDay(date: string) {
    setSingleDate(date);
    setWeekStart(mondayOf(date));
    setMode("day");
  }
  function handleMonthChange(year: number, month: number) {
    setBrowsedMonth({ year, month });
    setSingleDate(null);
    setMode("month");
  }
  function goToday() {
    setSingleDate(null);
    setWeekStart(mondayOf(todayISO()));
    setMode("week");
  }

  async function runSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/bookings/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data);
    } finally {
      setSearching(false);
    }
  }

  // Dagar att visa i vecko-/månadsvy: dagar med bokningar, plus (bara i
  // veckovyn) alla öppna dagar utan bokningar, så tomt syns tydligt.
  // I månadsvyn visas bara dagar som faktiskt har bokningar — annars
  // blir det en lång vägg av tomma dagar.
  const days = useMemo(() => {
    if (mode === "day") return singleDate ? [singleDate] : [];
    if (!bookings) return [];
    const active = bookings.filter((b) => b.status !== "cancelled");
    const set = new Set<string>(active.map((b) => b.date));
    if (mode === "week") {
      for (let i = 0; i < 7; i++) {
        set.add(addDays(weekStart, i));
      }
    }
    return Array.from(set).sort();
  }, [bookings, weekStart, mode, singleDate]);

  const headerLabel =
    mode === "day" && singleDate
      ? formatDayLabel(singleDate)
      : mode === "month"
      ? `${MONTH_NAMES[browsedMonth.month]} ${browsedMonth.year}`
      : weekStart === mondayOf(todayISO())
      ? "Denna vecka"
      : "Vecka";

  const activeCount = bookings?.filter((b) => b.status !== "cancelled").length ?? 0;
  const totalGuests =
    bookings?.filter((b) => b.status !== "cancelled").reduce((sum, b) => sum + b.partySize, 0) ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
        {mode !== "search" ? (
          <div>
            <Calendar
              selectedDate={singleDate}
              onSelect={handleSelectDay}
              onMonthChange={handleMonthChange}
              allowAllDays
            />
            {(singleDate || mode === "month" || weekStart !== mondayOf(todayISO())) && (
              <button
                onClick={goToday}
                className="text-sm underline decoration-dotted text-sage hover:text-ink mt-2"
              >
                Till denna vecka
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-sm w-full">
            <label className="block text-sm">
              <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                Sök på namn, telefon eller mail
              </span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="T.ex. Andersson, 0701234567…"
                className="w-full border border-ink/20 rounded-sm px-3 py-2"
              />
            </label>
          </div>
        )}

        <div className="flex flex-col items-end gap-3">
          {mode !== "search" && (
            <div>
              <p className="font-display uppercase text-lg text-right">{headerLabel}</p>
              {mode === "week" && (
                <p className="text-xs text-sage text-right">{formatWeekRangeLabel(weekStart)}</p>
              )}
              {bookings && (
                <p className="text-xs text-sage text-right">
                  {activeCount} {activeCount === 1 ? "bokning" : "bokningar"}, {totalGuests} gäster
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => setMode((m) => (m === "search" ? "week" : "search"))}
              className="text-sm underline decoration-dotted text-sage hover:text-ink"
            >
              {mode === "search" ? "Tillbaka" : "Sök bokning"}
            </button>
            {mode === "day" && singleDate && (
              <a
                href={`/admin/print/${singleDate}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-ink/20 text-sm font-display uppercase tracking-wide rounded-sm hover:border-ink/50"
              >
                Skriv ut
              </a>
            )}
            {mode !== "search" && (
              <a
                href={`/api/admin/bookings/export?from=${rangeFrom}&to=${rangeTo}`}
                className="px-4 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm hover:bg-ink-700"
              >
                Ladda ner Excel
              </a>
            )}
            <button
              onClick={() => onNewBooking(singleDate ?? undefined)}
              className="px-4 py-2 border border-ink/20 text-sm font-display uppercase tracking-wide rounded-sm hover:border-ink/50"
            >
              + Ny bokning
            </button>
          </div>
        </div>
      </div>

      {mode === "day" && singleDate && (
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
                                    t.booked >= t.total ? "text-brick font-medium" : "text-ink"
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
      )}

      {mode === "search" ? (
        <div>
          {searching && <p className="text-sage font-mono text-sm">Söker…</p>}
          {!searching && searchQuery.trim().length >= 2 && searchResults?.length === 0 && (
            <p className="text-sage text-sm">Inga träffar.</p>
          )}
          {!searching && searchQuery.trim().length < 2 && (
            <p className="text-sage text-sm">Skriv minst två tecken för att söka.</p>
          )}
          {searchResults && searchResults.length > 0 && (
            <div className="overflow-x-auto border border-ink/10 rounded-sm">
              <table className="w-full text-sm">
                <thead className="bg-paper-100 text-left">
                  <tr>
                    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">Datum</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">Tid</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">Namn</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">Antal</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">Telefon</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">Mail</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((b) => (
                    <tr key={b.id} className={`border-t border-ink/10 ${b.status === "cancelled" ? "opacity-40" : ""}`}>
                      <td className="px-3 py-2">{b.date}</td>
                      <td className="px-3 py-2 font-mono">{b.timeSlot}</td>
                      <td className="px-3 py-2">{b.name}</td>
                      <td className="px-3 py-2">{b.partySize}</td>
                      <td className="px-3 py-2">{b.phone}</td>
                      <td className="px-3 py-2">{b.email}</td>
                      <td className="px-3 py-2">{b.status === "cancelled" ? "Avbokad" : "Bekräftad"}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => onEditBooking(b as unknown as Booking)}
                          className="text-ink underline decoration-dotted text-xs"
                        >
                          Redigera
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}
          {!loading && days.length === 0 && (
            <p className="text-sage text-sm">Inga bokningar hittades.</p>
          )}
          <div className="space-y-10">
            {days.map((date) => (
              <div key={date}>
                {mode !== "day" && (
                  <h3 className="font-display uppercase text-base mb-3 pb-2 border-b border-ink/10">
                    {formatDayLabel(date)}
                  </h3>
                )}
                <DayBookingsTable
                  bookings={(bookings ?? []).filter((b) => b.date === date)}
                  sittings={settings.sittings}
                  tableTypes={settings.tableTypes}
                  onEdit={onEditBooking}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

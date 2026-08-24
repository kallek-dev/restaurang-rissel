"use client";

import { useEffect, useMemo, useState } from "react";
import type { Settings } from "./SettingsTab";

export type Booking = {
  id: string;
  date: string;
  sitting: string;
  timeSlot: string;
  partySize: number;
  tableTypeId: string;
  name: string;
  email: string;
  phone: string;
  allergies: string;
  note: string;
  createdByAdmin: boolean;
  status: string;
};

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
// Måndagen i samma vecka som dateStr.
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
  const [customMode, setCustomMode] = useState(false);
  const [customDate, setCustomDate] = useState<string>(todayISO());

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(true);

  const rangeFrom = customMode ? (customDate || undefined) : weekStart;
  const rangeTo = customMode ? (customDate || undefined) : addDays(weekStart, 6);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, customMode, customDate]);

  function load() {
    setLoading(true);
    let url = "/api/admin/bookings";
    if (customMode) {
      if (customDate) url += `?date=${customDate}`;
    } else {
      url += `?from=${weekStart}&to=${addDays(weekStart, 6)}`;
    }
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

  async function deleteBooking(id: string, label: string) {
    if (!confirm(`Radera bokningen för ${label} permanent? Går inte att ångra.`)) return;
    await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
    load();
  }

  // Gruppera: dag -> sittning -> bokningar (bara icke-avbokade i grupperingen).
  const groupedByDay = useMemo(() => {
    if (!bookings) return [];
    const active = bookings.filter((b) => b.status !== "cancelled");

    const days = new Set<string>(active.map((b) => b.date));
    if (!customMode) {
      // Visa alla öppna dagar i veckan även utan bokningar, så man ser
      // att det verkligen är tomt — inte bara att inget laddats.
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        if (settings.openDays.includes(weekdayOf(d))) days.add(d);
      }
    }

    return Array.from(days)
      .sort()
      .map((date) => {
        const dayBookings = active.filter((b) => b.date === date);
        const sittingsPresent = new Set(dayBookings.map((b) => b.sitting));
        for (const s of settings.sittings) sittingsPresent.add(s); // visa alla sittningar, även tomma
        const sittingGroups = Array.from(sittingsPresent)
          .sort()
          .map((sitting) => {
            const list = dayBookings
              .filter((b) => b.sitting === sitting)
              .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

            const capacity = settings.tableTypes.map((tt) => {
              const booked = list.filter((b) => b.tableTypeId === tt.id).length;
              return { label: tt.label, booked, total: tt.count };
            });

            return { sitting, bookings: list, capacity };
          })
          .filter((g) => g.bookings.length > 0 || settings.sittings.includes(g.sitting));

        return { date, sittingGroups };
      });
  }, [bookings, settings, weekStart, customMode]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {!customMode ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="w-9 h-9 border border-ink/20 rounded-sm hover:border-ink/50"
            >
              ‹
            </button>
            <div className="text-center min-w-[180px]">
              <p className="font-display uppercase text-lg">
                {weekStart === mondayOf(todayISO()) ? "Denna vecka" : `Vecka`}
              </p>
              <p className="text-xs text-sage">{formatWeekRangeLabel(weekStart)}</p>
            </div>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="w-9 h-9 border border-ink/20 rounded-sm hover:border-ink/50"
            >
              ›
            </button>
            {weekStart !== mondayOf(todayISO()) && (
              <button
                onClick={() => setWeekStart(mondayOf(todayISO()))}
                className="text-sm underline decoration-dotted text-sage hover:text-ink"
              >
                Denna vecka
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                Datum
              </span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="border border-ink/20 rounded-sm px-3 py-2"
              />
            </label>
            <button
              onClick={() => setCustomDate("")}
              className="text-sm underline decoration-dotted text-sage hover:text-ink pb-2"
            >
              Visa alla
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setCustomMode((v) => !v)}
            className="text-sm underline decoration-dotted text-sage hover:text-ink"
          >
            {customMode ? "Tillbaka till veckovy" : "Anpassat filter"}
          </button>
          <a
            href={
              rangeFrom || rangeTo
                ? `/api/admin/bookings/export?${rangeFrom ? `from=${rangeFrom}&` : ""}${rangeTo ? `to=${rangeTo}` : ""}`
                : "/api/admin/bookings/export"
            }
            className="px-4 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm hover:bg-ink-700"
          >
            Ladda ner Excel
          </a>
          <button
            onClick={() => onNewBooking()}
            className="px-4 py-2 border border-ink/20 text-sm font-display uppercase tracking-wide rounded-sm hover:border-ink/50"
          >
            + Ny bokning
          </button>
        </div>
      </div>

      {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}

      {!loading && groupedByDay.length === 0 && (
        <p className="text-sage text-sm">Inga bokningar hittades.</p>
      )}

      <div className="space-y-8">
        {groupedByDay.map(({ date, sittingGroups }) => (
          <div key={date}>
            <h3 className="font-display uppercase text-base mb-3 pb-2 border-b border-ink/10">
              {formatDayLabel(date)}
            </h3>
            <div className="space-y-5">
              {sittingGroups.map(({ sitting, bookings: list, capacity }) => (
                <div key={sitting}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <p className="font-mono text-sm text-ink/80">{sitting}-passet</p>
                    <p className="text-xs text-sage">
                      {capacity.map((c) => `${c.booked} av ${c.total} ${c.label.toLowerCase()}`).join(" · ")}
                    </p>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-xs text-sage pl-2">Inga bokningar.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {list.map((b) => (
                        <div
                          key={b.id}
                          className="flex flex-wrap items-center gap-3 border border-ink/10 rounded-sm px-3 py-2 text-sm"
                        >
                          <span className="font-mono min-w-[46px]">{b.timeSlot}</span>
                          <span className="font-medium min-w-[130px]">{b.name}</span>
                          <span className="text-sage">{b.partySize} pers</span>
                          <span className="text-sage">{b.tableTypeId}</span>
                          <span className="text-sage">{b.phone}</span>
                          {b.createdByAdmin && (
                            <span className="text-[10px] uppercase tracking-widest bg-gold/20 text-gold-700 px-1.5 py-0.5 rounded-sm">
                              Admin
                            </span>
                          )}
                          {b.note && <span className="text-xs text-sage italic">{b.note}</span>}
                          <div className="ml-auto flex gap-3 shrink-0">
                            <button
                              onClick={() => onEditBooking(b)}
                              className="text-ink underline decoration-dotted text-xs"
                            >
                              Redigera
                            </button>
                            <button
                              onClick={() => cancelBooking(b.id)}
                              className="text-brick underline decoration-dotted text-xs"
                            >
                              Avboka
                            </button>
                            <button
                              onClick={() => deleteBooking(b.id, b.name)}
                              className="text-brick underline decoration-dotted text-xs"
                            >
                              Radera
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

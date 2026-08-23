"use client";

import { useEffect, useState } from "react";

type Booking = {
  id: string;
  date: string;
  sitting: string;
  timeSlot: string;
  partySize: number;
  tableTypeId: string;
  name: string;
  phone: string;
  note: string;
  createdByAdmin: boolean;
  status: string;
};

type Props = {
  onNewBooking: (date: string) => void;
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

export default function TodayTab({ onNewBooking }: Props) {
  const [date, setDate] = useState(todayISO());
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/bookings?date=${date}`)
      .then((r) => r.json())
      .then(setBookings)
      .finally(() => setLoading(false));
  }, [date]);

  async function cancelBooking(id: string) {
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    fetch(`/api/admin/bookings?date=${date}`)
      .then((r) => r.json())
      .then(setBookings);
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

      {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}

      {!loading && active.length === 0 && (
        <p className="text-sage text-sm">Inga bokningar den här dagen.</p>
      )}

      {!loading && active.length > 0 && (
        <>
          <p className="text-xs text-sage mb-3">
            {active.length} {active.length === 1 ? "bokning" : "bokningar"},{" "}
            {totalGuests} gäster totalt
          </p>
          <div className="space-y-2">
            {active.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-4 border border-ink/10 rounded-sm p-3"
              >
                <span className="font-mono text-sm min-w-[50px]">
                  {b.timeSlot}
                </span>
                <span className="font-medium min-w-[140px]">{b.name}</span>
                <span className="text-sm text-sage">{b.partySize} pers</span>
                <span className="text-sm text-sage">{b.tableTypeId}</span>
                <span className="text-sm text-sage">{b.phone}</span>
                {b.createdByAdmin && (
                  <span className="text-[10px] uppercase tracking-widest bg-gold/20 text-gold-700 px-2 py-0.5 rounded-sm">
                    Admin
                  </span>
                )}
                {b.note && (
                  <span className="text-xs text-sage italic">{b.note}</span>
                )}
                <button
                  onClick={() => cancelBooking(b.id)}
                  className="ml-auto text-brick underline decoration-dotted text-xs"
                >
                  Avboka
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

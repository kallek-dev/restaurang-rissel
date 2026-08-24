"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DayBookingsTable, { Booking } from "@/components/admin/DayBookingsTable";

type Settings = {
  sittings: string[];
  tableTypes: { id: string; label: string; count: number }[];
  restaurantName: string;
};

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function PrintDayPage() {
  const params = useParams<{ date: string }>();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/bookings?date=${params.date}`).then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ]).then(([b, s]) => {
      setBookings(b);
      setSettings(s);
    });
  }, [params.date]);

  const active = bookings?.filter((b) => b.status !== "cancelled") ?? [];
  const totalGuests = active.reduce((sum, b) => sum + b.partySize, 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 print:px-0 print:py-4">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="px-5 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm"
        >
          Skriv ut
        </button>
        <a href="/admin" className="text-sm underline decoration-dotted text-sage">
          ← Tillbaka till admin
        </a>
      </div>

      <h1 className="font-display uppercase text-2xl mb-1">
        {settings?.restaurantName ?? "Restaurang Rissel"}
      </h1>
      <p className="text-ink/70 mb-1">{formatDateLabel(params.date)}</p>
      {bookings && (
        <p className="text-sm text-sage mb-6">
          {active.length} {active.length === 1 ? "bokning" : "bokningar"}, {totalGuests} gäster totalt
        </p>
      )}

      {!bookings || !settings ? (
        <p className="text-sage font-mono text-sm">Laddar…</p>
      ) : (
        <DayBookingsTable
          bookings={bookings}
          sittings={settings.sittings}
          tableTypes={settings.tableTypes}
          readOnly
        />
      )}
    </div>
  );
}

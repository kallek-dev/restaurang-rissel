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
  email: string;
  phone: string;
  allergies: string;
  note: string;
  createdByAdmin: boolean;
  status: string;
};

type Props = {
  onNewBooking: (date?: string) => void;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingsTab({ onNewBooking }: Props) {
  const [dateFilter, setDateFilter] = useState<string>(todayISO());
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBookings(dateFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  function loadBookings(date: string) {
    setLoading(true);
    const url = date ? `/api/admin/bookings?date=${date}` : `/api/admin/bookings`;
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
    loadBookings(dateFilter);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <h2 className="font-display uppercase text-lg tracking-wide">
          Bokningar
        </h2>
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
          <button
            onClick={() => onNewBooking(dateFilter || undefined)}
            className="px-4 py-2 border border-ink/20 text-sm font-display uppercase tracking-wide rounded-sm hover:border-ink/50"
          >
            + Ny bokning
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sage font-mono text-sm">Laddar bokningar…</p>
      )}

      {!loading && bookings && bookings.length === 0 && (
        <p className="text-sage text-sm">Inga bokningar hittades.</p>
      )}

      {!loading && bookings && bookings.length > 0 && (
        <div className="overflow-x-auto border border-ink/10 rounded-sm">
          <table className="w-full text-sm">
            <thead className="bg-paper-100 text-left">
              <tr>
                <Th>Datum</Th>
                <Th>Sittning</Th>
                <Th>Tid</Th>
                <Th>Namn</Th>
                <Th>Antal</Th>
                <Th>Bord</Th>
                <Th>Telefon</Th>
                <Th>Mail</Th>
                <Th>Allergier</Th>
                <Th>Anteckning</Th>
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
                  <Td className="font-mono">{b.sitting}</Td>
                  <Td className="font-mono">{b.timeSlot}</Td>
                  <Td>
                    {b.name}
                    {b.createdByAdmin && (
                      <span className="ml-1 text-[10px] uppercase tracking-widest bg-gold/20 text-gold-700 px-1.5 py-0.5 rounded-sm">
                        Admin
                      </span>
                    )}
                  </Td>
                  <Td>{b.partySize}</Td>
                  <Td>{b.tableTypeId}</Td>
                  <Td>{b.phone}</Td>
                  <Td>{b.email}</Td>
                  <Td className="max-w-[140px] truncate" title={b.allergies}>
                    {b.allergies || "—"}
                  </Td>
                  <Td className="max-w-[140px] truncate" title={b.note}>
                    {b.note || "—"}
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
    </div>
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

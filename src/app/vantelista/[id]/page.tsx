"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Entry = {
  date: string;
  timeSlot: string;
  partySize: number;
  name: string;
  status: string;
};

function formatDateSwedish(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export default function ClaimWaitlistPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<{ timeSlot: string; reference: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Länken saknar information och kan inte användas.");
      setLoading(false);
      return;
    }
    fetch(`/api/waitlist/${params.id}/claim?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Kunde inte hitta platsen.");
        return data as Entry;
      })
      .then(setEntry)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id, token]);

  async function handleClaim() {
    if (!token) return;
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch(`/api/waitlist/${params.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunde inte boka platsen.");
      setClaimed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full border border-ink/10 bg-paper-50 rounded-sm p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sage">
          Restaurang Rissel
        </p>
        <h1 className="font-display uppercase text-2xl mt-1 mb-6">
          Din väntelista-plats
        </h1>

        {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}

        {!loading && error && (
          <div className="border border-brick/40 bg-brick/5 text-brick rounded-sm p-4 text-sm">
            {error}
          </div>
        )}

        {!loading && claimed && (
          <div>
            <p className="text-ink/80">
              Klart! Bordet är bokat kl {claimed.timeSlot}. En bekräftelse
              är skickad till er mail. Bokningsnummer: {claimed.reference}
            </p>
            <a
              href="/"
              className="inline-block mt-6 text-sm underline decoration-dotted text-sage hover:text-ink"
            >
              ← Tillbaka till bokningssidan
            </a>
          </div>
        )}

        {!loading && entry && !claimed && !error && (
          <>
            {entry.status === "booked" ? (
              <p className="text-ink/80">
                Den här platsen är redan bokad — troligen av dig själv
                tidigare. Kolla mailen för bekräftelsen.
              </p>
            ) : (
              <>
                <div className="border border-ink/10 rounded-sm p-4 mb-6 font-mono text-sm space-y-2">
                  <div className="flex justify-between gap-4">
                    <span className="text-sage uppercase text-[11px] tracking-widest">Dag</span>
                    <span className="text-right">{formatDateSwedish(entry.date)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-sage uppercase text-[11px] tracking-widest">Tid</span>
                    <span className="text-right">{entry.timeSlot}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-sage uppercase text-[11px] tracking-widest">Antal</span>
                    <span className="text-right">
                      {entry.partySize} {entry.partySize === 1 ? "person" : "personer"}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-ink/70 mb-4">
                  Platsen är inte bokad än. Klicka nedan för att slutföra —
                  någon annan kan hinna före om du väntar för länge.
                </p>
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full px-6 py-3 bg-ink text-paper font-display uppercase tracking-widest text-sm rounded-sm disabled:opacity-40"
                >
                  {claiming ? "Bokar…" : "Boka platsen nu"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

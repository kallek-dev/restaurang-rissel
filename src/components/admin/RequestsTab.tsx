"use client";

import { useEffect, useState } from "react";

export type GroupRequest = {
  id: string;
  date: string;
  sitting: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  linkedBookingId: string | null;
  createdAt: string;
};

type Props = {
  onBookIn: (request: GroupRequest) => void;
  onEditRequest: (request: GroupRequest) => void;
};

const WEEKDAY_LABELS = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return `${WEEKDAY_LABELS[weekday]} ${d}/${m}`;
}

export default function RequestsTab({ onBookIn, onEditRequest }: Props) {
  const [requests, setRequests] = useState<GroupRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHandled, setShowHandled] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHandled]);

  function load() {
    setLoading(true);
    const url = showHandled
      ? "/api/admin/group-requests"
      : "/api/admin/group-requests?status=pending";
    fetch(url)
      .then((r) => r.json())
      .then(setRequests)
      .finally(() => setLoading(false));
  }

  async function setStatus(id: string, status: "handled" | "pending") {
    await fetch(`/api/admin/group-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="font-display uppercase text-lg tracking-wide">
          Förfrågningar
          {pendingCount > 0 && (
            <span className="ml-2 text-sm font-mono text-gold-700">
              ({pendingCount} väntar)
            </span>
          )}
        </h2>
        <label className="flex items-center gap-2 text-sm text-sage">
          <input
            type="checkbox"
            checked={showHandled}
            onChange={(e) => setShowHandled(e.target.checked)}
          />
          Visa hanterade också
        </label>
      </div>

      {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}

      {!loading && requests && requests.length === 0 && (
        <p className="text-sage text-sm">Inga förfrågningar just nu.</p>
      )}

      <div className="space-y-3">
        {requests?.map((r) => (
          <div
            key={r.id}
            className={`border rounded-sm p-4 ${
              r.status === "pending"
                ? "border-gold/40 bg-gold/5"
                : "border-ink/10 opacity-60"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {r.name} — {r.partySize} personer
                </p>
                <p className="text-sm text-sage">
                  Önskar {formatDateLabel(r.date)}, {r.sitting}
                </p>
                <p className="text-sm text-sage">
                  {r.phone} · {r.email}
                </p>
                {r.message && (
                  <p className="text-sm text-ink/70 mt-2 italic">
                    &quot;{r.message}&quot;
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {r.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onBookIn(r)}
                      className="px-4 py-2 bg-ink text-paper text-xs font-display uppercase tracking-wide rounded-sm"
                    >
                      Boka in
                    </button>
                    <button
                      onClick={() => onEditRequest(r)}
                      className="px-4 py-2 border border-ink/20 text-xs font-display uppercase tracking-wide rounded-sm"
                    >
                      Redigera
                    </button>
                    <button
                      onClick={() => setStatus(r.id, "handled")}
                      className="px-4 py-2 border border-ink/20 text-xs font-display uppercase tracking-wide rounded-sm"
                    >
                      Markera hanterad
                    </button>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-widest text-sage">
                      Hanterad
                    </span>
                    <div className="flex gap-3 mt-1 justify-end">
                      <button
                        onClick={() => onEditRequest(r)}
                        className="text-ink underline decoration-dotted text-xs"
                      >
                        Redigera
                      </button>
                      <button
                        onClick={() => setStatus(r.id, "pending")}
                        className="text-sage underline decoration-dotted text-xs hover:text-ink"
                      >
                        Ångra
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

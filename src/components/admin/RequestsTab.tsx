"use client";

import { useEffect, useState } from "react";

type GroupRequest = {
  id: string;
  date: string;
  sitting: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  createdAt: string;
};

type Props = {
  onBookIn: (request: GroupRequest) => void;
};

export default function RequestsTab({ onBookIn }: Props) {
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

  async function markHandled(id: string) {
    await fetch(`/api/admin/group-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "handled" }),
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
                  Önskar {r.date}, {r.sitting}
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
              {r.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onBookIn(r)}
                    className="px-4 py-2 bg-ink text-paper text-xs font-display uppercase tracking-wide rounded-sm"
                  >
                    Boka in
                  </button>
                  <button
                    onClick={() => markHandled(r.id)}
                    className="px-4 py-2 border border-ink/20 text-xs font-display uppercase tracking-wide rounded-sm"
                  >
                    Markera hanterad
                  </button>
                </div>
              )}
              {r.status === "handled" && (
                <span className="text-xs uppercase tracking-widest text-sage shrink-0">
                  Hanterad
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

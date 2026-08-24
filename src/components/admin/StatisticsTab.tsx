"use client";

import { useEffect, useState } from "react";

type Stats = {
  totalBookings: number;
  confirmedCount: number;
  cancelledCount: number;
  cancellationRate: number;
  avgPartySize: number;
  popularTimes: { time: string; count: number }[];
  popularWeekdays: { weekday: string; count: number }[];
  weeklyTrend: { week: string; count: number }[];
};

export default function StatisticsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/statistics")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sage font-mono text-sm">Laddar…</p>;
  if (!stats) return <p className="text-sage text-sm">Kunde inte hämta statistik.</p>;

  const maxTimeCount = Math.max(1, ...stats.popularTimes.map((t) => t.count));
  const maxWeekdayCount = Math.max(1, ...stats.popularWeekdays.map((w) => w.count));
  const maxWeekCount = Math.max(1, ...stats.weeklyTrend.map((w) => w.count));

  return (
    <div className="space-y-10">
      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard label="Totalt antal bokningar" value={String(stats.totalBookings)} />
        <StatCard label="Bekräftade" value={String(stats.confirmedCount)} />
        <StatCard
          label="Andel avbokade"
          value={`${Math.round(stats.cancellationRate * 100)}%`}
        />
        <StatCard label="Snittstorlek sällskap" value={stats.avgPartySize.toFixed(1)} />
      </div>

      <div>
        <h3 className="font-display uppercase text-base mb-3">Populäraste tider</h3>
        <div className="space-y-1.5">
          {stats.popularTimes.map((t) => (
            <BarRow key={t.time} label={t.time} count={t.count} max={maxTimeCount} />
          ))}
          {stats.popularTimes.length === 0 && (
            <p className="text-sage text-sm">Ingen data än.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-display uppercase text-base mb-3">Populäraste veckodagar</h3>
        <div className="space-y-1.5">
          {stats.popularWeekdays.map((w) => (
            <BarRow key={w.weekday} label={w.weekday} count={w.count} max={maxWeekdayCount} />
          ))}
          {stats.popularWeekdays.length === 0 && (
            <p className="text-sage text-sm">Ingen data än.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-display uppercase text-base mb-3">
          Bokningar per vecka (senaste {stats.weeklyTrend.length})
        </h3>
        <div className="space-y-1.5">
          {stats.weeklyTrend.map((w) => (
            <BarRow key={w.week} label={w.week} count={w.count} max={maxWeekCount} />
          ))}
          {stats.weeklyTrend.length === 0 && (
            <p className="text-sage text-sm">Ingen data än.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ink/10 rounded-sm p-4 bg-paper-50">
      <p className="text-xs uppercase tracking-widest text-sage mb-1">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = Math.max(4, Math.round((count / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-paper-100 rounded-sm h-5 overflow-hidden">
        <div className="bg-gold h-full rounded-sm" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-sage w-8 text-right shrink-0">{count}</span>
    </div>
  );
}

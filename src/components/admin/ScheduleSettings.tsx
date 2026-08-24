"use client";

import { useEffect, useState } from "react";
import AdminRangeCalendar from "./AdminRangeCalendar";

type OpenPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  note: string;
};
type DateException = {
  id: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
  note: string;
};
type Conflict = {
  id: string;
  date: string;
  timeSlot: string;
  name: string;
  phone: string;
  partySize: number;
};

const WEEKDAYS = [
  { value: 1, label: "Mån" },
  { value: 2, label: "Tis" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lör" },
  { value: 0, label: "Sön" },
];

export default function ScheduleSettings() {
  const [periods, setPeriods] = useState<OpenPeriod[]>([]);
  const [exceptions, setExceptions] = useState<DateException[]>([]);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [panelMode, setPanelMode] = useState<"period" | "exception">("period");
  const [resetKey, setResetKey] = useState(0);

  const [periodWeekdays, setPeriodWeekdays] = useState<number[]>([2, 3, 5]);
  const [periodNote, setPeriodNote] = useState("");
  const [savingPeriod, setSavingPeriod] = useState(false);

  const [exceptionIsOpen, setExceptionIsOpen] = useState(false);
  const [exceptionNote, setExceptionNote] = useState("");
  const [savingException, setSavingException] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [loadingConflicts, setLoadingConflicts] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/schedule/periods").then((r) => r.json()),
      fetch("/api/admin/schedule/exceptions").then((r) => r.json()),
    ])
      .then(([p, e]) => {
        setPeriods(p);
        setExceptions(e);
      })
      .finally(() => setLoading(false));
  }

  function handleRangeSelected(start: string, end: string) {
    setRange({ start, end });
    setError(null);
    setConflicts(null);
    if (panelMode === "exception") {
      checkConflicts(start, end);
    }
  }

  function checkConflicts(start: string, end: string) {
    setLoadingConflicts(true);
    fetch(`/api/admin/schedule/conflicts?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then(setConflicts)
      .finally(() => setLoadingConflicts(false));
  }

  function toggleWeekday(w: number) {
    setPeriodWeekdays((cur) =>
      cur.includes(w) ? cur.filter((d) => d !== w) : [...cur, w]
    );
  }

  async function savePeriod() {
    if (!range) return;
    if (periodWeekdays.length === 0) {
      setError("Välj minst en veckodag.");
      return;
    }
    setSavingPeriod(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/schedule/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: range.start,
          endDate: range.end,
          weekdays: periodWeekdays,
          note: periodNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunde inte spara perioden.");
      setPeriodNote("");
      setRange(null);
      setResetKey((k) => k + 1);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setSavingPeriod(false);
    }
  }

  async function saveException() {
    if (!range) return;
    setSavingException(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/schedule/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: range.start,
          endDate: range.end,
          isOpen: exceptionIsOpen,
          note: exceptionNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunde inte spara undantaget.");
      setExceptionNote("");
      setRange(null);
      setConflicts(null);
      setResetKey((k) => k + 1);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setSavingException(false);
    }
  }

  async function deletePeriod(id: string) {
    if (!confirm("Ta bort den här perioden? Dagarna blir stängda igen om de inte täcks av en annan period.")) return;
    await fetch(`/api/admin/schedule/periods/${id}`, { method: "DELETE" });
    loadAll();
  }
  async function deleteException(id: string) {
    if (!confirm("Ta bort det här undantaget?")) return;
    await fetch(`/api/admin/schedule/exceptions/${id}`, { method: "DELETE" });
    loadAll();
  }

  function rangeLabel(start: string, end: string): string {
    const days =
      Math.round(
        (new Date(end + "T12:00:00Z").getTime() - new Date(start + "T12:00:00Z").getTime()) /
          86400000
      ) + 1;
    return start === end ? `${start} (1 dag)` : `${start} – ${end} (${days} dagar)`;
  }

  return (
    <div>
      <p className="text-sm text-sage mb-4 max-w-2xl">
        Restaurangen är <strong>stängd som standard</strong>. Lägg till en{" "}
        <strong>öppen period</strong> (t.ex. en termin) med vilka veckodagar
        som gäller inom den. Behöver ni ett undantag inuti en period (t.ex.
        en praktikvecka), markera datumen och skapa ett undantag istället.
      </p>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setPanelMode("period");
                setConflicts(null);
              }}
              className={`px-4 py-2 text-xs font-display uppercase tracking-wide rounded-sm border ${
                panelMode === "period" ? "bg-ink text-paper border-ink" : "border-ink/20"
              }`}
            >
              Ny öppen period
            </button>
            <button
              onClick={() => {
                setPanelMode("exception");
                if (range) checkConflicts(range.start, range.end);
              }}
              className={`px-4 py-2 text-xs font-display uppercase tracking-wide rounded-sm border ${
                panelMode === "exception" ? "bg-ink text-paper border-ink" : "border-ink/20"
              }`}
            >
              Nytt undantag
            </button>
          </div>

          <AdminRangeCalendar onRangeSelected={handleRangeSelected} resetKey={resetKey} />

          {range && (
            <div className="mt-4 border border-gold/40 bg-gold/10 rounded-sm p-4">
              <p className="text-sm font-medium mb-3">{rangeLabel(range.start, range.end)}</p>

              {panelMode === "period" ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-sage mb-2">
                      Öppna veckodagar inom perioden
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((w) => (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => toggleWeekday(w.value)}
                          className={[
                            "px-3 py-1.5 rounded-sm border text-sm font-medium",
                            periodWeekdays.includes(w.value)
                              ? "bg-ink text-paper border-ink"
                              : "border-ink/20 text-ink/50",
                          ].join(" ")}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block text-sm">
                    <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                      Anteckning (t.ex. &quot;HT2026&quot;)
                    </span>
                    <input
                      value={periodNote}
                      onChange={(e) => setPeriodNote(e.target.value)}
                      className="w-full border border-ink/20 rounded-sm px-3 py-2 bg-white"
                    />
                  </label>
                  <button
                    onClick={savePeriod}
                    disabled={savingPeriod}
                    className="px-5 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm disabled:opacity-40"
                  >
                    {savingPeriod ? "Sparar…" : "Spara period"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExceptionIsOpen(false)}
                      className={[
                        "px-4 py-2 rounded-sm border text-sm font-medium",
                        !exceptionIsOpen ? "bg-brick text-white border-brick" : "border-ink/20",
                      ].join(" ")}
                    >
                      Stängt
                    </button>
                    <button
                      type="button"
                      onClick={() => setExceptionIsOpen(true)}
                      className={[
                        "px-4 py-2 rounded-sm border text-sm font-medium",
                        exceptionIsOpen ? "bg-sage text-white border-sage" : "border-ink/20",
                      ].join(" ")}
                    >
                      Extra öppet
                    </button>
                  </div>
                  <label className="block text-sm">
                    <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                      Anteckning (t.ex. &quot;PRAO åk 2&quot;)
                    </span>
                    <input
                      value={exceptionNote}
                      onChange={(e) => setExceptionNote(e.target.value)}
                      className="w-full border border-ink/20 rounded-sm px-3 py-2 bg-white"
                    />
                  </label>

                  {loadingConflicts && (
                    <p className="text-xs text-sage font-mono">Kollar befintliga bokningar…</p>
                  )}
                  {!loadingConflicts && conflicts && conflicts.length > 0 && (
                    <div className="border border-brick/40 bg-brick/5 rounded-sm p-3">
                      <p className="text-sm text-brick font-medium mb-2">
                        {conflicts.length} befintliga bokningar i det här intervallet — avbokas
                        inte automatiskt:
                      </p>
                      <ul className="text-xs space-y-1">
                        {conflicts.slice(0, 10).map((c) => (
                          <li key={c.id}>
                            {c.date} kl {c.timeSlot} — {c.name} ({c.partySize} pers, {c.phone})
                          </li>
                        ))}
                      </ul>
                      {conflicts.length > 10 && (
                        <p className="text-xs text-sage mt-1">
                          …och {conflicts.length - 10} till.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={saveException}
                    disabled={savingException}
                    className="px-5 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm disabled:opacity-40"
                  >
                    {savingException ? "Sparar…" : "Spara undantag"}
                  </button>
                </div>
              )}

              {error && <p className="text-brick text-sm mt-3">{error}</p>}
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="font-display uppercase text-sm tracking-wide mb-3">Öppna perioder</h3>
            {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}
            {!loading && periods.length === 0 && (
              <p className="text-sage text-sm">
                Inga perioder ännu — bokningssidan visar inga lediga datum förrän ni lagt till en.
              </p>
            )}
            <div className="space-y-2">
              {periods.map((p) => (
                <div key={p.id} className="border border-ink/10 rounded-sm p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {p.startDate} – {p.endDate} {p.note && `· ${p.note}`}
                    </p>
                    <p className="text-xs text-sage">
                      {p.weekdays
                        .slice()
                        .sort()
                        .map((w) => WEEKDAYS.find((wd) => wd.value === w)?.label)
                        .join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => deletePeriod(p.id)}
                    className="text-brick underline decoration-dotted text-xs shrink-0"
                  >
                    Ta bort
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-display uppercase text-sm tracking-wide mb-3">Undantag</h3>
            {!loading && exceptions.length === 0 && (
              <p className="text-sage text-sm">Inga undantag ännu.</p>
            )}
            <div className="space-y-2">
              {exceptions.map((e) => (
                <div key={e.id} className="border border-ink/10 rounded-sm p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {e.startDate === e.endDate ? e.startDate : `${e.startDate} – ${e.endDate}`}{" "}
                      {e.note && `· ${e.note}`}
                    </p>
                    <p className="text-xs text-sage">
                      {e.isOpen ? "Extra öppet" : "Stängt"}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteException(e.id)}
                    className="text-brick underline decoration-dotted text-xs shrink-0"
                  >
                    Ta bort
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

const MONTH_NAMES = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function localDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}
function todayLocalStr(): string {
  const d = new Date();
  return localDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

type Props = {
  onRangeSelected: (start: string, end: string) => void;
  // Bumpa för att tvinga bort en pågående markering utifrån (t.ex. efter spara).
  resetKey?: number;
};

export default function AdminRangeCalendar({ onRangeSelected, resetKey }: Props) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  useEffect(() => {
    setRangeStart(null);
    setRangeEnd(null);
  }, [resetKey]);

  useEffect(() => {
    fetch(`/api/open-dates?year=${calendarMonth.year}&month=${calendarMonth.month + 1}`)
      .then((r) => r.json())
      .then((data: { openDates: string[] }) => setOpenDates(new Set(data.openDates ?? [])))
      .catch(() => setOpenDates(new Set()));
  }, [calendarMonth]);

  function handleClick(dateStr: string) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateStr);
      setRangeEnd(null);
      return;
    }
    const start = dateStr < rangeStart ? dateStr : rangeStart;
    const end = dateStr < rangeStart ? rangeStart : dateStr;
    setRangeEnd(end);
    onRangeSelected(start, end);
  }

  function goPrevMonth() {
    setCalendarMonth((cur) => {
      let { year, month } = cur;
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      return { year, month };
    });
  }
  function goNextMonth() {
    setCalendarMonth((cur) => {
      let { year, month } = cur;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      return { year, month };
    });
  }

  const { year, month } = calendarMonth;
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayLocalStr();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = localDateStr(year, month, day);
    const isOpen = openDates.has(dateStr);
    const isToday = dateStr === today;
    const inRange =
      rangeStart &&
      ((rangeEnd && dateStr >= rangeStart && dateStr <= rangeEnd) ||
        (!rangeEnd && dateStr === rangeStart));

    cells.push(
      <button
        type="button"
        key={dateStr}
        onClick={() => handleClick(dateStr)}
        className={[
          "relative aspect-square flex items-center justify-center rounded-sm text-sm font-semibold border transition-colors",
          inRange
            ? "bg-gold text-ink border-gold"
            : isOpen
            ? "bg-sage/15 text-ink border-transparent hover:border-gold"
            : "bg-white text-ink/50 border-transparent hover:border-gold",
        ].join(" ")}
      >
        {day}
        {isToday && !inRange && (
          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-gold" />
        )}
      </button>
    );
  }

  return (
    <div className="max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goPrevMonth}
          className="w-8 h-8 border border-ink/20 rounded-sm text-ink hover:border-ink/50"
        >
          ‹
        </button>
        <h3 className="font-display uppercase text-sm tracking-wide">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          type="button"
          onClick={goNextMonth}
          className="w-8 h-8 border border-ink/20 rounded-sm text-ink hover:border-ink/50"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["M", "T", "O", "T", "F", "L", "S"].map((d, i) => (
          <span key={i} className="text-center text-[10px] uppercase tracking-widest text-sage">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{cells}</div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-sage">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-sage/15 inline-block" /> Öppet idag
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-white border border-ink/10 inline-block" /> Stängt idag
        </span>
      </div>
      <p className="text-xs text-sage mt-2">
        {!rangeStart
          ? "Klicka en dag för att börja markera."
          : !rangeEnd
          ? "Klicka slutdagen (eller samma dag igen för en enda dag)."
          : null}
      </p>
    </div>
  );
}

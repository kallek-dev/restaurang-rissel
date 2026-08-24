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
function monthOf(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1 };
}

type Props = {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  // Admin-läge: alla dagar går att klicka (även stängda/förflutna,
  // nedtonade men inte spärrade), och man kan bläddra bakåt förbi
  // nuvarande månad — gästkalendern spärrar båda.
  allowAllDays?: boolean;
  // Kallas när användaren aktivt bläddrar med ‹ › (inte när kalendern
  // bara följer med ett redan valt datum). Används t.ex. för att växla
  // till månadsvy i admin när man bläddrar utan att klicka en dag.
  onMonthChange?: (year: number, month: number) => void;
};

export default function Calendar({ selectedDate, onSelect, allowAllDays, onMonthChange }: Props) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (selectedDate) return monthOf(selectedDate);
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [openDates, setOpenDates] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!selectedDate) return;
    const target = monthOf(selectedDate);
    setCalendarMonth((cur) =>
      cur.year === target.year && cur.month === target.month ? cur : target
    );
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    setOpenDates(null);
    fetch(`/api/open-dates?year=${calendarMonth.year}&month=${calendarMonth.month + 1}`)
      .then((r) => r.json())
      .then((data: { openDates: string[] }) => {
        if (!cancelled) setOpenDates(new Set(data.openDates ?? []));
      })
      .catch(() => {
        if (!cancelled) setOpenDates(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [calendarMonth]);

  function goPrevMonth() {
    setCalendarMonth((cur) => {
      let { year, month } = cur;
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      if (!allowAllDays) {
        const now = new Date();
        const isBeforeCurrentMonth =
          year < now.getFullYear() ||
          (year === now.getFullYear() && month < now.getMonth());
        if (isBeforeCurrentMonth) return cur;
      }
      onMonthChange?.(year, month);
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
      onMonthChange?.(year, month);
      return { year, month };
    });
  }

  const { year, month } = calendarMonth;
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mån=0 ... Sön=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayLocalStr();

  const canGoPrev =
    allowAllDays ||
    (() => {
      const now = new Date();
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      return !(
        prevYear < now.getFullYear() ||
        (prevYear === now.getFullYear() && prevMonth < now.getMonth())
      );
    })();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = localDateStr(year, month, day);
    const isPast = dateStr < today;
    const isOpenDay = openDates?.has(dateStr) ?? false;
    const isClosed = !isOpenDay;
    const disabled = allowAllDays ? false : isPast || isClosed;
    const muted = isPast || isClosed;
    const isToday = dateStr === today;
    const isSelected = selectedDate === dateStr;

    cells.push(
      <button
        type="button"
        key={dateStr}
        disabled={disabled || openDates === null}
        onClick={() => onSelect(dateStr)}
        className={[
          "relative aspect-square flex items-center justify-center rounded-sm text-sm font-semibold border transition-colors",
          disabled
            ? "text-ink/25 cursor-not-allowed border-transparent"
            : muted
            ? "text-ink/40 border-transparent hover:border-gold"
            : "border-transparent hover:border-gold text-ink",
          isSelected ? "bg-ink text-paper" : !disabled ? "bg-white" : "",
        ].join(" ")}
      >
        {day}
        {isToday && !isSelected && (
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
          disabled={!canGoPrev}
          className="w-8 h-8 border border-ink/20 rounded-sm text-ink disabled:opacity-25 disabled:cursor-not-allowed hover:border-ink/50"
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
          <span
            key={i}
            className="text-center text-[10px] uppercase tracking-widest text-sage"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{cells}</div>
      {openDates === null && (
        <p className="text-xs text-sage mt-2 font-mono">Laddar…</p>
      )}
    </div>
  );
}

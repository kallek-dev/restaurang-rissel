"use client";

import { useState } from "react";

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
function isSameOrAfterCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  return (
    year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth())
  );
}

type Props = {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  openDays: number[];
};

export default function Calendar({ selectedDate, onSelect, openDays }: Props) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  function goPrevMonth() {
    setCalendarMonth((cur) => {
      let { year, month } = cur;
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      if (!isSameOrAfterCurrentMonth(year, month)) return cur;
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
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mån=0 ... Sön=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayLocalStr();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = localDateStr(year, month, day);
    const weekday = new Date(year, month, day).getDay();
    const isPast = dateStr < today;
    const isClosed = !openDays.includes(weekday);
    const disabled = isPast || isClosed;
    const isToday = dateStr === today;
    const isSelected = selectedDate === dateStr;

    cells.push(
      <button
        type="button"
        key={dateStr}
        disabled={disabled}
        onClick={() => onSelect(dateStr)}
        className={[
          "relative aspect-square flex items-center justify-center rounded-sm text-sm font-semibold border transition-colors",
          disabled
            ? "text-ink/25 cursor-not-allowed border-transparent"
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
          disabled={
            !isSameOrAfterCurrentMonth(
              month === 0 ? year - 1 : year,
              month === 0 ? 11 : month - 1
            )
          }
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
    </div>
  );
}

"use client";

type Slot = { time: string; full: boolean };
type Group = { sitting: string; slots: Slot[] };

type Props = {
  groups: Group[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
  disabled?: boolean;
  // Om satt: klick på en FULL tid anropar detta (t.ex. för att ställa
  // sig i kö) istället för att bara vara inaktiv.
  onSelectFull?: (time: string) => void;
};

export default function SlotPicker({
  groups,
  selectedTime,
  onSelect,
  disabled,
  onSelectFull,
}: Props) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-sage">
        Inga tider tillgängliga den här dagen.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.sitting}>
          <p className="text-xs uppercase tracking-widest text-sage mb-2">
            {group.sitting}-passet
          </p>
          <div className="flex flex-wrap gap-2">
            {group.slots.map((slot) => {
              const selected = selectedTime === slot.time;
              const clickableFull = slot.full && !disabled && Boolean(onSelectFull);
              return (
                <button
                  type="button"
                  key={slot.time}
                  disabled={disabled || (slot.full && !clickableFull)}
                  onClick={() =>
                    slot.full ? onSelectFull?.(slot.time) : onSelect(slot.time)
                  }
                  title={clickableFull ? "Fullbokad — klicka för att ställa dig i kö" : undefined}
                  className={[
                    "px-4 py-2 rounded-sm border text-sm font-mono transition-colors",
                    slot.full
                      ? clickableFull
                        ? "border-ink/15 text-ink/40 line-through hover:border-gold hover:text-ink/70"
                        : "border-ink/10 text-ink/25 cursor-not-allowed line-through"
                      : disabled
                      ? "border-ink/10 text-ink/25 cursor-not-allowed"
                      : selected
                      ? "bg-gold text-ink border-gold"
                      : "border-ink/20 text-ink hover:border-gold bg-white",
                  ].join(" ")}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
          {onSelectFull && group.slots.some((s) => s.full) && (
            <p className="text-xs text-sage mt-1">
              Överstruken tid = fullbokad, klicka för att ställa dig i kö.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

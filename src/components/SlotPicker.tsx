"use client";

type Slot = { time: string; full: boolean };
type Group = { sitting: string; slots: Slot[] };

type Props = {
  groups: Group[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
  disabled?: boolean;
};

export default function SlotPicker({
  groups,
  selectedTime,
  onSelect,
  disabled,
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
              return (
                <button
                  type="button"
                  key={slot.time}
                  disabled={slot.full || disabled}
                  onClick={() => onSelect(slot.time)}
                  className={[
                    "px-4 py-2 rounded-sm border text-sm font-mono transition-colors",
                    slot.full || disabled
                      ? "border-ink/10 text-ink/25 cursor-not-allowed line-through"
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
        </div>
      ))}
    </div>
  );
}

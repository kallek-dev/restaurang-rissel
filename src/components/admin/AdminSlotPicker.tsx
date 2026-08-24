"use client";

type TableAvailability = { id: string; label: string; booked: number; total: number };
type AdminSlot = { time: string; tablesBooked: number; tableAvailability: TableAvailability[] };
type AdminSittingGroup = { sitting: string; slots: AdminSlot[] };

type TableType = { id: string; minPeople: number; seats: number };

type Props = {
  sittingGroups: AdminSittingGroup[];
  tableTypes: TableType[];
  partySize: number;
  selectedTime: string | null;
  onSelect: (time: string) => void;
};

export default function AdminSlotPicker({
  sittingGroups,
  tableTypes,
  partySize,
  selectedTime,
  onSelect,
}: Props) {
  const suitableTypeIds = tableTypes
    .filter((tt) => partySize >= tt.minPeople && partySize <= tt.seats)
    .map((tt) => tt.id);

  if (sittingGroups.length === 0) {
    return <p className="text-sm text-sage">Inga sittningar konfigurerade.</p>;
  }

  return (
    <div className="space-y-4">
      {sittingGroups.map((group) => (
        <div key={group.sitting}>
          <p className="text-xs uppercase tracking-widest text-sage mb-2">
            {group.sitting}-passet
          </p>
          <div className="flex flex-wrap gap-2">
            {group.slots.map((slot) => {
              const relevant = slot.tableAvailability.filter((t) =>
                suitableTypeIds.includes(t.id)
              );
              const remaining = relevant.reduce(
                (sum, t) => sum + Math.max(0, t.total - t.booked),
                0
              );
              const full = suitableTypeIds.length === 0 || remaining <= 0;
              const selected = selectedTime === slot.time;

              return (
                <button
                  type="button"
                  key={slot.time}
                  disabled={full}
                  onClick={() => onSelect(slot.time)}
                  title={slot.tableAvailability
                    .map((t) => `${t.label}: ${t.total - t.booked} av ${t.total} lediga`)
                    .join(" · ")}
                  className={[
                    "px-3 py-2 rounded-sm border text-left min-w-[92px]",
                    full
                      ? "border-ink/10 text-ink/25 cursor-not-allowed"
                      : selected
                      ? "bg-gold border-gold text-ink"
                      : "border-ink/20 bg-white hover:border-gold",
                  ].join(" ")}
                >
                  <span className="block font-mono text-sm">{slot.time}</span>
                  <span className="block text-[10px] uppercase tracking-widest opacity-70">
                    {full ? "Fullt" : `${remaining} lediga`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

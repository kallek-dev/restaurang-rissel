"use client";

type Props = {
  restaurantName: string;
  date: string | null; // "YYYY-MM-DD"
  timeSlot: string | null;
  partySize: number;
  name: string;
  reference?: string;
};

function formatDateLabel(dateStr: string | null): string {
  if (!dateStr) return "— — —";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "");
}

export default function TicketPreview({
  restaurantName,
  date,
  timeSlot,
  partySize,
  name,
  reference,
}: Props) {
  return (
    <div className="sticky top-6">
      <div className="ticket-notch bg-ink text-paper rounded-sm shadow-lg overflow-hidden border border-ink-700">
        <div className="px-6 pt-6 pb-4 border-b border-dashed border-paper/30">
          <p className="font-display uppercase tracking-[0.2em] text-xs text-gold">
            Bordsbiljett
          </p>
          <h3 className="font-display uppercase text-2xl tracking-wide mt-1">
            {restaurantName}
          </h3>
        </div>

        <div className="px-6 py-5 space-y-4 font-mono text-sm">
          <Row label="Dag" value={formatDateLabel(date)} />
          <Row label="Tid" value={timeSlot ?? "— — —"} />
          <Row
            label="Sällskap"
            value={`${partySize} ${partySize === 1 ? "PERS" : "PERS"}`}
          />
          <Row label="Namn" value={name || "— — —"} />
        </div>

        <div className="px-6 py-4 bg-ink-700 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-paper/60">
            Bokningsnr
          </span>
          <span className="font-mono text-gold text-sm tracking-wider">
            {reference ?? "väntar…"}
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-sage mt-3 px-4">
        Biljetten fylls i live medan du bokar — inget skickas förrän du
        trycker på &quot;Boka bord&quot;.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-paper/50 uppercase text-[11px] tracking-widest shrink-0">
        {label}
      </span>
      <span className="text-right truncate">{value}</span>
    </div>
  );
}

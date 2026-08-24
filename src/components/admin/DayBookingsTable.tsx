"use client";

export type Booking = {
  id: string;
  date: string;
  sitting: string;
  timeSlot: string;
  partySize: number;
  tableTypeId: string;
  name: string;
  email: string;
  phone: string;
  allergies: string;
  note: string;
  createdByAdmin: boolean;
  status: string;
};

export type TableType = {
  id: string;
  label: string;
  count: number;
};

type Props = {
  bookings: Booking[]; // redan filtrerat till EN dag
  sittings: string[]; // så tomma sittningar också visas
  tableTypes: TableType[];
  onEdit?: (booking: Booking) => void;
  // Utskriftsvänligt/läsläge — döljer Redigera/Avboka-kolumnen helt.
  readOnly?: boolean;
};

function tableTypeLabel(tableTypeId: string, tableTypes: TableType[]): string {
  if (tableTypeId === "manuell") return "Manuell";
  return tableTypes.find((tt) => tt.id === tableTypeId)?.label ?? tableTypeId;
}

export default function DayBookingsTable({
  bookings,
  sittings,
  tableTypes,
  onEdit,
  readOnly,
}: Props) {
  const active = bookings.filter((b) => b.status !== "cancelled");
  const colCount = readOnly ? 8 : 9;

  const sittingGroups = sittings.map((sitting) => {
    const list = active
      .filter((b) => b.sitting === sitting)
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    const capacity = tableTypes.map((tt) => {
      const booked = list.filter((b) => b.tableTypeId === tt.id).length;
      return { label: tt.label, booked, total: tt.count };
    });
    return { sitting, bookings: list, capacity };
  });

  return (
    <div className="overflow-x-auto border border-ink/10 rounded-sm">
      <table className="w-full text-sm">
        <thead className="bg-paper-100 text-left">
          <tr>
            <Th>Tid</Th>
            <Th>Namn</Th>
            <Th>Antal</Th>
            <Th>Bord</Th>
            <Th>Telefon</Th>
            <Th>Mail</Th>
            <Th>Allergier</Th>
            <Th>Anteckning</Th>
            {!readOnly && <Th></Th>}
          </tr>
        </thead>
        <tbody>
          {sittingGroups.map(({ sitting, bookings: list, capacity }) => (
            <SittingRows
              key={sitting}
              sitting={sitting}
              list={list}
              capacity={capacity}
              tableTypes={tableTypes}
              onEdit={onEdit}
              readOnly={readOnly}
              colCount={colCount}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SittingRows({
  sitting,
  list,
  capacity,
  tableTypes,
  onEdit,
  readOnly,
  colCount,
}: {
  sitting: string;
  list: Booking[];
  capacity: { label: string; booked: number; total: number }[];
  tableTypes: TableType[];
  onEdit?: (booking: Booking) => void;
  readOnly?: boolean;
  colCount: number;
}) {
  return (
    <>
      <tr className="border-t border-ink/10 bg-paper-50">
        <td colSpan={colCount} className="px-3 py-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/70">
              {sitting}-passet
            </span>
            <span className="text-xs text-sage">
              {capacity
                .map((c) => `${c.booked} av ${c.total} ${c.label.toLowerCase()}`)
                .join(" · ")}
            </span>
          </div>
        </td>
      </tr>
      {list.length === 0 ? (
        <tr className="border-t border-ink/5">
          <td colSpan={colCount} className="px-3 py-2 text-xs text-sage">
            Inga bokningar.
          </td>
        </tr>
      ) : (
        list.map((b) => (
          <tr key={b.id} className="border-t border-ink/5">
            <Td className="font-mono">{b.timeSlot}</Td>
            <Td>
              {b.name}
              {b.createdByAdmin && (
                <span className="ml-1 text-[10px] uppercase tracking-widest bg-gold/20 text-gold-700 px-1.5 py-0.5 rounded-sm">
                  Admin
                </span>
              )}
            </Td>
            <Td>{b.partySize}</Td>
            <Td>{tableTypeLabel(b.tableTypeId, tableTypes)}</Td>
            <Td>{b.phone}</Td>
            <Td>{b.email}</Td>
            <Td className="max-w-[160px] truncate" title={b.allergies}>
              {b.allergies || "—"}
            </Td>
            <Td className="max-w-[160px] truncate" title={b.note}>
              {b.note || "—"}
            </Td>
            {!readOnly && (
              <Td>
                <div className="flex gap-3 whitespace-nowrap">
                  <button
                    onClick={() => onEdit?.(b)}
                    className="text-ink underline decoration-dotted text-xs"
                  >
                    Redigera
                  </button>
                </div>
              </Td>
            )}
          </tr>
        ))
      )}
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs uppercase tracking-widest text-sage font-medium">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td className={`px-3 py-2 ${className ?? ""}`} title={title}>
      {children}
    </td>
  );
}

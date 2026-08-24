import { prisma } from "./prisma";

export type OpenPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  weekdays: number[]; // 0=sön ... 6=lör
  note: string;
};

export type DateException = {
  id: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
  note: string;
};

function toOpenPeriod(row: {
  id: string;
  startDate: string;
  endDate: string;
  weekdaysJson: string;
  note: string;
}): OpenPeriod {
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    weekdays: JSON.parse(row.weekdaysJson),
    note: row.note,
  };
}

function toDateException(row: {
  id: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
  note: string;
}): DateException {
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    isOpen: row.isOpen,
    note: row.note,
  };
}

export async function listOpenPeriods(): Promise<OpenPeriod[]> {
  const rows = await prisma.openPeriod.findMany({
    orderBy: { startDate: "asc" },
  });
  return rows.map(toOpenPeriod);
}

export async function createOpenPeriod(input: {
  startDate: string;
  endDate: string;
  weekdays: number[];
  note?: string;
}): Promise<OpenPeriod> {
  const row = await prisma.openPeriod.create({
    data: {
      startDate: input.startDate,
      endDate: input.endDate,
      weekdaysJson: JSON.stringify(input.weekdays),
      note: input.note ?? "",
    },
  });
  return toOpenPeriod(row);
}

export async function deleteOpenPeriod(id: string): Promise<void> {
  await prisma.openPeriod.delete({ where: { id } });
}

export async function listDateExceptions(): Promise<DateException[]> {
  const rows = await prisma.dateException.findMany({
    orderBy: { startDate: "asc" },
  });
  return rows.map(toDateException);
}

export async function createDateException(input: {
  startDate: string;
  endDate: string;
  isOpen: boolean;
  note?: string;
}): Promise<DateException> {
  const row = await prisma.dateException.create({
    data: {
      startDate: input.startDate,
      endDate: input.endDate,
      isOpen: input.isOpen,
      note: input.note ?? "",
    },
  });
  return toDateException(row);
}

export async function deleteDateException(id: string): Promise<void> {
  await prisma.dateException.delete({ where: { id } });
}

// Tidszonssäker veckodag för en "YYYY-MM-DD"-sträng (mitt på dagen i
// UTC undviker att sommar-/vintertid kan flytta datumet ett dygn fel).
function weekdayOfDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

// Kärnfunktionen: är ett specifikt datum öppet enligt schemat?
// 1. Ett undantag som täcker datumet vinner alltid (stängning eller
//    extra öppning).
// 2. Annars: ligger datumet i en öppen period, och är veckodagen en av
//    periodens öppna dagar?
// 3. Ligger datumet utanför alla perioder är det stängt, per automatik.
export async function isDateOpenBySchedule(dateStr: string): Promise<boolean> {
  const exception = await prisma.dateException.findFirst({
    where: { startDate: { lte: dateStr }, endDate: { gte: dateStr } },
  });
  if (exception) return exception.isOpen;

  const period = await prisma.openPeriod.findFirst({
    where: { startDate: { lte: dateStr }, endDate: { gte: dateStr } },
  });
  if (!period) return false;

  const weekdays: number[] = JSON.parse(period.weekdaysJson);
  return weekdays.includes(weekdayOfDateStr(dateStr));
}

// Effektiv variant för kalendervyer: vilka datum inom ett intervall är
// öppna? Hämtar bara perioder/undantag som överlappar intervallet en
// gång, istället för en databasfråga per dag.
export async function getOpenDatesInRange(
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const [periods, exceptions]: [
    { startDate: string; endDate: string; weekdaysJson: string }[],
    { startDate: string; endDate: string; isOpen: boolean }[]
  ] = await Promise.all([
    prisma.openPeriod.findMany({
      where: { startDate: { lte: endDate }, endDate: { gte: startDate } },
    }),
    prisma.dateException.findMany({
      where: { startDate: { lte: endDate }, endDate: { gte: startDate } },
    }),
  ]);

  const openDates = new Set<string>();
  let cursor = startDate;
  let guard = 0;
  while (cursor <= endDate && guard < 3660) {
    guard++;
    const exception = exceptions.find(
      (e: { startDate: string; endDate: string; isOpen: boolean }) =>
        e.startDate <= cursor && cursor <= e.endDate
    );
    let open: boolean;
    if (exception) {
      open = exception.isOpen;
    } else {
      const period = periods.find(
        (p: { startDate: string; endDate: string; weekdaysJson: string }) =>
          p.startDate <= cursor && cursor <= p.endDate
      );
      if (!period) {
        open = false;
      } else {
        const weekdays: number[] = JSON.parse(period.weekdaysJson);
        open = weekdays.includes(weekdayOfDateStr(cursor));
      }
    }
    if (open) openDates.add(cursor);
    cursor = addDaysStr(cursor, 1);
  }
  return openDates;
}

// Bokningar som redan finns inom ett datumintervall — används för att
// varna admin om en ny stängning skulle krocka med befintliga bokningar.
export async function getBookingConflictsInRange(
  startDate: string,
  endDate: string
) {
  return prisma.booking.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: "confirmed",
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });
}

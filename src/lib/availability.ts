import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings, AppSettings, TableType } from "./settings";
import { sendBookingConfirmation, sendBookingUpdated } from "./email";
import { formatInTimeZone } from "date-fns-tz";

const TIMEZONE = "Europe/Stockholm";

export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

export function todayInStockholm(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function weekdayOf(dateStr: string): number {
  // dateStr: "YYYY-MM-DD" — tolkas i restaurangens tidszon.
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12)); // mitt på dagen undviker DST-kantfall
  return date.getUTCDay();
}

export function isDateOpen(dateStr: string, settings: AppSettings): boolean {
  if (!settings.systemOpen) return false;
  if (dateStr < todayInStockholm()) return false;
  const weekday = weekdayOf(dateStr);
  return settings.openDays.includes(weekday);
}

// Delslottarna (kvartar) inom EN sittning, t.ex. sitting="11:30" med
// sittingWindowMinutes=60 och slotIntervalMinutes=15 ger
// ["11:30","11:45","12:00","12:15"]. Gästen väljer en av dessa exakta
// tider direkt — sittningen ("11:30") är bara rubriken de grupperas
// under i gränssnittet.
function generateSubSlotsForSitting(
  sitting: string,
  settings: AppSettings
): string[] {
  const base = parseTimeToMinutes(sitting);
  const slots: string[] = [];
  for (
    let offset = 0;
    offset < settings.sittingWindowMinutes;
    offset += settings.slotIntervalMinutes
  ) {
    slots.push(minutesToTime(base + offset));
  }
  return slots;
}

// Vilken sittning en given exakt tid hör till, t.ex. "11:45" -> "11:30".
function findSittingForTime(
  time: string,
  settings: AppSettings
): string | null {
  for (const sitting of settings.sittings) {
    if (generateSubSlotsForSitting(sitting, settings).includes(time)) {
      return sitting;
    }
  }
  return null;
}

export function getOpenSittings(
  dateStr: string,
  settings: AppSettings
): string[] {
  if (!isDateOpen(dateStr, settings)) return [];
  return settings.sittings;
}

export type SlotAvailability = {
  time: string;
  full: boolean;
};

export type SittingGroup = {
  sitting: string;
  slots: SlotAvailability[];
};

export type DateAvailability = {
  date: string;
  open: boolean;
  sittingGroups: SittingGroup[];
};

// Returnerar tillgängliga tider grupperade under respektive sittning,
// så gästen väljer exakt tid men ser den grupperad under t.ex.
// "11:30-passet" / "12:30-passet" i gränssnittet.
export async function getAvailabilityForDate(
  dateStr: string,
  excludeBookingId?: string
): Promise<DateAvailability> {
  const settings = await getSettings();
  const openSittings = getOpenSittings(dateStr, settings);

  if (openSittings.length === 0) {
    return { date: dateStr, open: false, sittingGroups: [] };
  }

  const bookings: { timeSlot: string; tableTypeId: string }[] =
    await prisma.booking.findMany({
      where: {
        date: dateStr,
        status: "confirmed",
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { timeSlot: true, tableTypeId: true },
    });

  const sittingGroups: SittingGroup[] = openSittings.map((sitting) => {
    const subSlots = generateSubSlotsForSitting(sitting, settings);

    const slots: SlotAvailability[] = subSlots.map((time) => {
      const slotBookings = bookings.filter((b) => b.timeSlot === time);
      const tablesBooked = slotBookings.length;

      const tableAvailability: Record<string, number> = {};
      for (const tt of settings.tableTypes) {
        const bookedOfType = slotBookings.filter(
          (b) => b.tableTypeId === tt.id
        ).length;
        tableAvailability[tt.id] = Math.max(0, tt.count - bookedOfType);
      }

      const full =
        tablesBooked >= settings.maxTablesPerSlot ||
        tablesBooked >= settings.maxPartiesPerSlot ||
        Object.values(tableAvailability).every((n) => n <= 0);

      return { time, full };
    });

    return { sitting, slots };
  });

  return { date: dateStr, open: true, sittingGroups };
}

// Väljer minsta bordstyp som rymmer sällskapet och som har lediga bord kvar.
function pickTableType(
  partySize: number,
  tableTypes: TableType[],
  remainingByType: Record<string, number>
): TableType | null {
  const candidates = tableTypes
    .filter((t) => partySize >= t.minPeople && partySize <= t.seats)
    .sort((a, b) => a.seats - b.seats);

  for (const candidate of candidates) {
    if ((remainingByType[candidate.id] ?? 0) > 0) return candidate;
  }
  return null;
}

// Kontrollerar att EN specifik tid har plats och väljer bordstyp åt
// sällskapet. Måste köras inuti en transaktion (tx) för att vara
// krockfri mot samtidiga bokningar. `excludeBookingId` används vid
// ändring av en egen bokning, så dess nuvarande plats inte räknas emot
// gästen själv.
async function checkSlotAndPickTableType(
  tx: Prisma.TransactionClient,
  date: string,
  timeSlot: string,
  partySize: number,
  settings: AppSettings,
  excludeBookingId?: string
): Promise<TableType> {
  const existing: { tableTypeId: string }[] = await tx.booking.findMany({
    where: {
      date,
      timeSlot,
      status: "confirmed",
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { tableTypeId: true },
  });

  if (existing.length >= settings.maxTablesPerSlot) {
    throw new BookingError("Den tiden är tyvärr fullbokad. Välj en annan tid.");
  }
  if (existing.length >= settings.maxPartiesPerSlot) {
    throw new BookingError(
      "Max antal sällskap för den tiden är nått. Välj en annan tid."
    );
  }

  const remainingByType: Record<string, number> = {};
  for (const tt of settings.tableTypes) {
    const bookedOfType = existing.filter(
      (b) => b.tableTypeId === tt.id
    ).length;
    remainingByType[tt.id] = Math.max(0, tt.count - bookedOfType);
  }

  const tableType = pickTableType(
    partySize,
    settings.tableTypes,
    remainingByType
  );
  if (!tableType) {
    throw new BookingError(
      "Inga lediga bord för det antalet personer på den valda tiden. Välj en annan tid."
    );
  }

  return tableType;
}

function validateBookingInput(
  date: string,
  timeSlot: string,
  partySize: number,
  allergies: string,
  allergyConsent: boolean | undefined,
  settings: AppSettings
): string {
  if (!isDateOpen(date, settings)) {
    throw new BookingError(
      "Det går tyvärr inte att boka den här dagen. Välj en annan dag."
    );
  }
  const sitting = findSittingForTime(timeSlot, settings);
  if (!sitting) {
    throw new BookingError("Den valda tiden är inte längre giltig.");
  }
  if (partySize < 1) {
    throw new BookingError("Antal personer måste vara minst 1.");
  }
  if (partySize > settings.maxOnlinePartySize) {
    throw new BookingError(
      `Sällskap på fler än ${settings.maxOnlinePartySize} personer bokas via mail, inte i systemet.`
    );
  }
  if (allergies.length > 0 && !allergyConsent) {
    throw new BookingError(
      "Bocka i samtycket om du fyller i allergier eller andra önskemål — annars kan vi inte spara den uppgiften."
    );
  }
  return sitting;
}

export type CreateBookingInput = {
  date: string;
  timeSlot: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  allergies?: string;
  allergyConsent?: boolean;
};

export async function createBooking(input: CreateBookingInput) {
  const settings = await getSettings();
  const allergies = (input.allergies ?? "").trim();

  const sitting = validateBookingInput(
    input.date,
    input.timeSlot,
    input.partySize,
    allergies,
    input.allergyConsent,
    settings
  );

  // Transaktion: läs aktuell beläggning och skapa bokningen atomärt,
  // så att två samtidiga bokningar inte kan slå ut samma sista bord.
  const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tableType = await checkSlotAndPickTableType(
      tx,
      input.date,
      input.timeSlot,
      input.partySize,
      settings
    );

    return tx.booking.create({
      data: {
        date: input.date,
        sitting,
        timeSlot: input.timeSlot,
        partySize: input.partySize,
        tableTypeId: tableType.id,
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        allergies,
        allergyConsent: allergies.length > 0 ? Boolean(input.allergyConsent) : false,
        cancelToken: crypto.randomBytes(20).toString("hex"),
      },
    });
  });

  // Mailet skickas efter att transaktionen gått igenom, så ett
  // mailfel aldrig kan rulla tillbaka en giltig bokning.
  try {
    await sendBookingConfirmation(booking, settings);
  } catch (err) {
    console.error("Kunde inte skicka bekräftelsemail:", err);
  }

  return booking;
}

// Självbetjänad avbokning via länken i mailet. Kräver rätt cancelToken,
// annars går det inte att avboka någon annans bokning genom att gissa id.
export async function cancelBookingByToken(id: string, token: string) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.cancelToken !== token) {
    throw new BookingError("Bokningen kunde inte hittas.");
  }
  if (booking.status === "cancelled") {
    return booking;
  }
  return prisma.booking.update({
    where: { id },
    data: { status: "cancelled" },
  });
}

export type UpdateBookingInput = CreateBookingInput;

// Självbetjänad ändring via samma unika länk. Kräver rätt cancelToken,
// och exkluderar bokningens egen nuvarande plats ur beläggnings-
// räkningen, så gästen inte blockeras av sig själv.
export async function updateBookingByToken(
  id: string,
  token: string,
  input: UpdateBookingInput
) {
  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing || existing.cancelToken !== token) {
    throw new BookingError("Bokningen kunde inte hittas.");
  }
  if (existing.status === "cancelled") {
    throw new BookingError(
      "Den här bokningen är avbokad och kan inte längre ändras."
    );
  }

  const settings = await getSettings();
  const allergies = (input.allergies ?? "").trim();

  const sitting = validateBookingInput(
    input.date,
    input.timeSlot,
    input.partySize,
    allergies,
    input.allergyConsent,
    settings
  );

  const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tableType = await checkSlotAndPickTableType(
      tx,
      input.date,
      input.timeSlot,
      input.partySize,
      settings,
      id
    );

    return tx.booking.update({
      where: { id },
      data: {
        date: input.date,
        sitting,
        timeSlot: input.timeSlot,
        partySize: input.partySize,
        tableTypeId: tableType.id,
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        allergies,
        allergyConsent: allergies.length > 0 ? Boolean(input.allergyConsent) : false,
        reminderSentAt: null, // ny tid -> ny påminnelse ska gå ut igen
      },
    });
  });

  try {
    await sendBookingUpdated(booking, settings);
  } catch (err) {
    console.error("Kunde inte skicka ändringsmail:", err);
  }

  return booking;
}

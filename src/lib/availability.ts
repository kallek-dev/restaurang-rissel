import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings, AppSettings, TableType } from "./settings";
import { sendBookingConfirmation } from "./email";
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

export function generateSlotsForDate(
  dateStr: string,
  settings: AppSettings
): string[] {
  if (!isDateOpen(dateStr, settings)) return [];

  const slots = new Set<string>();
  for (const sitting of settings.sittings) {
    const base = parseTimeToMinutes(sitting);
    for (
      let offset = 0;
      offset < settings.sittingWindowMinutes;
      offset += settings.slotIntervalMinutes
    ) {
      slots.add(minutesToTime(base + offset));
    }
  }
  return Array.from(slots).sort();
}

export type SlotAvailability = {
  time: string;
  tablesBooked: number;
  partiesBooked: number;
  tableAvailability: Record<string, number>; // tableTypeId -> lediga bord
  full: boolean;
};

export type DateAvailability = {
  date: string;
  open: boolean;
  slots: SlotAvailability[];
};

export async function getAvailabilityForDate(
  dateStr: string
): Promise<DateAvailability> {
  const settings = await getSettings();
  const slotTimes = generateSlotsForDate(dateStr, settings);

  if (slotTimes.length === 0) {
    return { date: dateStr, open: false, slots: [] };
  }

  const bookings: { timeSlot: string; tableTypeId: string }[] =
    await prisma.booking.findMany({
      where: { date: dateStr, status: "confirmed" },
      select: { timeSlot: true, tableTypeId: true },
    });

  const slots: SlotAvailability[] = slotTimes.map((time) => {
    const slotBookings = bookings.filter(
      (b: { timeSlot: string; tableTypeId: string }) => b.timeSlot === time
    );
    const tablesBooked = slotBookings.length;
    const partiesBooked = slotBookings.length;

    const tableAvailability: Record<string, number> = {};
    for (const tt of settings.tableTypes) {
      const bookedOfType = slotBookings.filter(
        (b: { timeSlot: string; tableTypeId: string }) =>
          b.tableTypeId === tt.id
      ).length;
      tableAvailability[tt.id] = Math.max(0, tt.count - bookedOfType);
    }

    const full =
      tablesBooked >= settings.maxTablesPerSlot ||
      partiesBooked >= settings.maxPartiesPerSlot ||
      Object.values(tableAvailability).every((n) => n <= 0);

    return { time, tablesBooked, partiesBooked, tableAvailability, full };
  });

  return { date: dateStr, open: true, slots };
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

  if (!isDateOpen(input.date, settings)) {
    throw new BookingError(
      "Det går tyvärr inte att boka den här dagen. Välj en annan dag."
    );
  }

  const validSlots = generateSlotsForDate(input.date, settings);
  if (!validSlots.includes(input.timeSlot)) {
    throw new BookingError("Den valda tiden är inte längre giltig.");
  }

  if (input.partySize < 1) {
    throw new BookingError("Antal personer måste vara minst 1.");
  }

  if (input.partySize > settings.maxOnlinePartySize) {
    throw new BookingError(
      `Sällskap på fler än ${settings.maxOnlinePartySize} personer bokas via mail, inte i systemet.`
    );
  }

  const allergies = (input.allergies ?? "").trim();
  if (allergies.length > 0 && !input.allergyConsent) {
    throw new BookingError(
      "Bocka i samtycket om du fyller i allergier eller andra önskemål — annars kan vi inte spara den uppgiften."
    );
  }

  // Transaktion: läs aktuell beläggning och skapa bokningen atomärt,
  // så att två samtidiga bokningar inte kan slå ut samma sista bord.
  const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing: { tableTypeId: string }[] = await tx.booking.findMany({
      where: { date: input.date, timeSlot: input.timeSlot, status: "confirmed" },
      select: { tableTypeId: true },
    });

    if (existing.length >= settings.maxTablesPerSlot) {
      throw new BookingError(
        "Den tiden är tyvärr fullbokad. Välj en annan tid."
      );
    }
    if (existing.length >= settings.maxPartiesPerSlot) {
      throw new BookingError(
        "Max antal sällskap för den tiden är nått. Välj en annan tid."
      );
    }

    const remainingByType: Record<string, number> = {};
    for (const tt of settings.tableTypes) {
      const bookedOfType = existing.filter(
        (b: { tableTypeId: string }) => b.tableTypeId === tt.id
      ).length;
      remainingByType[tt.id] = Math.max(0, tt.count - bookedOfType);
    }

    const tableType = pickTableType(
      input.partySize,
      settings.tableTypes,
      remainingByType
    );

    if (!tableType) {
      throw new BookingError(
        "Inga lediga bord för det antalet personer på den valda tiden. Välj en annan tid."
      );
    }

    return tx.booking.create({
      data: {
        date: input.date,
        timeSlot: input.timeSlot,
        partySize: input.partySize,
        tableTypeId: tableType.id,
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        allergies,
        allergyConsent: allergies.length > 0 ? Boolean(input.allergyConsent) : false,
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

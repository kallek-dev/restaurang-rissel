import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings, AppSettings, TableType } from "./settings";
import { isDateOpenBySchedule } from "./schedule";
import {
  sendBookingConfirmation,
  sendBookingUpdated,
  sendGroupRequestReceived,
  sendWaitlistSpotAvailable,
} from "./email";
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

// Är ett datum öppet för bokning? Kollar systemets huvudbrytare, att
// datumet inte redan passerat, och sedan det faktiska schemat (öppna
// perioder + undantag, se schedule.ts) — inte längre en fast veckoregel.
export async function isDateOpen(
  dateStr: string,
  settings: AppSettings
): Promise<boolean> {
  if (!settings.systemOpen) return false;
  if (dateStr < todayInStockholm()) return false;
  return isDateOpenBySchedule(dateStr);
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

export async function getOpenSittings(
  dateStr: string,
  settings: AppSettings
): Promise<string[]> {
  if (!(await isDateOpen(dateStr, settings))) return [];
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
//
// Om partySize anges räknas en tid som fullbokad om INTE en bordstyp
// som rymmer just det sällskapet har plats kvar (korrekt per sällskap).
// Utan partySize räknas en tid som fullbokad först när INGEN bordstyp
// alls har plats kvar (grovare, används innan gästen valt antal).
export async function getAvailabilityForDate(
  dateStr: string,
  options?: { excludeBookingId?: string; partySize?: number }
): Promise<DateAvailability> {
  const settings = await getSettings();
  const openSittings = await getOpenSittings(dateStr, settings);

  if (openSittings.length === 0) {
    return { date: dateStr, open: false, sittingGroups: [] };
  }

  const bookings: { timeSlot: string; tableTypeId: string }[] =
    await prisma.booking.findMany({
      where: {
        date: dateStr,
        status: "confirmed",
        ...(options?.excludeBookingId
          ? { id: { not: options.excludeBookingId } }
          : {}),
      },
      select: { timeSlot: true, tableTypeId: true },
    });

  const relevantTypes = settings.tableTypes.filter((tt) =>
    options?.partySize
      ? options.partySize >= tt.minPeople && options.partySize <= tt.seats
      : true
  );

  const sittingGroups: SittingGroup[] = openSittings.map((sitting) => {
    const subSlots = generateSubSlotsForSitting(sitting, settings);

    const slots: SlotAvailability[] = subSlots.map((time) => {
      const slotBookings = bookings.filter((b) => b.timeSlot === time);
      const tablesBooked = slotBookings.length;

      const tableAvailability: Record<string, number> = {};
      for (const tt of relevantTypes) {
        const bookedOfType = slotBookings.filter(
          (b) => b.tableTypeId === tt.id
        ).length;
        const byStock = tt.count - bookedOfType;
        const byOwnCap =
          tt.maxPerSlot !== undefined ? tt.maxPerSlot - bookedOfType : Infinity;
        tableAvailability[tt.id] = Math.max(0, Math.min(byStock, byOwnCap));
      }

      const full =
        tablesBooked >= settings.maxTablesPerSlot ||
        relevantTypes.length === 0 ||
        Object.values(tableAvailability).every((n) => n <= 0);

      return { time, full };
    });

    return { sitting, slots };
  });

  return { date: dateStr, open: true, sittingGroups };
}

export type AdminSlotCapacity = {
  time: string;
  tablesBooked: number;
  tableAvailability: { id: string; label: string; booked: number; total: number }[];
};

export type AdminSittingCapacity = {
  sitting: string;
  slots: AdminSlotCapacity[];
};

export type AdminDayCapacity = {
  date: string;
  open: boolean;
  sittingGroups: AdminSittingCapacity[];
};

// Full numerisk kapacitetsöversikt för admin (inte gästsidan) — exakt
// antal bokade/lediga bord per typ och tid, för att snabbt se dagens
// läge utan att räkna manuellt i bokningslistan. `excludeBookingId`
// används vid redigering, så en bokning inte räknas emot sig själv.
export async function getAdminCapacityForDate(
  dateStr: string,
  excludeBookingId?: string
): Promise<AdminDayCapacity> {
  const settings = await getSettings();
  // Kapacitetsöversikten ska funka även för dagar som är formellt
  // "stängda" (t.ex. om admin manuellt bokat in något ändå), så vi
  // frågar bara vilka sittningar som är konfigurerade — men "open"-
  // fältet nedan visar det faktiska schemaläget för dagen.
  const sittings = settings.sittings;

  const bookings: { timeSlot: string; tableTypeId: string }[] =
    await prisma.booking.findMany({
      where: {
        date: dateStr,
        status: "confirmed",
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { timeSlot: true, tableTypeId: true },
    });

  const sittingGroups: AdminSittingCapacity[] = sittings.map((sitting) => {
    const subSlots = generateSubSlotsForSitting(sitting, settings);

    const slots: AdminSlotCapacity[] = subSlots.map((time) => {
      const slotBookings = bookings.filter((b) => b.timeSlot === time);
      const tableAvailability = settings.tableTypes.map((tt) => {
        const booked = slotBookings.filter((b) => b.tableTypeId === tt.id).length;
        const total = tt.maxPerSlot !== undefined ? Math.min(tt.count, tt.maxPerSlot) : tt.count;
        return { id: tt.id, label: tt.label, booked, total };
      });
      return { time, tablesBooked: slotBookings.length, tableAvailability };
    });

    return { sitting, slots };
  });

  const isOpen = await isDateOpenBySchedule(dateStr);
  return { date: dateStr, open: isOpen, sittingGroups };
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

// Delad kärnlogik: givet redan bokade bord i ett kvart, vilken bordstyp
// (om någon) kan ta emot sällskapet? Delas mellan den transaktionella
// kontrollen vid faktisk bokning och den icke-transaktionella "skulle
// det få plats"-koll som väntelistan använder.
function chooseTableTypeForSlot(
  existing: { tableTypeId: string }[],
  partySize: number,
  settings: AppSettings
): TableType | null {
  if (existing.length >= settings.maxTablesPerSlot) return null;

  const remainingByType: Record<string, number> = {};
  for (const tt of settings.tableTypes) {
    const bookedOfType = existing.filter((b) => b.tableTypeId === tt.id).length;
    const byStock = tt.count - bookedOfType;
    const byOwnCap =
      tt.maxPerSlot !== undefined ? tt.maxPerSlot - bookedOfType : Infinity;
    remainingByType[tt.id] = Math.max(0, Math.min(byStock, byOwnCap));
  }
  return pickTableType(partySize, settings.tableTypes, remainingByType);
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

  const tableType = chooseTableTypeForSlot(existing, partySize, settings);
  if (!tableType) {
    if (existing.length >= settings.maxTablesPerSlot) {
      throw new BookingError("Den tiden är tyvärr fullbokad. Välj en annan tid.");
    }
    throw new BookingError(
      "Inga lediga bord för det antalet personer på den valda tiden. Välj en annan tid."
    );
  }
  return tableType;
}

// Icke-transaktionell "skulle det få plats"-koll, för väntelistan —
// en lätt race condition här är okej eftersom claimWaitlistSpot ändå
// gör en riktig, transaktionell kontroll när gästen faktiskt bokar.
async function slotHasRoomForPartySize(
  date: string,
  timeSlot: string,
  partySize: number,
  settings: AppSettings
): Promise<boolean> {
  const existing = await prisma.booking.findMany({
    where: { date, timeSlot, status: "confirmed" },
    select: { tableTypeId: true },
  });
  return chooseTableTypeForSlot(existing, partySize, settings) !== null;
}

async function validateBookingInput(
  date: string,
  timeSlot: string,
  partySize: number,
  allergies: string,
  allergyConsent: boolean | undefined,
  settings: AppSettings
): Promise<string> {
  if (!(await isDateOpen(date, settings))) {
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
  const email = input.email.trim();

  const sitting = await validateBookingInput(
    input.date,
    input.timeSlot,
    input.partySize,
    allergies,
    input.allergyConsent,
    settings
  );

  // Dubbelbokningsskydd: om exakt samma gäst just skickade in exakt
  // samma bokning (dubbelklick, eller "tillbaka" i webbläsaren och
  // skicka igen) för några minuter sen, skapa ingen dubblett — låtsas
  // att det gick bra och returnera den redan skapade bokningen.
  const recentDuplicate = await prisma.booking.findFirst({
    where: {
      date: input.date,
      timeSlot: input.timeSlot,
      email,
      partySize: input.partySize,
      status: "confirmed",
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recentDuplicate) return recentDuplicate;

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
        email,
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

// Meddelar den som väntat längst i kön för en tid, om deras sällskap nu
// får plats efter en avbokning. Meddelar bara EN i taget — nästa i kö
// får vänta på att den här personen tackar ja (eller på nästa avbokning).
async function notifyWaitlistOnCancellation(date: string, timeSlot: string) {
  const settings = await getSettings();
  const waiting = await prisma.waitlistEntry.findMany({
    where: { date, timeSlot, status: "waiting" },
    orderBy: { createdAt: "asc" },
  });

  for (const entry of waiting) {
    const hasRoom = await slotHasRoomForPartySize(
      date,
      timeSlot,
      entry.partySize,
      settings
    );
    if (hasRoom) {
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: "notified", notifiedAt: new Date() },
      });
      try {
        await sendWaitlistSpotAvailable(entry, settings);
      } catch (err) {
        console.error("Kunde inte skicka väntelistmail:", err);
      }
      return;
    }
  }
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
  const cancelled = await prisma.booking.update({
    where: { id },
    data: { status: "cancelled" },
  });
  notifyWaitlistOnCancellation(cancelled.date, cancelled.timeSlot).catch((err) =>
    console.error("Väntelista-notis misslyckades:", err)
  );
  return cancelled;
}

// Admin avbokar (från adminpanelen, inte via gästens egen länk).
export async function cancelBookingAsAdmin(id: string) {
  const cancelled = await prisma.booking.update({
    where: { id },
    data: { status: "cancelled" },
  });
  notifyWaitlistOnCancellation(cancelled.date, cancelled.timeSlot).catch((err) =>
    console.error("Väntelista-notis misslyckades:", err)
  );
  return cancelled;
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

  const sitting = await validateBookingInput(
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

export type AdminCreateBookingInput = {
  date: string;
  timeSlot: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  allergies?: string;
  allergyConsent?: boolean;
  note?: string;
  // Hoppar över den vanliga plats- och kapacitetskontrollen helt —
  // för sällskap som behöver en särskild bordslösning (t.ex.
  // ihopskjutna bord) som det automatiska systemet inte känner till.
  manual?: boolean;
};

// Admin kan boka in gäster direkt (telefonsamtal, eller en förfrågan
// från ett stort sällskap som bokats in). Till skillnad från
// createBooking gäller INTE maxOnlinePartySize här — admin får boka in
// sällskap av vilken storlek som helst. Datumets schema-status kollas
// inte heller i automatiskt läge på samma strikta sätt (admin kan boka
// in något administrativt även på en dag som formellt är stängd, om de
// aktivt vill det via manuellt läge).
export async function createBookingAsAdmin(input: AdminCreateBookingInput) {
  const settings = await getSettings();
  const allergies = (input.allergies ?? "").trim();
  const note = (input.note ?? "").trim();

  if (input.partySize < 1) {
    throw new BookingError("Antal personer måste vara minst 1.");
  }
  if (allergies.length > 0 && !input.allergyConsent) {
    throw new BookingError(
      "Bocka i samtycket om allergier ska sparas."
    );
  }

  let booking;

  if (input.manual) {
    const sitting = findSittingForTime(input.timeSlot, settings) ?? "manuell";
    booking = await prisma.booking.create({
      data: {
        date: input.date,
        sitting,
        timeSlot: input.timeSlot,
        partySize: input.partySize,
        tableTypeId: "manuell",
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        allergies,
        allergyConsent: allergies.length > 0 ? Boolean(input.allergyConsent) : false,
        note,
        createdByAdmin: true,
        cancelToken: crypto.randomBytes(20).toString("hex"),
      },
    });
  } else {
    if (!(await isDateOpen(input.date, settings))) {
      throw new BookingError("Det går inte att boka den här dagen.");
    }
    const sitting = findSittingForTime(input.timeSlot, settings);
    if (!sitting) {
      throw new BookingError("Ogiltig tid.");
    }

    booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          note,
          createdByAdmin: true,
          cancelToken: crypto.randomBytes(20).toString("hex"),
        },
      });
    });
  }

  try {
    await sendBookingConfirmation(booking, settings);
  } catch (err) {
    console.error("Kunde inte skicka bekräftelsemail:", err);
  }

  return booking;
}

export type CreateGroupRequestInput = {
  date: string;
  sitting: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  message?: string;
};

// Förfrågan från sällskap större än maxOnlinePartySize. Skapar ingen
// bokning direkt — admin bokar in det manuellt via "Förfrågningar" i
// adminpanelen, se createBookingAsAdmin.
export async function createGroupRequest(input: CreateGroupRequestInput) {
  if (input.partySize < 1) {
    throw new BookingError("Antal personer måste vara minst 1.");
  }

  const settings = await getSettings();

  const request = await prisma.groupRequest.create({
    data: {
      date: input.date,
      sitting: input.sitting,
      partySize: input.partySize,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      message: (input.message ?? "").trim(),
    },
  });

  try {
    await sendGroupRequestReceived(request, settings);
  } catch (err) {
    console.error("Kunde inte skicka mottagningsbekräftelse:", err);
  }

  return request;
}

export type UpdateGroupRequestInput = {
  date: string;
  sitting: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  message?: string;
};

// Redigerar en förfrågans EGNA fält — bara relevant om den ännu inte
// är kopplad till en riktig bokning (annars ska den riktiga bokningen
// redigeras istället, se AdminDashboard-logiken i gränssnittet).
export async function updateGroupRequest(
  id: string,
  input: UpdateGroupRequestInput
) {
  const existing = await prisma.groupRequest.findUnique({ where: { id } });
  if (!existing) {
    throw new BookingError("Förfrågan kunde inte hittas.");
  }
  if (existing.linkedBookingId) {
    throw new BookingError(
      "Den här förfrågan är redan kopplad till en bokning — redigera bokningen istället."
    );
  }
  if (input.partySize < 1) {
    throw new BookingError("Antal personer måste vara minst 1.");
  }

  return prisma.groupRequest.update({
    where: { id },
    data: {
      date: input.date,
      sitting: input.sitting,
      partySize: input.partySize,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      message: (input.message ?? "").trim(),
    },
  });
}

export type AdminUpdateBookingInput = {
  date: string;
  timeSlot: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  allergies?: string;
  allergyConsent?: boolean;
  note?: string;
  // Hoppar över kapacitetskontrollen helt, samma som vid manuell
  // nybokning — för ändringar som annars skulle blockeras (t.ex. att
  // byta ett vanligt bord mot en särskild lösning för ett stort sällskap).
  manual?: boolean;
};

// Admin redigerar en befintlig bokning (vilket fält som helst), utan
// krav på gästens cancelToken eftersom admin redan är autentiserad.
// Skickar samma ändringsmail till gästen som vid självbetjänad ändring.
export async function updateBookingAsAdmin(
  id: string,
  input: AdminUpdateBookingInput
) {
  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) {
    throw new BookingError("Bokningen kunde inte hittas.");
  }

  const settings = await getSettings();
  const allergies = (input.allergies ?? "").trim();
  const note = (input.note ?? "").trim();

  if (input.partySize < 1) {
    throw new BookingError("Antal personer måste vara minst 1.");
  }
  if (allergies.length > 0 && !input.allergyConsent) {
    throw new BookingError("Bocka i samtycket om allergier ska sparas.");
  }

  let booking;

  if (input.manual) {
    const sitting = findSittingForTime(input.timeSlot, settings) ?? "manuell";
    booking = await prisma.booking.update({
      where: { id },
      data: {
        date: input.date,
        sitting,
        timeSlot: input.timeSlot,
        partySize: input.partySize,
        tableTypeId: "manuell",
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        allergies,
        allergyConsent: allergies.length > 0 ? Boolean(input.allergyConsent) : false,
        note,
        reminderSentAt: null,
      },
    });
  } else {
    const sitting = findSittingForTime(input.timeSlot, settings);
    if (!sitting) {
      throw new BookingError("Ogiltig tid.");
    }

    booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          note,
          reminderSentAt: null,
        },
      });
    });
  }

  try {
    await sendBookingUpdated(booking, settings);
  } catch (err) {
    console.error("Kunde inte skicka ändringsmail:", err);
  }

  return booking;
}

export type JoinWaitlistInput = {
  date: string;
  timeSlot: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
};

// Gäst ställer sig i kö för en fullbokad tid.
export async function joinWaitlist(input: JoinWaitlistInput) {
  if (input.partySize < 1) {
    throw new BookingError("Antal personer måste vara minst 1.");
  }
  return prisma.waitlistEntry.create({
    data: {
      date: input.date,
      timeSlot: input.timeSlot,
      partySize: input.partySize,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      claimToken: crypto.randomBytes(20).toString("hex"),
    },
  });
}

// Gästen klickar länken i väntelist-mailet och slutför bokningen.
export async function claimWaitlistSpot(id: string, token: string) {
  const entry = await prisma.waitlistEntry.findUnique({ where: { id } });
  if (!entry || entry.claimToken !== token) {
    throw new BookingError("Kunde inte hittas.");
  }
  if (entry.status === "booked") {
    throw new BookingError("Den här platsen är redan bokad.");
  }

  const settings = await getSettings();
  if (!(await isDateOpen(entry.date, settings))) {
    throw new BookingError("Det går tyvärr inte att boka den här dagen längre.");
  }

  const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tableType = await checkSlotAndPickTableType(
      tx,
      entry.date,
      entry.timeSlot,
      entry.partySize,
      settings
    );
    return tx.booking.create({
      data: {
        date: entry.date,
        sitting: findSittingForTime(entry.timeSlot, settings) ?? "manuell",
        timeSlot: entry.timeSlot,
        partySize: entry.partySize,
        tableTypeId: tableType.id,
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        cancelToken: crypto.randomBytes(20).toString("hex"),
      },
    });
  });

  await prisma.waitlistEntry.update({
    where: { id },
    data: { status: "booked" },
  });

  try {
    await sendBookingConfirmation(booking, settings);
  } catch (err) {
    console.error("Kunde inte skicka bekräftelsemail:", err);
  }

  return booking;
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createBookingAsAdmin, BookingError } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = date;
  } else if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(bookings);
}

// Datum + N veckor, tidszonssäkert (mitt på dagen i UTC undviker att
// sommar-/vintertidsskiften kan flytta datumet ett dygn fel).
function addWeeks(dateStr: string, weeks: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + weeks * 7, 12));
  return date.toISOString().slice(0, 10);
}

const adminBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datum."),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, "Ogiltig tid."),
  partySize: z.number().int().min(1).max(500),
  name: z.string().trim().min(1, "Namn krävs.").max(120),
  email: z.string().trim().email("Ogiltig mailadress."),
  phone: z.string().trim().min(4, "Ogiltigt telefonnummer.").max(30),
  allergies: z.string().trim().max(1000).optional(),
  allergyConsent: z.boolean().optional().default(false),
  note: z.string().trim().max(500).optional(),
  manual: z.boolean().optional().default(false),
  repeatWeeks: z.number().int().min(1).max(12).optional().default(1),
  groupRequestId: z.string().optional(),
});

// Admin skapar en bokning manuellt — antingen med normal platskontroll
// (samma logik som gästflödet, fast utan storleksgräns) eller helt
// manuellt utan kontroll (för sällskap som behöver en särskild
// bordslösning). Stödjer att skapa flera separata veckovisa bokningar
// på en gång, och att koppla ihop med en gruppförfrågan.
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const parsed = adminBookingSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { repeatWeeks, groupRequestId, ...bookingInput } = parsed.data;

  const created: { id: string; date: string; timeSlot: string }[] = [];
  const failed: { date: string; error: string }[] = [];

  for (let i = 0; i < repeatWeeks; i++) {
    const date = i === 0 ? bookingInput.date : addWeeks(bookingInput.date, i);
    try {
      const booking = await createBookingAsAdmin({ ...bookingInput, date });
      created.push({
        id: booking.id,
        date: booking.date,
        timeSlot: booking.timeSlot,
      });
    } catch (err) {
      const message =
        err instanceof BookingError ? err.message : "Något gick fel.";
      failed.push({ date, error: message });
    }
  }

  if (groupRequestId && created.length > 0) {
    try {
      await prisma.groupRequest.update({
        where: { id: groupRequestId },
        data: { status: "handled", linkedBookingId: created[0].id },
      });
    } catch (err) {
      console.error("Kunde inte koppla bokning till förfrågan:", err);
    }
  }

  return NextResponse.json(
    { created, failed },
    { status: created.length > 0 ? 201 : 409 }
  );
}

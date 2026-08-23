import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { updateBookingByToken, BookingError } from "@/lib/availability";

export const dynamic = "force-dynamic";

// Visar bokningsuppgifter för "hantera bokning"-sidan. Kräver rätt
// cancelToken i query-strängen — utan den (eller med fel token) går det
// inte att se eller ändra någon annans bokning genom att bara gissa id.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Saknar token." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      date: true,
      sitting: true,
      timeSlot: true,
      partySize: true,
      name: true,
      email: true,
      phone: true,
      allergies: true,
      status: true,
      cancelToken: true,
    },
  });

  if (!booking || booking.cancelToken !== token) {
    return NextResponse.json(
      { error: "Bokningen kunde inte hittas." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    date: booking.date,
    sitting: booking.sitting,
    timeSlot: booking.timeSlot,
    partySize: booking.partySize,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    allergies: booking.allergies,
    status: booking.status,
  });
}

const updateSchema = z
  .object({
    token: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datum."),
    timeSlot: z.string().regex(/^\d{2}:\d{2}$/, "Ogiltig tid."),
    partySize: z.number().int().min(1).max(50),
    name: z.string().trim().min(1, "Namn krävs.").max(120),
    email: z.string().trim().email("Ogiltig mailadress."),
    phone: z.string().trim().min(4, "Ogiltigt telefonnummer.").max(30),
    allergies: z.string().trim().max(1000).optional(),
    allergyConsent: z.boolean().optional().default(false),
  })
  .refine((data) => !data.allergies || data.allergyConsent, {
    message:
      "Bocka i samtycket om du fyller i allergier eller andra önskemål.",
    path: ["allergyConsent"],
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const { token, ...input } = parsed.data;
    const booking = await updateBookingByToken(params.id, token, input);
    return NextResponse.json({
      date: booking.date,
      timeSlot: booking.timeSlot,
      partySize: booking.partySize,
      reference: booking.id.slice(-8).toUpperCase(),
    });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Fel vid ändring av bokning:", err);
    return NextResponse.json(
      { error: "Något gick fel. Försök igen om en stund." },
      { status: 500 }
    );
  }
}

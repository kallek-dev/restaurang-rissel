import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBooking, BookingError } from "@/lib/availability";

const bookingSchema = z
  .object({
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

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const booking = await createBooking(parsed.data);
    return NextResponse.json(
      {
        id: booking.id,
        date: booking.date,
        timeSlot: booking.timeSlot,
        partySize: booking.partySize,
        reference: booking.id.slice(-8).toUpperCase(),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Fel vid bokning:", err);
    return NextResponse.json(
      { error: "Något gick fel. Försök igen om en stund." },
      { status: 500 }
    );
  }
}

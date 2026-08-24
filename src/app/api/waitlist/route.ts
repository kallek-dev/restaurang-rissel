import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { joinWaitlist, BookingError } from "@/lib/availability";

const requestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datum."),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, "Ogiltig tid."),
  partySize: z.number().int().min(1).max(50),
  name: z.string().trim().min(1, "Namn krävs.").max(120),
  email: z.string().trim().email("Ogiltig mailadress."),
  phone: z.string().trim().min(4, "Ogiltigt telefonnummer.").max(30),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const entry = await joinWaitlist(parsed.data);
    return NextResponse.json({ id: entry.id }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Fel vid väntelista:", err);
    return NextResponse.json(
      { error: "Något gick fel. Försök igen om en stund." },
      { status: 500 }
    );
  }
}

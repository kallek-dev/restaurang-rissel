import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { updateBookingAsAdmin, BookingError } from "@/lib/availability";

const editSchema = z.object({
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
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  // Enkelt läge: bara { status } — används av "Avboka"-knappen i listorna.
  if (
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    Object.keys(body).length === 1
  ) {
    const status = (body as { status: unknown }).status;
    if (status !== "cancelled" && status !== "confirmed") {
      return NextResponse.json(
        { error: "Status måste vara 'cancelled' eller 'confirmed'." },
        { status: 400 }
      );
    }
    try {
      const updated = await prisma.booking.update({
        where: { id: params.id },
        data: { status },
      });
      return NextResponse.json(updated);
    } catch {
      return NextResponse.json(
        { error: "Bokningen kunde inte hittas." },
        { status: 404 }
      );
    }
  }

  // Fullständig redigering — alla fält.
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const updated = await updateBookingAsAdmin(params.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Fel vid redigering av bokning:", err);
    return NextResponse.json(
      { error: "Något gick fel. Försök igen om en stund." },
      { status: 500 }
    );
  }
}

// Riktig radering (inte avbokning) — permanent, kan inte ångras.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.booking.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Bokningen kunde inte hittas." },
      { status: 404 }
    );
  }
}

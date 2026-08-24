import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { updateGroupRequest, BookingError } from "@/lib/availability";

const editSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datum."),
  sitting: z.string().min(1),
  partySize: z.number().int().min(1).max(500),
  name: z.string().trim().min(1, "Namn krävs.").max(120),
  email: z.string().trim().email("Ogiltig mailadress."),
  phone: z.string().trim().min(4, "Ogiltigt telefonnummer.").max(30),
  message: z.string().trim().max(1000).optional(),
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

  // Enkelt läge: bara { status } — pending/handled/ångra.
  if (
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    Object.keys(body).length === 1
  ) {
    const status = (body as { status: unknown }).status;
    if (status !== "handled" && status !== "pending") {
      return NextResponse.json(
        { error: "Status måste vara 'handled' eller 'pending'." },
        { status: 400 }
      );
    }
    try {
      const updated = await prisma.groupRequest.update({
        where: { id: params.id },
        data: { status },
      });
      return NextResponse.json(updated);
    } catch {
      return NextResponse.json(
        { error: "Förfrågan kunde inte hittas." },
        { status: 404 }
      );
    }
  }

  // Fullständig redigering av förfrågans egna fält (bara tillåtet om
  // den inte redan bokats in, se updateGroupRequest).
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const updated = await updateGroupRequest(params.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Fel vid redigering av förfrågan:", err);
    return NextResponse.json(
      { error: "Något gick fel. Försök igen om en stund." },
      { status: 500 }
    );
  }
}

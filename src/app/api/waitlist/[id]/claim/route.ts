import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { claimWaitlistSpot, BookingError } from "@/lib/availability";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Saknar token." }, { status: 400 });
  }

  const entry = await prisma.waitlistEntry.findUnique({ where: { id: params.id } });
  if (!entry || entry.claimToken !== token) {
    return NextResponse.json({ error: "Kunde inte hittas." }, { status: 404 });
  }

  return NextResponse.json({
    date: entry.date,
    timeSlot: entry.timeSlot,
    partySize: entry.partySize,
    name: entry.name,
    status: entry.status,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }
  if (!body.token) {
    return NextResponse.json({ error: "Saknar token." }, { status: 400 });
  }

  try {
    const booking = await claimWaitlistSpot(params.id, body.token);
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
    console.error("Fel vid inbokning från väntelista:", err);
    return NextResponse.json(
      { error: "Något gick fel. Försök igen om en stund." },
      { status: 500 }
    );
  }
}

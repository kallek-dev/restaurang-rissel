import { NextRequest, NextResponse } from "next/server";
import { cancelBookingByToken, BookingError } from "@/lib/availability";

export const dynamic = "force-dynamic";

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
    await cancelBookingByToken(params.id, body.token);
    return NextResponse.json({ status: "cancelled" });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Fel vid avbokning:", err);
    return NextResponse.json(
      { error: "Något gick fel. Försök igen om en stund." },
      { status: 500 }
    );
  }
}

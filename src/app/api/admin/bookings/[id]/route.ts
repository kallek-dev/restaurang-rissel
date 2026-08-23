import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  if (body.status !== "cancelled" && body.status !== "confirmed") {
    return NextResponse.json(
      { error: "Status måste vara 'cancelled' eller 'confirmed'." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.booking.update({
      where: { id: params.id },
      data: { status: body.status },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Bokningen kunde inte hittas." },
      { status: 404 }
    );
  }
}

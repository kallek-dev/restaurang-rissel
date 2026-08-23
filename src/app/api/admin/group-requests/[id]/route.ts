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

  if (body.status !== "handled" && body.status !== "pending") {
    return NextResponse.json(
      { error: "Status måste vara 'handled' eller 'pending'." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.groupRequest.update({
      where: { id: params.id },
      data: { status: body.status },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Förfrågan kunde inte hittas." },
      { status: 404 }
    );
  }
}

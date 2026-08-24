import { NextResponse } from "next/server";
import { deleteDateException } from "@/lib/schedule";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteDateException(params.id);
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Undantaget kunde inte hittas." },
      { status: 404 }
    );
  }
}

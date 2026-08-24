import { NextResponse } from "next/server";
import { deleteOpenPeriod } from "@/lib/schedule";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteOpenPeriod(params.id);
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Perioden kunde inte hittas." },
      { status: 404 }
    );
  }
}

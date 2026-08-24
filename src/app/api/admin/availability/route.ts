import { NextRequest, NextResponse } from "next/server";
import { getAdminCapacityForDate } from "@/lib/availability";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const exclude = req.nextUrl.searchParams.get("exclude") ?? undefined;

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "Ogiltigt eller saknat datum (förväntar YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const capacity = await getAdminCapacityForDate(date, exclude);
  return NextResponse.json(capacity);
}

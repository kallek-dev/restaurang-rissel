import { NextRequest, NextResponse } from "next/server";
import { getBookingConflictsInRange } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");

  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return NextResponse.json(
      { error: "Ogiltigt eller saknat datumintervall." },
      { status: 400 }
    );
  }

  const conflicts = await getBookingConflictsInRange(start, end);
  return NextResponse.json(conflicts);
}

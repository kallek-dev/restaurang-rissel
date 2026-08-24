import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getOpenDatesInRange } from "@/lib/schedule";

export const dynamic = "force-dynamic";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ?year=2026&month=8 (1-indexerad månad, som i vanligt tal)
export async function GET(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year"));
  const month = Number(req.nextUrl.searchParams.get("month"));

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "Ogiltigt år eller månad." },
      { status: 400 }
    );
  }

  const settings = await getSettings();
  const startDate = `${year}-${pad2(month)}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;

  if (!settings.systemOpen) {
    return NextResponse.json({ openDates: [] });
  }

  const openDatesSet = await getOpenDatesInRange(startDate, endDate);
  const openDates = Array.from(openDatesSet).sort();

  return NextResponse.json({ openDates });
}

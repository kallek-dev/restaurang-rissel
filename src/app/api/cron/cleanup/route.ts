import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { todayInStockholm } from "@/lib/availability";
import { isCronAuthorized } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function subtractMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - months, d, 12));
  return date.toISOString().slice(0, 10);
}

// GDPR-städning: raderar bokningar (namn, mail, telefon, ev. allergier)
// som är äldre än Settings.retentionMonths. Kör dagligen via en
// cron-tjänst, se vercel.json. Se README → "GDPR".
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Ej behörig." }, { status: 401 });
  }

  const settings = await getSettings();
  const cutoff = subtractMonths(todayInStockholm(), settings.retentionMonths);

  const result = await prisma.booking.deleteMany({
    where: { date: { lt: cutoff } },
  });

  return NextResponse.json({
    cutoff,
    retentionMonths: settings.retentionMonths,
    deleted: result.count,
  });
}

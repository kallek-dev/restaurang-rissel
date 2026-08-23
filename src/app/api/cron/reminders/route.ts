import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendBookingReminder } from "@/lib/email";
import { todayInStockholm } from "@/lib/availability";
import { isCronAuthorized } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12));
  return date.toISOString().slice(0, 10);
}

// Skickar påminnelsemail för morgondagens bokningar.
// Kör dagligen via en cron-tjänst (t.ex. Vercel Cron), se vercel.json.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Ej behörig." }, { status: 401 });
  }

  const settings = await getSettings();
  const tomorrow = addDays(todayInStockholm(), 1);

  const bookings = await prisma.booking.findMany({
    where: {
      date: tomorrow,
      status: "confirmed",
      reminderSentAt: null,
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const booking of bookings) {
    try {
      await sendBookingReminder(booking, settings);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    } catch (err) {
      errors.push(booking.id);
      console.error(`Kunde inte skicka påminnelse för ${booking.id}:`, err);
    }
  }

  return NextResponse.json({
    date: tomorrow,
    candidates: bookings.length,
    sent,
    failed: errors,
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const all: {
    date: string;
    timeSlot: string;
    partySize: number;
    status: string;
    createdAt: Date;
  }[] = await prisma.booking.findMany({
    select: {
      date: true,
      timeSlot: true,
      partySize: true,
      status: true,
      createdAt: true,
    },
  });

  const confirmed = all.filter((b) => b.status === "confirmed");
  const cancelled = all.filter((b) => b.status === "cancelled");

  const totalBookings = all.length;
  const cancellationRate = totalBookings > 0 ? cancelled.length / totalBookings : 0;
  const avgPartySize =
    confirmed.length > 0
      ? confirmed.reduce((sum: number, b) => sum + b.partySize, 0) / confirmed.length
      : 0;

  // Populäraste tider (bland bekräftade bokningar).
  const timeCounts: Record<string, number> = {};
  for (const b of confirmed) {
    timeCounts[b.timeSlot] = (timeCounts[b.timeSlot] ?? 0) + 1;
  }
  const popularTimes = Object.entries(timeCounts)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Populäraste veckodagar.
  const weekdayLabels = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
  const weekdayCounts: Record<number, number> = {};
  for (const b of confirmed) {
    const [y, m, d] = b.date.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
    weekdayCounts[weekday] = (weekdayCounts[weekday] ?? 0) + 1;
  }
  const popularWeekdays = Object.entries(weekdayCounts)
    .map(([w, count]) => ({ weekday: weekdayLabels[Number(w)], count }))
    .sort((a, b) => b.count - a.count);

  // Bokningar per vecka, senaste 12 veckorna (trend).
  function mondayOf(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    const weekday = date.getUTCDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    date.setUTCDate(date.getUTCDate() + diff);
    return date.toISOString().slice(0, 10);
  }
  const weekCounts: Record<string, number> = {};
  for (const b of confirmed) {
    const wk = mondayOf(b.date);
    weekCounts[wk] = (weekCounts[wk] ?? 0) + 1;
  }
  const weeklyTrend = Object.entries(weekCounts)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);

  return NextResponse.json({
    totalBookings,
    confirmedCount: confirmed.length,
    cancelledCount: cancelled.length,
    cancellationRate,
    avgPartySize,
    popularTimes,
    popularWeekdays,
    weeklyTrend,
  });
}

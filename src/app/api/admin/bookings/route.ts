import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = date;
  } else if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(bookings);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBookingsWorkbook } from "@/lib/xlsxExport";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  const buffer = await buildBookingsWorkbook(bookings);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bokningar-rissel-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
    },
  });
}

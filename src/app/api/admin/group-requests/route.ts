import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  const requests = await prisma.groupRequest.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

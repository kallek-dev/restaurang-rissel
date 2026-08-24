import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await prisma.groupRequest.count({
    where: { status: "pending" },
  });
  return NextResponse.json({ count });
}

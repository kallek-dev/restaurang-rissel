import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

const tableTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  seats: z.number().int().min(1),
  minPeople: z.number().int().min(1),
  count: z.number().int().min(0),
  maxPerSlot: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  systemOpen: z.boolean().optional(),
  openDays: z.array(z.number().int().min(0).max(6)).optional(),
  sittings: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional(),
  sittingWindowMinutes: z.number().int().min(15).max(480).optional(),
  slotIntervalMinutes: z.number().int().min(5).max(120).optional(),
  maxTablesPerSlot: z.number().int().min(1).max(100).optional(),
  tableTypes: z.array(tableTypeSchema).optional(),
  maxOnlinePartySize: z.number().int().min(1).max(100).optional(),
  contactEmail: z.string().email().optional(),
  retentionMonths: z.number().int().min(1).max(120).optional(),
  restaurantName: z.string().min(1).max(200).optional(),
});

export async function PUT(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = await updateSettings(parsed.data);
  return NextResponse.json(updated);
}

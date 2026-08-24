import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listOpenPeriods, createOpenPeriod } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  const periods = await listOpenPeriods();
  return NextResponse.json(periods);
}

const createSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt startdatum."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt slutdatum."),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Välj minst en veckodag."),
  note: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.data.endDate < parsed.data.startDate) {
    return NextResponse.json(
      { error: "Slutdatum måste vara efter startdatum." },
      { status: 400 }
    );
  }

  const period = await createOpenPeriod(parsed.data);
  return NextResponse.json(period, { status: 201 });
}

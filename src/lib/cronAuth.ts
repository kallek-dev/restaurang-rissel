import { NextRequest } from "next/server";

// Delad behörighetskontroll för /api/cron/*-endpoints. Skyddar mot att
// vem som helst som hittar URL:en kan trigga jobbet manuellt.
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Om ingen hemlighet är satt körs jobbet öppet — sätt alltid
  // CRON_SECRET i produktion, se README → "GDPR" / driftsättning.
  if (!secret) return true;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret === secret) return true;

  return false;
}

import { NextRequest, NextResponse } from "next/server";

// Skyddar /admin och /api/admin/* med enkel Basic Auth. Tillräckligt för
// en liten intern adminpanel — inte tänkt som skydd för ett system med
// många användare eller olika behörighetsnivåer.
//
// Sätt ADMIN_PASSWORD (obligatorisk) och ADMIN_USERNAME (valfri, default
// "admin") som miljövariabler. Se README → "GDPR".

function unauthorized() {
  return new NextResponse("Autentisering krävs.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Restaurang Rissel Admin"',
    },
  });
}

export function middleware(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME || "admin";

  if (!adminPassword) {
    // Ingen hemlighet konfigurerad — neka hellre åtkomst än att köra
    // adminpanelen öppet av misstag i produktion.
    return new NextResponse(
      "Adminpanelen är inte konfigurerad. Sätt miljövariabeln ADMIN_PASSWORD.",
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorized();
  }

  const encoded = authHeader.slice("Basic ".length);
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  const separatorIndex = decoded.indexOf(":");
  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  if (user !== adminUsername || pass !== adminPassword) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

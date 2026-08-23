import { Resend } from "resend";
import type { Booking } from "@prisma/client";
import type { AppSettings } from "./settings";

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY saknas — mail skickas inte. Se .env.example."
    );
    return null;
  }
  return new Resend(apiKey);
}

function fromAddress(settings: AppSettings): string {
  return (
    process.env.RESEND_FROM_EMAIL ??
    `${settings.restaurantName} <bokning@example.se>`
  );
}

// Basadress till sajten, för att bygga fullständiga länkar i mail.
// NEXT_PUBLIC_SITE_URL kan sättas manuellt (rekommenderas i produktion);
// annars faller den tillbaka på Vercels automatiska VERCEL_URL.
function siteBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function manageUrl(booking: Booking): string {
  return `${siteBaseUrl()}/min-bokning/${booking.id}?token=${booking.cancelToken ?? ""}`;
}

function manageButtonHtml(booking: Booking): string {
  return `
    <p style="margin: 20px 0 0;">
      <a href="${manageUrl(booking)}" style="display:inline-block; background:#16241C; color:#F1EEE3; text-decoration:none; padding:10px 22px; border-radius:4px; font-size:13px; font-weight:600;">Ändra eller avboka</a>
    </p>`;
}

function formatDateSwedish(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

function wrapTemplate(title: string, bodyHtml: string, settings: AppSettings) {
  return `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background:#F1EEE3; padding: 32px 16px;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #E1DBC6; border-radius: 4px; overflow: hidden;">
      <div style="background:#16241C; color:#F1EEE3; padding: 20px 24px;">
        <p style="margin:0; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8;">${settings.restaurantName}</p>
        <h1 style="margin: 4px 0 0; font-size: 20px;">${title}</h1>
      </div>
      <div style="padding: 24px; color:#16241C; font-size: 14px; line-height: 1.6;">
        ${bodyHtml}
      </div>
      <div style="padding: 16px 24px; background:#F8F6EF; color:#647459; font-size: 12px;">
        Frågor? Svara på det här mailet eller kontakta oss på ${settings.contactEmail}.
      </div>
    </div>
  </div>`;
}

export async function sendBookingConfirmation(
  booking: Booking,
  settings: AppSettings
) {
  const resend = getResend();
  if (!resend) return;

  const html = wrapTemplate(
    "Din bokning är bekräftad",
    `
      <p>Hej ${escapeHtml(booking.name)},</p>
      <p>Tack för din bokning hos ${escapeHtml(settings.restaurantName)}! Här är dina uppgifter:</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:4px 0; color:#647459;">Dag</td><td style="padding:4px 0; text-align:right; font-weight:600;">${formatDateSwedish(booking.date)}</td></tr>
        <tr><td style="padding:4px 0; color:#647459;">Tid</td><td style="padding:4px 0; text-align:right; font-weight:600;">${booking.timeSlot}</td></tr>
        <tr><td style="padding:4px 0; color:#647459;">Antal personer</td><td style="padding:4px 0; text-align:right; font-weight:600;">${booking.partySize}</td></tr>
        <tr><td style="padding:4px 0; color:#647459;">Bokningsnummer</td><td style="padding:4px 0; text-align:right; font-weight:600;">${booking.id.slice(-8).toUpperCase()}</td></tr>
      </table>
      ${
        booking.allergies
          ? `<p><strong>Allergier/önskemål:</strong> ${escapeHtml(booking.allergies)}</p>`
          : ""
      }
      <p>Du får en påminnelse dagen innan. Vill du ändra eller avboka går det bra att göra själv här:</p>
      ${manageButtonHtml(booking)}
    `,
    settings
  );

  await resend.emails.send({
    from: fromAddress(settings),
    to: booking.email,
    subject: `Bokningsbekräftelse — ${formatDateSwedish(booking.date)} kl ${booking.timeSlot}`,
    html,
  });
}

export async function sendBookingUpdated(
  booking: Booking,
  settings: AppSettings
) {
  const resend = getResend();
  if (!resend) return;

  const html = wrapTemplate(
    "Din bokning är ändrad",
    `
      <p>Hej ${escapeHtml(booking.name)},</p>
      <p>Er bokning hos ${escapeHtml(settings.restaurantName)} är uppdaterad. Nya uppgifter:</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:4px 0; color:#647459;">Dag</td><td style="padding:4px 0; text-align:right; font-weight:600;">${formatDateSwedish(booking.date)}</td></tr>
        <tr><td style="padding:4px 0; color:#647459;">Tid</td><td style="padding:4px 0; text-align:right; font-weight:600;">${booking.timeSlot}</td></tr>
        <tr><td style="padding:4px 0; color:#647459;">Antal personer</td><td style="padding:4px 0; text-align:right; font-weight:600;">${booking.partySize}</td></tr>
        <tr><td style="padding:4px 0; color:#647459;">Bokningsnummer</td><td style="padding:4px 0; text-align:right; font-weight:600;">${booking.id.slice(-8).toUpperCase()}</td></tr>
      </table>
      ${
        booking.allergies
          ? `<p><strong>Allergier/önskemål:</strong> ${escapeHtml(booking.allergies)}</p>`
          : ""
      }
      <p>Vill du ändra igen eller avboka, gör det själv här:</p>
      ${manageButtonHtml(booking)}
    `,
    settings
  );

  await resend.emails.send({
    from: fromAddress(settings),
    to: booking.email,
    subject: `Bokning uppdaterad — ${formatDateSwedish(booking.date)} kl ${booking.timeSlot}`,
    html,
  });
}

export async function sendBookingReminder(
  booking: Booking,
  settings: AppSettings
) {
  const resend = getResend();
  if (!resend) return;

  const html = wrapTemplate(
    "Påminnelse: bord imorgon",
    `
      <p>Hej ${escapeHtml(booking.name)},</p>
      <p>Vi ser fram emot ditt besök imorgon, ${formatDateSwedish(booking.date)} kl ${booking.timeSlot}, för ${booking.partySize} ${booking.partySize === 1 ? "person" : "personer"}.</p>
      ${
        booking.allergies
          ? `<p><strong>Noterade allergier/önskemål:</strong> ${escapeHtml(booking.allergies)}</p>`
          : ""
      }
      <p>Behöver ni ändra tid, antal personer, eller kan ni inte längre komma? Gör det själv här, så snart som möjligt:</p>
      ${manageButtonHtml(booking)}
    `,
    settings
  );

  await resend.emails.send({
    from: fromAddress(settings),
    to: booking.email,
    subject: `Påminnelse: bord imorgon kl ${booking.timeSlot}`,
    html,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

# Restaurang Rissel — Bokningssystem

Ett komplett bokningssystem för Restaurang Rissels skolrestaurang: bokningssida
för gäster, adminpanel utan inloggning (för nu), mailbekräftelse + påminnelse
dagen innan, och Excel-export av bokningar.

## Vad är byggt

|Krav|Var det löses|
|-|-|
|13 bord: 6×2-bord (min 1 person), 7×4-bord (min 2 personer)|`prisma/schema.prisma` → `Settings.tableTypesJson`, redigerbart i admin|
|Tider 11.30 / 12.30, max 3–4 bord per kvart|`Settings.sittings`, `maxTablesPerSlot` (standard 4), redigerbart i admin|
|Max 4 sällskap per 15 min|`Settings.maxPartiesPerSlot`|
|1–4 personer per bokning|Formuläret + `maxOnlinePartySize`|
|Kontaktuppgifter: namn, mail, telefon|Bokningsformuläret|
|Öppet tis/ons/fre, ändra dagar i backend|`Settings.openDays`, checkboxar i `/admin`|
|Sällskap >4 personer → maila istället|Formuläret visar mailknapp, systemet blockerar bokningen|
|Mailbekräftelse + påminnelse dagen innan|`src/lib/email.ts` + `/api/cron/reminders`|
|"Vid frågor, hör av dig här"|Kontaktmail visas i formulär, bekräftelse och mail|
|Allergier etc, fritext + samtycke|Fält + kryssruta i formuläret (GDPR, se nedan)|
|Admin: bokningar + Excel-export|`/admin`, lösenordsskyddad|
|Öppna/stänga systemet|Brytare högst upp i `/admin`|
|Adminpanelen skyddad|Basic Auth via `src/middleware.ts`|
|Automatisk radering av gamla bokningar|`/api/cron/cleanup`, lagringstid i admin|
|Integritetspolicy|`/integritetspolicy` (utkast, fyll i placeholders)|

## Teknik

Next.js 14 (App Router, TypeScript) + Prisma (databas) + Resend (mail) +
ExcelJS (export) + Tailwind CSS.

## Kom igång lokalt

```bash
npm install
cp .env.example .env
# fyll i DATABASE\\\_URL (samma Postgres-uppkoppling som produktion funkar
# bra, eller en egen lokal Postgres)
# fyll i RESEND\\\_API\\\_KEY och RESEND\\\_FROM\\\_EMAIL (valfritt lokalt — utan
# dem loggas bara en varning och inga mail skickas)
# fyll i ADMIN\\\_USERNAME och ADMIN\\\_PASSWORD — /admin fungerar inte
# ens lokalt utan dem (se "GDPR" nedan)

npx prisma db push   # skapar tabellerna i databasen
npm run dev
```

Öppna http://localhost:3000 för bokningssidan och
http://localhost:3000/admin för adminpanelen.

## Driftsättning (produktion)

Projektet är förberett för både **Vercel** och **Netlify** — filerna
`vercel.json` respektive `netlify.toml` ligger båda med och stör inte
varandra. Oavsett vilken du väljer behöver du:

* En riktig **Postgres-databas** (SQLite som används lokalt sparas inte
varaktigt på serverless-hosting)
* Ett **Resend**-konto för mail
* Miljövariablerna satta hos hosting-leverantören
* Ett sätt att trigga påminnelsemailet dagligen

### 1\. Databas — Postgres

Projektet är redan konfigurerat för Postgres (inte SQLite), och
byggkommandot kör `prisma db push` automatiskt — så när `DATABASE\\\_URL`
är satt skapas tabellerna av sig själva vid första driftsättningen,
ingen manuell kommandorad krävs.

1. Skapa en gratis Postgres-databas. Enklast på Vercel: i projektet →
fliken **Storage** → **Create Database** → **Postgres** (drivs av
Neon). Kopplas in automatiskt, ingen `DATABASE\\\_URL` att krångla med
för hand. Alternativt [neon.com](https://neon.com) direkt.
2. Om du skapade databasen någon annanstans än via Vercels Storage-flik:
sätt `DATABASE\\\_URL` manuellt under Project Settings → Environment
Variables.

*Litet observandum:* `prisma db push` synkar schemat direkt utan att
spara en migrationshistorik — perfekt för ett litet projekt som det här
där ingen annan utvecklare behöver följa med i ändringarna. Om det
någon gång växer till ett större team-projekt är `prisma migrate deploy`
med sparade migrationsfiler ett naturligt nästa steg.

### 2\. Mail — Resend

1. Skapa konto på [resend.com](https://resend.com).
2. Verifiera din egen domän (Resend guidar dig genom DNS-poster), så att
mail skickas från t.ex. `bokning@restaurangrissel.se`. Under tiden du
testar kan du använda deras delade testdomän `onboarding@resend.dev`.
3. Skapa en API-nyckel.

### 3a. Driftsätt på Vercel

1. Skapa ett repo (GitHub/GitLab) med den här koden och koppla det till
ett nytt Vercel-projekt (eller kör `npx vercel` från mappen).
2. Lägg till miljövariabler under Project Settings → Environment
Variables: `RESEND\\\_API\\\_KEY`, `RESEND\\\_FROM\\\_EMAIL`,
`CRON\\\_SECRET`, `ADMIN\\\_USERNAME`, `ADMIN\\\_PASSWORD`. (`DATABASE\\\_URL`
sätts automatiskt om du skapade databasen via Vercels Storage-flik.)
3. Deploya. Databastabellerna skapas automatiskt som en del av bygget
(`prisma db push`), inget separat kommando behövs.
4. Påminnelsemailet: `vercel.json` innehåller redan ett dagligt
cron-schema mot `/api/cron/reminders`, klart utan extra jobb.

### 3b. Driftsätt på Netlify

1. Pusha koden till ett GitHub/GitLab-repo — du kan **inte** bara dra och
släppa zip-filen, eftersom appen har API-routes och en databas som
måste byggas och konfigureras. I Netlify: "Add new site" → "Import an
existing project" → koppla repot. Netlify läser `netlify.toml`
automatiskt (byggkommando + Next.js-plugin), ingen ytterligare
konfiguration behövs.
2. Lägg till miljövariabler under Site configuration → Environment
variables: `DATABASE\\\_URL`, `RESEND\\\_API\\\_KEY`, `RESEND\\\_FROM\\\_EMAIL`,
`CRON\\\_SECRET`, `ADMIN\\\_USERNAME`, `ADMIN\\\_PASSWORD`.
3. Deploya. Databastabellerna skapas automatiskt som en del av bygget
(`prisma db push`), inget separat kommando behövs.
4. Påminnelsemailet: Netlify kör inte `vercel.json`. Använd istället en
extern gratis cron-tjänst, se steg 4 nedan.

**Att tänka på med Netlify specifikt:** Prisma har historiskt haft
problem med att hitta rätt databas-motor i Netlifys serverless-miljö.
`prisma/schema.prisma` anger redan de plattformar som brukar krävs
(`rhel-openssl-1.0.x` och `rhel-openssl-3.0.x`), vilket löser det i de
allra flesta fall. Om du ändå ser ett fel i stil med "Query engine
binary … could not be found" i Netlifys funktionsloggar efter en
bokning, hör av dig så felsöker vi det — det är ett känt, lösbart
problem, inte ett tecken på att något är fundamentalt fel i koden.

### 4\. Dagliga cron-jobb — påminnelser och GDPR-städning

Två endpoints behöver triggas en gång per dag av något utanför appen
själv:

* `/api/cron/reminders` — skickar påminnelsemail för morgondagens
bokningar
* `/api/cron/cleanup` — raderar bokningar äldre än den lagringstid som
ställs in i admin (se "GDPR" nedan)

**Alternativ A — Vercel Cron (enklast om du kör på Vercel):**
`vercel.json` innehåller redan scheman för båda (olika klockslag). Detta
funkar även på Vercels gratis Hobby-plan, som tillåter upp till 2
cron-jobb, körda som mest en gång per dag var — vilket är precis vad det
här projektet använder. Sätt miljövariabeln `CRON\\\_SECRET` — endast
anrop med rätt hemlighet (`Authorization: Bearer <CRON\\\_SECRET>` eller
`?secret=<CRON\\\_SECRET>`) tillåts.

**Alternativ B — extern gratistjänst (funkar på både Netlify och Vercel):**
T.ex. [cron-job.org](https://cron-job.org) — schemalägg två dagliga
GET-anrop:
`https://dinsajt.se/api/cron/reminders?secret=DIN\\\_CRON\\\_SECRET` och
`https://dinsajt.se/api/cron/cleanup?secret=DIN\\\_CRON\\\_SECRET`.

Utan `CRON\\\_SECRET` satt körs endpointerna öppet (funkar, men vem som
helst som hittar URL:en kan trigga dem i förtid) — sätt den innan
lansering.

## GDPR

Bokningssystemet samlar in namn, mail, telefon och (frivilligt)
allergiuppgifter — det senare räknas ofta som en känsligare uppgift.
Följande är på plats, men **det här är ingen juridisk rådgivning**; låt
gärna någon med dataskyddsansvar på skolan/kommunen läsa igenom innan ni
går live:

* **Adminpanelen är lösenordsskyddad** (Basic Auth, se `src/middleware.ts`).
Sätt `ADMIN\\\_USERNAME` och `ADMIN\\\_PASSWORD` som miljövariabler — utan
`ADMIN\\\_PASSWORD` är panelen helt avstängd, inte öppen, så systemet
fallerar säkert om variabeln glöms bort.
* **Samtycke för allergiuppgifter.** Formuläret kräver en ikryssad ruta
innan man kan skicka in text i allergifältet. Godkänns inte, sparas
ingen text — varken i webbläsaren eller på servern (samma kontroll
körs i API:et, inte bara i gränssnittet).
* **Automatisk radering.** `Settings.retentionMonths` (standard 12
månader, ändras i admin under "Avancerade inställningar") styr hur
länge en bokning sparas. `/api/cron/cleanup` raderar bokningar äldre
än så, varje dag.
* **Integritetspolicy** finns på `/integritetspolicy`, länkad från både
bokningssidan och bekräftelsen. Den är ett **utkast med
platshållartext** i hakparenteser (`\\\[SKOLANS NAMN]`,
`\\\[ORGANISATIONSNUMMER]`, `\\\[KONTAKTMAIL]`, `\\\[X]` för antal månader
m.fl.) — fyll i innan ni publicerar sidan. Om skolan är kommunal
finns en kommentar i koden om att lägga till kommunens
dataskyddsombud.
* **Underleverantörer** (Vercel/Netlify, er valda databas, Resend) är
etablerade tjänster med egna standardavtal för dataskydd (DPA) som
gäller automatiskt när ni skapar konto — inget ni behöver förhandla
fram själva, men nämn dem gärna vid namn i integritetspolicyn (redan
förberett som platshållare där).

## Adminpanelen (`/admin`)

Skyddad med användarnamn + lösenord (Basic Auth) via miljövariablerna
`ADMIN\\\_USERNAME` och `ADMIN\\\_PASSWORD`. Samma skydd gäller alla
`/api/admin/\\\*`-endpoints. Det är ett enkelt skydd, tänkt för en
handfull personer som delar samma inloggning — inte olika behörigheter
per person.

I adminpanelen kan ni:

* Öppna/stänga bokningssystemet helt
* Välja vilka veckodagar som är öppna
* Justera max bord/sällskap per kvart, sittningstider, antal bord per typ,
kontaktmail m.m. under "Avancerade inställningar"
* Se och filtrera bokningar per dag, avboka
* Ladda ner bokningar som Excel

## Struktur

```
src/
  app/
    page.tsx              Bokningssida
    admin/page.tsx         Adminpanel
    api/
      availability/        Lediga tider för ett datum
      bookings/             Skapa bokning
      settings/             Publika inställningar
      admin/bookings/       Lista/avboka + Excel-export
      admin/settings/       Läs/uppdatera alla inställningar
      cron/reminders/       Dagligt påminnelseutskick
  components/               UI-komponenter
  lib/                      Bokningslogik, mail, Excel-export, inställningar
prisma/schema.prisma        Datamodell
```

## Kända begränsningar / naturliga nästa steg

* `/admin` har en delad inloggning för alla, inte individuella konton —
räcker för en liten grupp, men logg över vem som gjort vad saknas.
* Ingen avbokningslänk för gäster själva i mailet — de ombeds höra av sig.
Går att lägga till (en unik avbokningslänk per bokning) om det behövs.
* Tidszonen är satt till `Europe/Stockholm` för "dagens datum" och
påminnelser.
* Integritetspolicyn på `/integritetspolicy` är ett utkast — fyll i
placeholders och låt gärna någon med dataskyddsansvar läsa igenom
innan lansering.
* TEST!


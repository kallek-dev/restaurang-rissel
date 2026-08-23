export const metadata = {
  title: "Integritetspolicy — Restaurang Rissel",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
            Restaurang Rissel
          </p>
          <h1 className="font-display uppercase text-3xl tracking-wide mt-2">
            Integritetspolicy
          </h1>
          <p className="text-sm text-sage mt-2">Senast uppdaterad: [DATUM]</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8 text-ink/90 leading-relaxed">
        <p>
          Den här sidan förklarar vilka personuppgifter vi samlar in när du
          bokar bord hos oss, varför, och vilka rättigheter du har.
          Personuppgiftsansvarig är [SKOLANS/HUVUDMANNENS NAMN],
          org.nr [ORGANISATIONSNUMMER].
        </p>

        <Section title="Vilka uppgifter vi samlar in">
          <ul className="list-disc pl-5 space-y-1">
            <li>Namn</li>
            <li>Mailadress</li>
            <li>Telefonnummer</li>
            <li>Datum, tid och antal personer för bokningen</li>
            <li>
              Eventuella allergier eller andra önskemål du själv väljer att
              skriva in, och ditt uttryckliga godkännande till att den
              uppgiften sparas
            </li>
          </ul>
        </Section>

        <Section title="Varför vi samlar in uppgifterna">
          <p>
            Vi använder uppgifterna för att kunna ta emot, bekräfta och
            påminna om din bordsbokning, och för att kunna anpassa din
            måltid utifrån eventuella allergier. Den rättsliga grunden är
            att det är nödvändigt för att uppfylla avtalet med dig som gäst
            (bokningen). För allergiuppgifter, som räknas som en känsligare
            uppgift, är den rättsliga grunden istället ditt uttryckliga
            samtycke, som du lämnar i bokningsformuläret.
          </p>
        </Section>

        <Section title="Hur länge vi sparar uppgifterna">
          <p>
            Bokningsuppgifter sparas i [X] månader efter bokat datum och
            raderas därefter automatiskt. Om du återkallar ditt samtycke
            till allergiuppgifter innan dess, se kontaktuppgifter nedan.
          </p>
        </Section>

        <Section title="Vem vi delar uppgifterna med">
          <p>
            Vi delar inte dina uppgifter med tredje part för
            marknadsföring. Vi använder följande leverantörer för att driva
            systemet, som därmed hanterar uppgifterna på vårt uppdrag
            (personuppgiftsbiträden):
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>[DATABASLEVERANTÖR, t.ex. Neon] — lagring av bokningen</li>
            <li>[Resend] — utskick av bekräftelse- och påminnelsemail</li>
            <li>[Vercel] — drift av webbplatsen</li>
          </ul>
        </Section>

        <Section title="Dina rättigheter">
          <p>Du har rätt att:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Begära ett utdrag av vilka uppgifter vi har om dig</li>
            <li>Begära rättelse av felaktiga uppgifter</li>
            <li>
              Begära att dina uppgifter raderas tidigare än den ordinarie
              lagringstiden
            </li>
            <li>Återkalla ett lämnat samtycke (t.ex. för allergiuppgifter)</li>
            <li>
              Lämna in ett klagomål till Integritetsskyddsmyndigheten (IMY)
              om du tycker att vi hanterar dina uppgifter fel
            </li>
          </ul>
        </Section>

        <Section title="Kontakt">
          <p>
            Vid frågor om den här policyn eller om dina uppgifter,
            kontakta oss på [KONTAKTMAIL]
            {/*
              Om skolan är kommunal: lägg till kommunens dataskyddsombud
              och deras kontaktuppgifter här, enligt kommunens rutiner.
            */}
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display uppercase text-lg tracking-wide mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

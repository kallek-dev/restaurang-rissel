import Image from "next/image";

export const metadata = {
  title: "Historien bakom huset — Restaurang Rissel",
};

export default function HistoryPage() {
  return (
    <main className="min-h-screen">
      <div className="relative w-full h-[220px] sm:h-[320px] overflow-hidden">
        <Image
          src="/franska-angkvarnen.jpg"
          alt="Historiskt foto av Franska Ångkvarnen i Ystad, grundad 1864"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <a
          href="/"
          className="inline-block mb-8 text-sm underline decoration-dotted text-sage hover:text-ink"
        >
          ← Till bokningssidan
        </a>

        <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
          Historien
        </p>
        <h1 className="font-display uppercase text-3xl sm:text-4xl tracking-wide mt-2 mb-8">
          Franska Ångkvarnen
        </h1>

        <div className="space-y-5 text-ink/85 leading-relaxed">
          <p>
            År 1864 grundade Gerhard Schönbeck och Johan Borg en
            ångkvarn vid hörnet av Surbrunnsvägen och Industrigatan i
            Ystad. Kvarnen malde vete-, råg-, kli- och majsmjöl, och
            växte snabbt — år 1880 hade den 19 anställda och stod för
            det högsta produktionsvärdet av alla fabriker i staden, drygt
            en miljon kronor om året. Omräknat till dagens penningvärde
            motsvarar det uppemot 70 miljoner kronor.
          </p>
          <p>
            Verksamheten pågick i nästan hundra år. Kvarnen stängde 1956,
            och större delen av anläggningen revs 1971. Kvar står idag
            bara en enda byggnad: <strong>Risselmagasinet</strong>, den
            äldre röda tegelbyggnaden vid Ystads stadsbibliotek.
          </p>
          <p>
            Sedan slutet av 1980-talet huserar Ystad Gymnasiums
            restaurang- och livsmedelsprogram i det gamla magasinet.
            Elever lagar och serverar maten ni äter här — samma
            byggnad, en ny generation.
          </p>
          <p className="text-sm text-sage pt-2">
            Fotot ovan är taget av Samuel Moses Marcus, troligen mellan
            1860 och 1870.
          </p>
        </div>

        <a
          href="/"
          className="inline-block mt-10 text-sm underline decoration-dotted text-sage hover:text-ink"
        >
          ← Till bokningssidan
        </a>
      </div>
    </main>
  );
}

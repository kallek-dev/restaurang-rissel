import Image from "next/image";
import BookingForm from "@/components/BookingForm";

export default function Home() {
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
        <p className="absolute bottom-2 right-3 text-[11px] text-paper/80 font-mono">
          Franska Ångkvarnen, Ystad — Risselmagasinet är den enda byggnad
          som finns kvar idag. Foto: Samuel Moses Marcus, ca 1860–70-tal.
        </p>
      </div>

      <header className="border-b border-ink/10">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
            Bordsbokning
          </p>
          <h1 className="font-display uppercase text-4xl sm:text-5xl tracking-wide mt-2">
            Restaurang Rissel
          </h1>
          <p className="mt-3 text-ink/70 max-w-xl">
            Boka ditt bord nedan — vi bekräftar direkt via mail.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <BookingForm />
      </div>

      <footer className="border-t border-ink/10 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-sage flex flex-wrap gap-x-6 gap-y-2 justify-between">
          <span>© Restaurang Rissel</span>
          <div className="flex gap-6">
            <a
              href="/integritetspolicy"
              className="hover:text-ink underline decoration-dotted"
            >
              Integritetspolicy
            </a>
            <a href="/admin" className="hover:text-ink underline decoration-dotted">
              Admin
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

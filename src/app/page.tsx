import BookingForm from "@/components/BookingForm";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
            Bordsbokning
          </p>
          <h1 className="font-display uppercase text-4xl sm:text-5xl tracking-wide mt-2">
            Restaurang Rissel
          </h1>
          <p className="mt-3 text-ink/70 max-w-xl">
            Skolans träningsrestaurang serverar lunch till allmänheten.
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

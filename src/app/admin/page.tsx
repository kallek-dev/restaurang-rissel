import AdminDashboard from "@/components/admin/AdminDashboard";

export const metadata = {
  title: "Admin — Restaurang Rissel",
};

export default function AdminPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
            Restaurang Rissel
          </p>
          <h1 className="font-display uppercase text-3xl tracking-wide mt-1">
            Admin
          </h1>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <AdminDashboard />
      </div>
    </main>
  );
}

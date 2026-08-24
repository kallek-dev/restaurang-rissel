"use client";

import { useState } from "react";

type Props = {
  date: string;
  timeSlot: string;
  partySize: number;
  onClose: () => void;
};

const fieldClass =
  "w-full bg-white border border-ink/15 rounded-sm px-3 py-2 text-sm text-ink focus:border-gold focus:ring-1 focus:ring-gold outline-none";

export default function WaitlistForm({ date, timeSlot, partySize, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.trim().length >= 4;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Fyll i namn, mail och telefon.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, timeSlot, partySize, name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Något gick fel. Försök igen.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-3 border border-sage/40 bg-sage/10 rounded-sm p-4 text-sm">
        Klart! Ni står i kö för kl {timeSlot}. Blir en plats ledig får ni
        ett mail med en länk för att slutföra bokningen — då gäller
        först till kvarn.
      </div>
    );
  }

  return (
    <div className="mt-3 border border-gold/40 bg-gold/10 rounded-sm p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm">
          Ställ dig i kö för kl <strong>{timeSlot}</strong> — vi mailar
          er om en plats blir ledig.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-sage hover:text-ink text-xs shrink-0 ml-3"
        >
          Avbryt
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm sm:col-span-2">
          <span className="block text-xs uppercase tracking-widest text-sage mb-1">
            Namn
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-sage mb-1">
            Telefon
          </span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-sage mb-1">
            Mail
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      {error && <p className="text-brick text-sm">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="px-5 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm disabled:opacity-40"
      >
        {submitting ? "Skickar…" : "Ställ dig i kö"}
      </button>
    </div>
  );
}

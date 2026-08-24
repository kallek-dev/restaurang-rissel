"use client";

import { useState } from "react";
import Calendar from "./Calendar";

type Props = {
  defaultDate: string | null;
  sittings: string[];
  openDays: number[];
  maxOnline: number;
  onSubmitted: () => void;
};

const fieldClass =
  "w-full bg-white border border-ink/15 rounded-sm px-3 py-2 text-sm text-ink focus:border-gold focus:ring-1 focus:ring-gold outline-none";

export default function GroupRequestForm({
  defaultDate,
  sittings,
  openDays,
  maxOnline,
  onSubmitted,
}: Props) {
  const [date, setDate] = useState(defaultDate ?? "");
  const [sitting, setSitting] = useState(sittings[0] ?? "");
  const [partySize, setPartySize] = useState(maxOnline + 1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    date &&
    sitting &&
    partySize > 0 &&
    name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.trim().length >= 4;

  async function handleSubmit() {
    if (!canSubmit) {
      const missing: string[] = [];
      if (!date) missing.push("datum");
      if (!sitting) missing.push("sittning");
      if (!(partySize > 0)) missing.push("antal personer");
      if (!name.trim()) missing.push("namn");
      if (!/\S+@\S+\.\S+/.test(email)) missing.push("giltig mailadress");
      if (phone.trim().length < 4) missing.push("telefonnummer");
      setError(`Fyll i: ${missing.join(", ")}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/group-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sitting, partySize, name, email, phone, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Något gick fel. Försök igen.");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 border border-gold/40 bg-gold/10 rounded-sm p-4 space-y-3">
      <p className="text-sm">
        Stora sällskap (fler än {maxOnline} personer) bokas inte direkt
        online, eftersom det oftast kräver en särskild bordslösning. Fyll
        i uppgifterna så återkommer vi med en bekräftelse.
      </p>
      <div>
        <span className="block text-xs uppercase tracking-widest text-sage mb-2">
          Önskat datum
        </span>
        <Calendar selectedDate={date || null} onSelect={setDate} openDays={openDays} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-sage mb-1">
            Önskad sittning
          </span>
          <select
            value={sitting}
            onChange={(e) => setSitting(e.target.value)}
            className={fieldClass}
          >
            {sittings.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-sage mb-1">
            Antal personer
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={partySize === 0 ? "" : String(partySize)}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, "");
              setPartySize(digitsOnly === "" ? 0 : Number(digitsOnly));
            }}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="block text-xs uppercase tracking-widest text-sage mb-1">
            Telefon
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="block text-xs uppercase tracking-widest text-sage mb-1">
            Namn
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
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
        <label className="block text-sm sm:col-span-2">
          <span className="block text-xs uppercase tracking-widest text-sage mb-1">
            Meddelande (valfritt)
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={`${fieldClass} min-h-[60px]`}
          />
        </label>
      </div>
      {error && <p className="text-brick text-sm">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="px-5 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm disabled:opacity-40"
      >
        {submitting ? "Skickar…" : "Skicka förfrågan"}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import Calendar from "@/components/Calendar";
import type { GroupRequest } from "./RequestsTab";

type Props = {
  request: GroupRequest;
  sittings: string[];
  onClose: () => void;
  onSaved: () => void;
};

const fieldClass =
  "w-full bg-white border border-ink/15 rounded-sm px-3 py-2 text-sm text-ink";

export default function EditRequestModal({ request, sittings, onClose, onSaved }: Props) {
  const [date, setDate] = useState(request.date);
  const [sitting, setSitting] = useState(request.sitting);
  const [partySize, setPartySize] = useState(request.partySize);
  const [name, setName] = useState(request.name);
  const [email, setEmail] = useState(request.email);
  const [phone, setPhone] = useState(request.phone);
  const [message, setMessage] = useState(request.message);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    date &&
    sitting &&
    partySize > 0 &&
    name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.trim().length >= 4;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/group-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sitting, partySize, name, email, phone, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunde inte spara ändringen.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <div className="bg-paper max-w-lg w-full rounded-sm border border-ink/10 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display uppercase text-lg">Redigera förfrågan</h2>
          <button onClick={onClose} className="text-sage hover:text-ink text-sm">
            Stäng ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="block text-xs uppercase tracking-widest text-sage mb-2">
              Önskat datum
            </span>
            <Calendar selectedDate={date} onSelect={setDate} allowAllDays />
          </div>

          <label className="block text-sm max-w-[200px]">
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
              {!sittings.includes(sitting) && <option value={sitting}>{sitting}</option>}
            </select>
          </label>

          <label className="block text-sm max-w-[140px]">
            <span className="block text-xs uppercase tracking-widest text-sage mb-1">
              Antal personer
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={partySize === 0 ? "" : String(partySize)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setPartySize(digits === "" ? 0 : Number(digits));
              }}
              className={fieldClass}
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
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
                Meddelande
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${fieldClass} min-h-[60px]`}
              />
            </label>
          </div>

          {error && (
            <div className="border border-brick/40 bg-brick/5 text-brick rounded-sm p-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="px-6 py-3 bg-ink text-paper font-display uppercase tracking-widest text-sm rounded-sm disabled:opacity-40"
            >
              {submitting ? "Sparar…" : "Spara ändring"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-ink/20 font-display uppercase tracking-widest text-sm rounded-sm"
            >
              Avbryt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

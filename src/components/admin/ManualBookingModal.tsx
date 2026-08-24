"use client";

import { useEffect, useState } from "react";
import SlotPicker from "@/components/SlotPicker";
import type { Booking } from "./BookingsTab";

type SlotAvailability = { time: string; full: boolean };
type SittingGroup = { sitting: string; slots: SlotAvailability[] };
type DateAvailability = { date: string; open: boolean; sittingGroups: SittingGroup[] };

export type ManualBookingPrefill = {
  date?: string;
  name?: string;
  email?: string;
  phone?: string;
  partySize?: number;
  message?: string;
  groupRequestId?: string;
};

type Props = {
  prefill: ManualBookingPrefill | null;
  editingBooking?: Booking | null;
  onClose: () => void;
  onBooked: () => void;
};

const fieldClass =
  "w-full bg-white border border-ink/15 rounded-sm px-3 py-2 text-sm text-ink";

export default function ManualBookingModal({ prefill, editingBooking, onClose, onBooked }: Props) {
  const isEditing = Boolean(editingBooking);

  const [date, setDate] = useState(editingBooking?.date ?? prefill?.date ?? "");
  const [manual, setManual] = useState(
    editingBooking ? editingBooking.tableTypeId === "manuell" : Boolean(prefill?.groupRequestId)
  );
  const [timeSlot, setTimeSlot] = useState<string | null>(editingBooking?.timeSlot ?? null);
  const [manualTime, setManualTime] = useState(editingBooking?.timeSlot ?? "12:00");
  const [partySize, setPartySize] = useState(editingBooking?.partySize ?? prefill?.partySize ?? 2);
  const [name, setName] = useState(editingBooking?.name ?? prefill?.name ?? "");
  const [email, setEmail] = useState(editingBooking?.email ?? prefill?.email ?? "");
  const [phone, setPhone] = useState(editingBooking?.phone ?? prefill?.phone ?? "");
  const [allergies, setAllergies] = useState(editingBooking?.allergies ?? "");
  const [allergyConsent, setAllergyConsent] = useState(
    Boolean(editingBooking?.allergies)
  );
  const [note, setNote] = useState(editingBooking?.note ?? prefill?.message ?? "");
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  const [availability, setAvailability] = useState<DateAvailability | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: { date: string; timeSlot: string }[];
    failed: { date: string; error: string }[];
  } | null>(null);

  useEffect(() => {
    if (manual || !date) {
      setAvailability(null);
      return;
    }
    setLoadingAvailability(true);
    setTimeSlot((cur) => (isEditing && cur === editingBooking?.timeSlot ? cur : null));
    const params = new URLSearchParams({ date, partySize: String(partySize) });
    if (editingBooking) params.set("exclude", editingBooking.id);
    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then(setAvailability)
      .finally(() => setLoadingAvailability(false));
  }, [date, manual, partySize]);

  const effectiveTime = manual ? manualTime : timeSlot;
  const needsAllergyConsent = allergies.trim().length > 0;
  const canSubmit =
    date &&
    effectiveTime &&
    partySize > 0 &&
    name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.trim().length >= 4 &&
    (!needsAllergyConsent || allergyConsent);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !effectiveTime) return;
    setSubmitting(true);
    setError(null);

    if (isEditing && editingBooking) {
      try {
        const res = await fetch(`/api/admin/bookings/${editingBooking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            timeSlot: effectiveTime,
            partySize,
            name,
            email,
            phone,
            allergies,
            allergyConsent,
            note,
            manual,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kunde inte spara ändringen.");
        onBooked();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Något gick fel.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          timeSlot: effectiveTime,
          partySize,
          name,
          email,
          phone,
          allergies,
          allergyConsent,
          note,
          manual,
          repeatWeeks,
          groupRequestId: prefill?.groupRequestId,
        }),
      });
      const data = await res.json();
      if (!res.ok && (!data.created || data.created.length === 0)) {
        throw new Error(data.failed?.[0]?.error ?? "Kunde inte skapa bokningen.");
      }
      setResult(data);
      if (data.created?.length > 0) onBooked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingBooking) return;
    if (
      !confirm(
        `Radera bokningen för ${editingBooking.name} permanent? Går inte att ångra.`
      )
    )
      return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${editingBooking.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunde inte radera bokningen.");
      onBooked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <div className="bg-paper max-w-lg w-full rounded-sm border border-ink/10 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display uppercase text-lg">
            {isEditing ? "Redigera bokning" : "Boka in manuellt"}
          </h2>
          <button onClick={onClose} className="text-sage hover:text-ink text-sm">
            Stäng ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            {result.created.length > 0 && (
              <div className="border border-sage/40 bg-sage/10 rounded-sm p-4 text-sm">
                <p className="font-medium mb-1">Skapade bokningar:</p>
                <ul className="list-disc pl-5">
                  {result.created.map((c) => (
                    <li key={c.date}>
                      {c.date} kl {c.timeSlot}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.failed.length > 0 && (
              <div className="border border-brick/40 bg-brick/5 text-brick rounded-sm p-4 text-sm">
                <p className="font-medium mb-1">Kunde inte bokas:</p>
                <ul className="list-disc pl-5">
                  {result.failed.map((f) => (
                    <li key={f.date}>
                      {f.date} — {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 bg-ink text-paper text-sm font-display uppercase tracking-wide rounded-sm"
            >
              Stäng
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="flex items-start gap-2 text-sm border border-gold/40 bg-gold/10 rounded-sm p-3">
              <input
                type="checkbox"
                checked={manual}
                onChange={(e) => setManual(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Manuell platstilldelning</strong> — hoppar över
                all kapacitetskontroll. Använd för sällskap större än ert
                största bord (t.ex. ihopskjutna bord), eller vid andra
                särskilda lösningar. Utan den här ikryssad stoppas
                sällskap som inte ryms i någon vanlig bordstyp.
              </span>
            </label>

            <label className="block text-sm">
              <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                Datum
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
                required
              />
            </label>

            {manual ? (
              <label className="block text-sm max-w-[140px]">
                <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                  Tid
                </span>
                <input
                  type="time"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className={fieldClass}
                />
              </label>
            ) : (
              <div>
                <span className="block text-xs uppercase tracking-widest text-sage mb-2">
                  Tid
                </span>
                {!date && <p className="text-sm text-sage">Välj datum först.</p>}
                {date && loadingAvailability && (
                  <p className="text-sm text-sage font-mono">Hämtar…</p>
                )}
                {date && !loadingAvailability && availability && (
                  <SlotPicker
                    groups={availability.sittingGroups}
                    selectedTime={timeSlot}
                    onSelect={setTimeSlot}
                  />
                )}
              </div>
            )}

            <label className="block text-sm max-w-[140px]">
              <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                Antal personer
              </span>
              <input
                type="number"
                min={1}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value) || 0)}
                className={fieldClass}
              />
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                  Namn
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                  Telefon
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  Allergier / önskemål
                </span>
                <textarea
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className={`${fieldClass} min-h-[60px]`}
                />
                {needsAllergyConsent && (
                  <label className="flex items-start gap-2 mt-2 text-sm text-ink/80">
                    <input
                      type="checkbox"
                      checked={allergyConsent}
                      onChange={(e) => setAllergyConsent(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>Gästen har godkänt att uppgiften sparas.</span>
                  </label>
                )}
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                  Anteckning (syns bara i admin, t.ex. "Bord 3+4 ihopskjutna")
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>

            {!isEditing && !prefill?.groupRequestId && (
              <label className="block text-sm max-w-[220px]">
                <span className="block text-xs uppercase tracking-widest text-sage mb-1">
                  Upprepa varje vecka, X gånger
                </span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={repeatWeeks}
                  onChange={(e) => setRepeatWeeks(Number(e.target.value) || 1)}
                  className={fieldClass}
                />
                <span className="block text-xs text-sage mt-1">
                  Skapar {repeatWeeks} separata bokningar, en per vecka.
                  Hoppar över veckor som redan är fullbokade och talar om
                  vilka.
                </span>
              </label>
            )}

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
                {submitting
                  ? isEditing
                    ? "Sparar…"
                    : "Bokar…"
                  : isEditing
                  ? "Spara ändring"
                  : repeatWeeks > 1
                  ? `Skapa ${repeatWeeks} bokningar`
                  : "Boka in"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-ink/20 font-display uppercase tracking-widest text-sm rounded-sm"
              >
                Avbryt
              </button>
            </div>

            {isEditing && editingBooking && (
              <div className="pt-4 border-t border-ink/10">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-brick underline decoration-dotted text-xs disabled:opacity-40"
                >
                  {deleting ? "Raderar…" : "Radera bokningen permanent"}
                </button>
                <p className="text-xs text-sage mt-1">
                  Tar bort bokningen helt, går inte att ångra. Avboka
                  ovan räcker oftast — det här behövs bara om gästens
                  uppgifter måste tas bort direkt istället för att
                  vänta på den automatiska GDPR-städningen.
                </p>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

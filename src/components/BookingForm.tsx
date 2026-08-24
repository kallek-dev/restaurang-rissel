"use client";

import { useEffect, useState } from "react";
import TicketPreview from "./TicketPreview";
import Calendar from "./Calendar";
import SlotPicker from "./SlotPicker";
import GroupRequestForm from "./GroupRequestForm";

type PublicSettings = {
  systemOpen: boolean;
  openDays: number[];
  sittings: string[];
  maxOnlinePartySize: number;
  contactEmail: string;
  retentionMonths: number;
  restaurantName: string;
};

type SlotAvailability = {
  time: string;
  full: boolean;
};

type SittingGroup = {
  sitting: string;
  slots: SlotAvailability[];
};

type DateAvailability = {
  date: string;
  open: boolean;
  sittingGroups: SittingGroup[];
};

const WEEKDAY_SHORT = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | {
      status: "success";
      reference: string;
      date: string;
      timeSlot: string;
      partySize: number;
    };

export default function BookingForm() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [settingsError, setSettingsError] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DateAvailability | null>(
    null
  );
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [partySize, setPartySize] = useState<number>(2);
  const [largeParty, setLargeParty] = useState(false);
  const [groupRequestSubmitted, setGroupRequestSubmitted] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [allergyConsent, setAllergyConsent] = useState(false);

  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("fail");
        return r.json();
      })
      .then(setSettings)
      .catch(() => setSettingsError(true));
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setAvailability(null);
      return;
    }
    setLoadingAvailability(true);
    setSelectedTime(null);
    const params = new URLSearchParams({ date: selectedDate });
    if (!largeParty) params.set("partySize", String(partySize));
    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data: DateAvailability) => setAvailability(data))
      .finally(() => setLoadingAvailability(false));
  }, [selectedDate, partySize, largeParty]);

  const maxOnline = settings?.maxOnlinePartySize ?? 4;
  const partySizeOptions = Array.from({ length: maxOnline }, (_, i) => i + 1);

  function selectPartySize(n: number) {
    setPartySize(n);
    setLargeParty(false);
  }

  function selectLargeParty() {
    setLargeParty(true);
    setSelectedTime(null);
  }

  const needsAllergyConsent = allergies.trim().length > 0;

  const canSubmit =
    !largeParty &&
    settings?.systemOpen &&
    selectedDate &&
    selectedTime &&
    name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.trim().length >= 4 &&
    (!needsAllergyConsent || allergyConsent);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedDate || !selectedTime) return;

    setSubmitState({ status: "submitting" });
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          timeSlot: selectedTime,
          partySize,
          name,
          email,
          phone,
          allergies,
          allergyConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitState({
          status: "error",
          message: data.error ?? "Något gick fel. Försök igen.",
        });
        // Sittningen kan ha blivit fullbokad under tiden — hämta om.
        if (selectedDate) {
          fetch(`/api/availability?date=${selectedDate}`)
            .then((r) => r.json())
            .then(setAvailability);
        }
        return;
      }
      setSubmitState({
        status: "success",
        reference: data.reference,
        date: data.date,
        timeSlot: data.timeSlot,
        partySize: data.partySize,
      });
    } catch {
      setSubmitState({
        status: "error",
        message: "Kunde inte nå servern. Kontrollera din uppkoppling.",
      });
    }
  }

  if (settingsError) {
    return (
      <p className="text-brick">
        Kunde inte ladda bokningssystemet just nu. Försök igen om en stund.
      </p>
    );
  }

  if (!settings) {
    return <p className="text-sage font-mono text-sm">Laddar…</p>;
  }

  if (!settings.systemOpen) {
    return (
      <div className="border border-brick/40 bg-brick/5 rounded-sm p-6">
        <h2 className="font-display uppercase text-xl text-brick">
          Bokningssystemet är stängt just nu
        </h2>
        <p className="mt-2 text-ink/80">
          Vi tar just nu inte emot bordsbokningar online. Har du frågor?
          Kontakta oss på{" "}
          <a className="underline decoration-gold" href={`mailto:${settings.contactEmail}`}>
            {settings.contactEmail}
          </a>
          .
        </p>
      </div>
    );
  }

  if (groupRequestSubmitted) {
    return (
      <div className="border border-ink/10 bg-paper-50 rounded-sm p-8 max-w-2xl">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-sage">
          Mottagen
        </p>
        <h2 className="font-display uppercase text-2xl mt-1">
          Tack för er förfrågan!
        </h2>
        <p className="mt-4 text-ink/80 leading-relaxed">
          Vi har fått er förfrågan och hör av oss så snart vi kan för att
          bekräfta tid. En mottagningsbekräftelse är skickad till er mail.
        </p>
        <p className="mt-4 text-ink/80 leading-relaxed">
          Frågor under tiden? Kontakta oss på{" "}
          <a
            className="underline decoration-gold"
            href={`mailto:${settings.contactEmail}`}
          >
            {settings.contactEmail}
          </a>
          .
        </p>
      </div>
    );
  }

  if (submitState.status === "success") {
    return (
      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 border border-ink/10 bg-paper-50 rounded-sm p-8">
          <p className="font-display uppercase tracking-[0.2em] text-xs text-sage">
            Klart
          </p>
          <h2 className="font-display uppercase text-2xl mt-1">
            Bordet är bokat!
          </h2>
          <p className="mt-4 text-ink/80 leading-relaxed">
            En bekräftelse har skickats till din mail. Du får också en
            påminnelse dagen innan besöket.
          </p>
          <p className="mt-4 text-ink/80 leading-relaxed">
            Vid frågor eller om ni behöver ändra bokningen, kontakta oss på{" "}
            <a
              className="underline decoration-gold"
              href={`mailto:${settings.contactEmail}`}
            >
              {settings.contactEmail}
            </a>
            .
          </p>
        </div>
        <div className="lg:col-span-2">
          <TicketPreview
            restaurantName={settings.restaurantName}
            date={submitState.date}
            timeSlot={submitState.timeSlot}
            partySize={submitState.partySize}
            name={name}
            reference={submitState.reference}
          />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 space-y-10">
        {/* Dag */}
        <section>
          <SectionLabel step="01" title="Välj dag" />
          <Calendar
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            openDays={settings.openDays}
          />
          <p className="text-xs text-sage mt-2">
            Vi har öppet{" "}
            {settings.openDays
              .slice()
              .sort()
              .map((w) => WEEKDAY_SHORT[w])
              .join(", ")}
            .
          </p>
        </section>

        {/* Antal personer */}
        <section>
          <SectionLabel step="02" title="Antal personer" />
          <div className="flex flex-wrap gap-2">
            {partySizeOptions.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => selectPartySize(n)}
                className={dayChipClass(partySize === n && !largeParty, false)}
              >
                {n} {n === 1 ? "person" : "personer"}
              </button>
            ))}
            <button
              type="button"
              onClick={selectLargeParty}
              className={dayChipClass(largeParty, false)}
            >
              Fler än {maxOnline}
            </button>
          </div>
          {largeParty && (
            <GroupRequestForm
              defaultDate={selectedDate}
              sittings={settings.sittings}
              maxOnline={maxOnline}
              onSubmitted={() => setGroupRequestSubmitted(true)}
            />
          )}
        </section>

        {/* Tid */}
        {!largeParty && (
          <section>
            <SectionLabel step="03" title="Välj tid" />
            {!selectedDate && (
              <p className="text-sm text-sage">Välj en dag först.</p>
            )}
            {selectedDate && loadingAvailability && (
              <p className="text-sm text-sage font-mono">Hämtar lediga tider…</p>
            )}
            {selectedDate && !loadingAvailability && availability && (
              <SlotPicker
                groups={availability.sittingGroups}
                selectedTime={selectedTime}
                onSelect={setSelectedTime}
              />
            )}
          </section>
        )}

        {/* Kontaktuppgifter */}
        <section>
          <SectionLabel step="04" title="Kontaktuppgifter" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Namn">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Telefon">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                type="tel"
                required
              />
            </Field>
            <Field label="Mail" full>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                type="email"
                required
              />
            </Field>
            <Field label="Allergier / önskemål" full>
              <textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className={`${inputClass} min-h-[88px] resize-y`}
                placeholder="T.ex. nötallergi, glutenfritt, rullstol…"
              />
              {needsAllergyConsent && (
                <label className="flex items-start gap-2 mt-2 text-sm text-ink/80">
                  <input
                    type="checkbox"
                    checked={allergyConsent}
                    onChange={(e) => setAllergyConsent(e.target.checked)}
                    className="mt-0.5"
                    required
                  />
                  <span>
                    Jag godkänner att uppgiften ovan sparas för att
                    restaurangen ska kunna anpassa min måltid. Uppgiften
                    raderas tillsammans med resten av bokningen efter{" "}
                    {settings.retentionMonths ?? 12} månader.
                  </span>
                </label>
              )}
            </Field>
          </div>
        </section>

        <p className="text-xs text-sage">
          Genom att boka godkänner du att vi sparar dina uppgifter för att
          hantera bokningen. Läs mer i vår{" "}
          <a
            href="/integritetspolicy"
            className="underline decoration-dotted hover:text-ink"
          >
            integritetspolicy
          </a>
          .
        </p>

        {submitState.status === "error" && (
          <div className="border border-brick/40 bg-brick/5 text-brick rounded-sm p-4 text-sm">
            {submitState.message}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitState.status === "submitting"}
          className="w-full sm:w-auto px-8 py-3 bg-ink text-paper font-display uppercase tracking-widest text-sm rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink-700 transition-colors"
        >
          {submitState.status === "submitting" ? "Bokar…" : "Boka bord"}
        </button>
      </div>

      <div className="lg:col-span-2">
        <TicketPreview
          restaurantName={settings.restaurantName}
          date={selectedDate}
          timeSlot={selectedTime}
          partySize={largeParty ? maxOnline + 1 : partySize}
          name={name}
        />
      </div>
    </form>
  );
}

function SectionLabel({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <span className="font-mono text-xs text-gold-700">{step}</span>
      <h2 className="font-display uppercase tracking-wide text-lg">
        {title}
      </h2>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-xs uppercase tracking-widest text-sage mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full bg-white border border-ink/15 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-gold focus:ring-1 focus:ring-gold outline-none";

function dayChipClass(selected: boolean, disabled: boolean) {
  return [
    "shrink-0 px-4 py-2 rounded-sm border text-sm font-medium transition-colors",
    disabled
      ? "border-ink/10 text-ink/25 cursor-not-allowed line-through"
      : selected
      ? "bg-ink text-paper border-ink"
      : "border-ink/20 text-ink hover:border-ink/50",
  ].join(" ");
}

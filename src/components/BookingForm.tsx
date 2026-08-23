"use client";

import { useEffect, useState } from "react";
import TicketPreview from "./TicketPreview";

type PublicSettings = {
  systemOpen: boolean;
  openDays: number[];
  maxOnlinePartySize: number;
  contactEmail: string;
  retentionMonths: number;
  restaurantName: string;
};

type SlotAvailability = {
  time: string;
  full: boolean;
  tableAvailability: Record<string, number>;
};

type DateAvailability = {
  date: string;
  open: boolean;
  slots: SlotAvailability[];
};

const WEEKDAY_SHORT = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function localDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}
function todayLocalStr(): string {
  const d = new Date();
  return localDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}
const MONTH_NAMES = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];
function isSameOrAfterCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  return (
    year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth())
  );
}

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

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [allergyConsent, setAllergyConsent] = useState(false);

  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  function goPrevMonth() {
    setCalendarMonth((cur) => {
      let { year, month } = cur;
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      if (!isSameOrAfterCurrentMonth(year, month)) return cur;
      return { year, month };
    });
  }
  function goNextMonth() {
    setCalendarMonth((cur) => {
      let { year, month } = cur;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      return { year, month };
    });
  }

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
    fetch(`/api/availability?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data: DateAvailability) => setAvailability(data))
      .finally(() => setLoadingAvailability(false));
  }, [selectedDate]);

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
        // Tiden kan ha blivit fullbokad under tiden — hämta om.
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
          <div className="max-w-xs">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={goPrevMonth}
                disabled={
                  !isSameOrAfterCurrentMonth(
                    calendarMonth.month === 0
                      ? calendarMonth.year - 1
                      : calendarMonth.year,
                    calendarMonth.month === 0 ? 11 : calendarMonth.month - 1
                  )
                }
                className="w-8 h-8 border border-ink/20 rounded-sm text-ink disabled:opacity-25 disabled:cursor-not-allowed hover:border-ink/50"
              >
                ‹
              </button>
              <h3 className="font-display uppercase text-sm tracking-wide">
                {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
              </h3>
              <button
                type="button"
                onClick={goNextMonth}
                className="w-8 h-8 border border-ink/20 rounded-sm text-ink hover:border-ink/50"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["M", "T", "O", "T", "F", "L", "S"].map((d, i) => (
                <span
                  key={i}
                  className="text-center text-[10px] uppercase tracking-widest text-sage"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {renderCalendarCells(
                calendarMonth,
                selectedDate,
                settings.openDays,
                setSelectedDate
              )}
            </div>
          </div>
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

        {/* Tid */}
        <section>
          <SectionLabel step="02" title="Välj tid" />
          {!selectedDate && (
            <p className="text-sm text-sage">Välj en dag först.</p>
          )}
          {selectedDate && loadingAvailability && (
            <p className="text-sm text-sage font-mono">Hämtar lediga tider…</p>
          )}
          {selectedDate && !loadingAvailability && availability && (
            <div className="flex flex-wrap gap-2">
              {availability.slots.map((slot) => {
                const selected = selectedTime === slot.time;
                return (
                  <button
                    type="button"
                    key={slot.time}
                    disabled={slot.full || largeParty}
                    onClick={() => setSelectedTime(slot.time)}
                    className={timeChipClass(selected, slot.full)}
                  >
                    {slot.time}
                  </button>
                );
              })}
              {availability.slots.length === 0 && (
                <p className="text-sm text-sage">
                  Inga tider tillgängliga den här dagen.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Antal personer */}
        <section>
          <SectionLabel step="03" title="Antal personer" />
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
            <div className="mt-3 border border-gold/40 bg-gold/10 rounded-sm p-4 text-sm">
              <p>
                Stora sällskap (fler än {maxOnline} personer) bokas via mail
                istället för här i systemet.
              </p>
              <a
                className="inline-block mt-2 underline decoration-gold font-medium"
                href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(
                  "Bokning för stort sällskap"
                )}`}
              >
                Maila oss på {settings.contactEmail}
              </a>
            </div>
          )}
        </section>

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

function renderCalendarCells(
  calendarMonth: { year: number; month: number },
  selectedDate: string | null,
  openDays: number[],
  onSelect: (date: string) => void
): React.ReactNode[] {
  const { year, month } = calendarMonth;
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mån=0 ... Sön=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayLocalStr();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = localDateStr(year, month, day);
    const weekday = new Date(year, month, day).getDay();
    const isPast = dateStr < today;
    const isClosed = !openDays.includes(weekday);
    const disabled = isPast || isClosed;
    const isToday = dateStr === today;
    const isSelected = selectedDate === dateStr;

    cells.push(
      <button
        type="button"
        key={dateStr}
        disabled={disabled}
        onClick={() => onSelect(dateStr)}
        className={[
          "relative aspect-square flex items-center justify-center rounded-sm text-sm font-semibold border transition-colors",
          disabled
            ? "text-ink/25 cursor-not-allowed border-transparent"
            : "border-transparent hover:border-gold text-ink",
          isSelected ? "bg-ink text-paper" : !disabled ? "bg-white" : "",
        ].join(" ")}
      >
        {day}
        {isToday && !isSelected && (
          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-gold" />
        )}
      </button>
    );
  }

  return cells;
}

function timeChipClass(selected: boolean, full: boolean) {
  return [
    "px-4 py-2 rounded-sm border text-sm font-mono transition-colors",
    full
      ? "border-ink/10 text-ink/25 cursor-not-allowed line-through"
      : selected
      ? "bg-gold text-ink border-gold"
      : "border-ink/20 text-ink hover:border-gold",
  ].join(" ");
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Calendar from "@/components/Calendar";
import SlotPicker from "@/components/SlotPicker";

type BookingInfo = {
  date: string;
  timeSlot: string;
  partySize: number;
  name: string;
  email: string;
  phone: string;
  allergies: string;
  status: string;
};

type PublicSettings = {
  systemOpen: boolean;
  maxOnlinePartySize: number;
  contactEmail: string;
  retentionMonths: number;
  restaurantName: string;
};

type SlotAvailability = { time: string; full: boolean };
type SittingGroup = { sitting: string; slots: SlotAvailability[] };
type DateAvailability = { date: string; open: boolean; sittingGroups: SittingGroup[] };

function formatDateSwedish(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export default function ManageBookingPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"view" | "edit" | "cancel">("view");

  // Redigeringsläge — förifyllt när bokningen laddats.
  const [date, setDate] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [allergyConsent, setAllergyConsent] = useState(false);

  const [availability, setAvailability] = useState<DateAvailability | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [updated, setUpdated] = useState<{ timeSlot: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      setLoadError("Länken saknar information och kan inte användas.");
      setLoading(false);
      return;
    }
    fetch(`/api/bookings/${params.id}?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Kunde inte hitta bokningen.");
        return data as BookingInfo;
      })
      .then((data) => {
        setBooking(data);
        setDate(data.date);
        setTimeSlot(data.timeSlot);
        setPartySize(data.partySize);
        setName(data.name);
        setEmail(data.email);
        setPhone(data.phone);
        setAllergies(data.allergies);
        setAllergyConsent(data.allergies.length > 0); // redan sparat samtycke sen tidigare
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [params.id, token]);

  useEffect(() => {
    if (mode !== "edit" || !date) {
      setAvailability(null);
      return;
    }
    setLoadingAvailability(true);
    fetch(`/api/availability?date=${date}&exclude=${params.id}`)
      .then((r) => r.json())
      .then(setAvailability)
      .finally(() => setLoadingAvailability(false));
  }, [mode, date, params.id]);

  function startEdit() {
    setMode("edit");
    setActionError(null);
  }

  async function handleSave() {
    if (!token || !date || !timeSlot) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          date,
          timeSlot,
          partySize,
          name,
          email,
          phone,
          allergies,
          allergyConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunde inte spara ändringen.");
      setUpdated({ timeSlot: data.timeSlot });
      setBooking((b) =>
        b
          ? {
              ...b,
              date,
              timeSlot: data.timeSlot,
              partySize,
              name,
              email,
              phone,
              allergies,
            }
          : b
      );
      setMode("view");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!token) return;
    setCancelling(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bookings/${params.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunde inte avboka.");
      setBooking((b) => (b ? { ...b, status: "cancelled" } : b));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setCancelling(false);
    }
  }

  const maxOnline = settings?.maxOnlinePartySize ?? 4;
  const needsAllergyConsent = allergies.trim().length > 0;
  const canSave =
    date &&
    timeSlot &&
    name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.trim().length >= 4 &&
    (!needsAllergyConsent || allergyConsent);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full border border-ink/10 bg-paper-50 rounded-sm p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sage">
          {settings?.restaurantName ?? "Restaurang Rissel"}
        </p>
        <h1 className="font-display uppercase text-2xl mt-1 mb-6">
          Din bokning
        </h1>

        {loading && <p className="text-sage font-mono text-sm">Laddar…</p>}

        {!loading && loadError && (
          <div className="border border-brick/40 bg-brick/5 text-brick rounded-sm p-4 text-sm">
            {loadError}
          </div>
        )}

        {!loading && booking && !loadError && (
          <>
            {booking.status === "cancelled" ? (
              <p className="text-ink/80">
                Den här bokningen är avbokad. Vill ni boka igen, gå till{" "}
                <a href="/" className="underline decoration-gold">
                  bokningssidan
                </a>
                .
              </p>
            ) : mode === "view" ? (
              <>
                <div className="border border-ink/10 rounded-sm p-4 mb-6 font-mono text-sm space-y-2">
                  <Row label="Namn" value={booking.name} />
                  <Row label="Dag" value={formatDateSwedish(booking.date)} />
                  <Row label="Tid" value={booking.timeSlot} />
                  <Row
                    label="Antal"
                    value={`${booking.partySize} ${booking.partySize === 1 ? "person" : "personer"}`}
                  />
                  {booking.allergies && (
                    <Row label="Allergier" value={booking.allergies} />
                  )}
                </div>

                {updated && (
                  <div className="border border-sage/40 bg-sage/10 rounded-sm p-4 text-sm mb-4">
                    Ändringen är sparad. Ny tid: <strong>{updated.timeSlot}</strong>.
                    En bekräftelse har skickats till er mail.
                  </div>
                )}

                {actionError && (
                  <div className="border border-brick/40 bg-brick/5 text-brick rounded-sm p-4 text-sm mb-4">
                    {actionError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={startEdit}
                    className="px-6 py-3 bg-ink text-paper font-display uppercase tracking-widest text-sm rounded-sm hover:bg-ink-700"
                  >
                    Ändra bokning
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-6 py-3 border border-brick text-brick font-display uppercase tracking-widest text-sm rounded-sm disabled:opacity-40 hover:bg-brick/5"
                  >
                    {cancelling ? "Avbokar…" : "Avboka bordet"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {settings && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-sage mb-2">
                        Dag
                      </p>
                      <Calendar
                        selectedDate={date}
                        onSelect={(d) => {
                          setDate(d);
                          setTimeSlot(null);
                        }}
                      />
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-widest text-sage mb-2">
                        Tid
                      </p>
                      {loadingAvailability && (
                        <p className="text-sm text-sage font-mono">Hämtar lediga tider…</p>
                      )}
                      {!loadingAvailability && availability && (
                        <SlotPicker
                          groups={availability.sittingGroups}
                          selectedTime={timeSlot}
                          onSelect={setTimeSlot}
                        />
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-widest text-sage mb-2">
                        Antal personer
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: maxOnline }, (_, i) => i + 1).map(
                          (n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setPartySize(n)}
                              className={[
                                "px-4 py-2 rounded-sm border text-sm font-medium",
                                partySize === n
                                  ? "bg-ink text-paper border-ink"
                                  : "border-ink/20 hover:border-ink/50",
                              ].join(" ")}
                            >
                              {n} {n === 1 ? "person" : "personer"}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <TextField label="Namn" value={name} onChange={setName} />
                      <TextField label="Telefon" value={phone} onChange={setPhone} type="tel" />
                      <div className="sm:col-span-2">
                        <TextField label="Mail" value={email} onChange={setEmail} type="email" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs uppercase tracking-widest text-sage mb-1">
                          Allergier / önskemål
                        </label>
                        <textarea
                          value={allergies}
                          onChange={(e) => setAllergies(e.target.value)}
                          className="w-full bg-white border border-ink/15 rounded-sm px-3 py-2 text-sm min-h-[72px]"
                        />
                        {needsAllergyConsent && (
                          <label className="flex items-start gap-2 mt-2 text-sm text-ink/80">
                            <input
                              type="checkbox"
                              checked={allergyConsent}
                              onChange={(e) => setAllergyConsent(e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>
                              Jag godkänner att uppgiften ovan sparas för att
                              restaurangen ska kunna anpassa min måltid.
                            </span>
                          </label>
                        )}
                      </div>
                    </div>

                    {actionError && (
                      <div className="border border-brick/40 bg-brick/5 text-brick rounded-sm p-4 text-sm">
                        {actionError}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className="px-6 py-3 bg-ink text-paper font-display uppercase tracking-widest text-sm rounded-sm disabled:opacity-40"
                      >
                        {saving ? "Sparar…" : "Spara ändring"}
                      </button>
                      <button
                        onClick={() => {
                          setMode("view");
                          setActionError(null);
                        }}
                        className="px-6 py-3 border border-ink/20 font-display uppercase tracking-widest text-sm rounded-sm hover:border-ink/50"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sage uppercase text-[11px] tracking-widest">
        {label}
      </span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-sage mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-ink/15 rounded-sm px-3 py-2 text-sm"
      />
    </label>
  );
}

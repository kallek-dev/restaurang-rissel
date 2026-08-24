"use client";

import { useState } from "react";

type TableType = {
  id: string;
  label: string;
  seats: number;
  minPeople: number;
  count: number;
  maxPerSlot?: number;
};

export type Settings = {
  id: number;
  systemOpen: boolean;
  openDays: number[];
  sittings: string[];
  sittingWindowMinutes: number;
  slotIntervalMinutes: number;
  maxTablesPerSlot: number;
  tableTypes: TableType[];
  maxOnlinePartySize: number;
  contactEmail: string;
  retentionMonths: number;
  restaurantName: string;
};

const WEEKDAYS = [
  { value: 1, label: "Mån" },
  { value: 2, label: "Tis" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lör" },
  { value: 0, label: "Sön" },
];

type Props = {
  settings: Settings;
  saveSettings: (patch: Partial<Settings>) => void;
  saving: boolean;
  saved: boolean;
};

export default function SettingsTab({ settings, saveSettings, saving, saved }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function toggleWeekday(day: number) {
    const has = settings.openDays.includes(day);
    const next = has
      ? settings.openDays.filter((d) => d !== day)
      : [...settings.openDays, day];
    saveSettings({ openDays: next });
  }

  function updateTableTypeCount(id: string, count: number) {
    const next = settings.tableTypes.map((t) =>
      t.id === id ? { ...t, count } : t
    );
    saveSettings({ tableTypes: next });
  }

  function updateTableTypeMaxPerSlot(id: string, value: string) {
    const maxPerSlot = value.trim() === "" ? undefined : Number(value);
    const next = settings.tableTypes.map((t) =>
      t.id === id ? { ...t, maxPerSlot } : t
    );
    saveSettings({ tableTypes: next });
  }

  return (
    <div className="space-y-12">
      {/* Systemstatus */}
      <section className="border border-ink/10 rounded-sm p-6 bg-paper-50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display uppercase text-lg tracking-wide">
              Bokningssystem
            </h2>
            <p className="text-sm text-sage mt-1">
              {settings.systemOpen
                ? "Öppet — gäster kan boka bord."
                : "Stängt — bokningssidan visar ett meddelande istället."}
            </p>
          </div>
          <ToggleButton
            active={settings.systemOpen}
            onClick={() => saveSettings({ systemOpen: !settings.systemOpen })}
            labelOn="Öppet"
            labelOff="Stängt"
          />
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-sage mb-2">
            Öppna dagar
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((w) => {
              const active = settings.openDays.includes(w.value);
              return (
                <button
                  key={w.value}
                  onClick={() => toggleWeekday(w.value)}
                  className={[
                    "px-4 py-2 rounded-sm border text-sm font-medium transition-colors",
                    active
                      ? "bg-ink text-paper border-ink"
                      : "border-ink/20 text-ink/50 hover:border-ink/50",
                  ].join(" ")}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        {(saving || saved) && (
          <p className="text-xs text-sage mt-4 font-mono">
            {saving ? "Sparar…" : "Sparat ✓"}
          </p>
        )}
      </section>

      {/* Avancerat */}
      <section className="border border-ink/10 rounded-sm p-6">
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="font-display uppercase text-lg tracking-wide flex items-center gap-2"
        >
          Avancerade inställningar
          <span className="text-sage text-sm font-body">
            {advancedOpen ? "▲" : "▼"}
          </span>
        </button>

        {advancedOpen && (
          <div className="mt-6 space-y-10">
            <SettingsGroup title="Restaurangens uppgifter">
              <TextField
                label="Restaurangens namn"
                value={settings.restaurantName}
                onCommit={(v) => saveSettings({ restaurantName: v })}
              />
              <TextField
                label="Kontaktmail (frågor & stora sällskap)"
                value={settings.contactEmail}
                onCommit={(v) => saveSettings({ contactEmail: v })}
              />
            </SettingsGroup>

            <SettingsGroup title="Öppettider & sittningar">
              <TextField
                label="Sittningstider (kommaseparerat, t.ex. 11:30,12:30)"
                value={settings.sittings.join(",")}
                onCommit={(v) =>
                  saveSettings({
                    sittings: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
              <NumberField
                label="Hur länge varje sittning tar emot ankomster (minuter)"
                value={settings.sittingWindowMinutes}
                onCommit={(v) => saveSettings({ sittingWindowMinutes: v })}
              />
              <NumberField
                label="Minuter mellan varje bokningsbart klockslag"
                value={settings.slotIntervalMinutes}
                onCommit={(v) => saveSettings({ slotIntervalMinutes: v })}
              />
              <p className="text-xs text-sage sm:col-span-2">
                Exempel: sittning 11:30, fönster 60 min, intervall 15 min
                → bokningsbara tider blir 11:30, 11:45, 12:00, 12:15.
              </p>
            </SettingsGroup>

            <SettingsGroup title="Bokningsregler">
              <NumberField
                label="Max bord per kvart (oavsett typ)"
                value={settings.maxTablesPerSlot}
                onCommit={(v) => saveSettings({ maxTablesPerSlot: v })}
              />
              <NumberField
                label="Störst sällskap som får boka online"
                value={settings.maxOnlinePartySize}
                onCommit={(v) => saveSettings({ maxOnlinePartySize: v })}
              />
            </SettingsGroup>

            <SettingsGroup title="Bordstyper">
              <div className="sm:col-span-2">
                <p className="text-xs text-sage mb-3">
                  &quot;Max samtidigt&quot; är valfritt — sätt ett tal om ni
                  t.ex. inte vill att för många fyrbord ska sitta ner i
                  samma kvart (annars sprids bokningarna bara ut av den
                  generella kvarts-gränsen ovan, oavsett bordstyp). Lämna
                  tomt för ingen extra gräns.
                </p>
                <div className="space-y-2">
                  {settings.tableTypes.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center gap-4 border border-ink/10 rounded-sm p-3"
                    >
                      <span className="font-medium min-w-[140px]">
                        {t.label}
                      </span>
                      <span className="text-xs text-sage">
                        {t.minPeople}–{t.seats} personer
                      </span>
                      <label className="flex items-center gap-2 ml-auto text-sm">
                        Antal bord
                        <input
                          type="number"
                          min={0}
                          defaultValue={t.count}
                          onBlur={(e) =>
                            updateTableTypeCount(
                              t.id,
                              Number(e.target.value) || 0
                            )
                          }
                          className="w-20 border border-ink/20 rounded-sm px-2 py-1"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        Max samtidigt / kvart
                        <input
                          type="number"
                          min={0}
                          placeholder="ingen gräns"
                          defaultValue={t.maxPerSlot ?? ""}
                          onBlur={(e) =>
                            updateTableTypeMaxPerSlot(t.id, e.target.value)
                          }
                          className="w-28 border border-ink/20 rounded-sm px-2 py-1"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </SettingsGroup>

            <SettingsGroup title="GDPR">
              <NumberField
                label="Spara bokningar i (månader)"
                value={settings.retentionMonths}
                onCommit={(v) => saveSettings({ retentionMonths: v })}
              />
              <p className="text-xs text-sage sm:col-span-2">
                Bokningar (namn, mail, telefon, ev. allergier) raderas
                automatiskt varje natt när de blir äldre än detta.
                Ändringen gäller från nästa körning, inte bakåt i tiden.
              </p>
            </SettingsGroup>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-6 border-t border-ink/10 first:pt-0 first:border-t-0">
      <p className="text-xs uppercase tracking-widest text-sage mb-3">
        {title}
      </p>
      <div className="grid sm:grid-cols-2 gap-6">{children}</div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  labelOn,
  labelOff,
}: {
  active: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-5 py-2 rounded-sm font-display uppercase tracking-widest text-sm transition-colors",
        active ? "bg-sage text-white" : "bg-brick text-white",
      ].join(" ")}
    >
      {active ? labelOn : labelOff}
    </button>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-widest text-sage mb-1">
        {label}
      </span>
      <input
        type="number"
        defaultValue={value}
        onBlur={(e) => onCommit(Number(e.target.value) || 0)}
        className="w-full border border-ink/20 rounded-sm px-3 py-2"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-widest text-sage mb-1">
        {label}
      </span>
      <input
        type="text"
        defaultValue={value}
        onBlur={(e) => onCommit(e.target.value)}
        className="w-full border border-ink/20 rounded-sm px-3 py-2"
      />
    </label>
  );
}

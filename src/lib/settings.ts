import { prisma } from "./prisma";

export type TableType = {
  id: string;
  label: string;
  seats: number;
  minPeople: number;
  count: number;
  // Valfri: max antal bord av DEN HÄR typen som får sitta ner samtidigt
  // i samma kvart, utöver den generella maxTablesPerSlot-gränsen.
  // Lämnas den odefinierad gäller ingen extra begränsning för typen.
  // Används t.ex. för att sprida ut fyrbord över fler kvartar, så inte
  // för många stora sällskap dyker upp samtidigt.
  maxPerSlot?: number;
};

export type AppSettings = {
  id: number;
  systemOpen: boolean;
  openDays: number[]; // 0=sön ... 6=lör
  sittings: string[]; // ["11:30","12:30"]
  sittingWindowMinutes: number;
  slotIntervalMinutes: number;
  maxTablesPerSlot: number;
  tableTypes: TableType[];
  maxOnlinePartySize: number;
  contactEmail: string;
  retentionMonths: number;
  restaurantName: string;
};

// Publikt säkert urval av inställningar (det som bokningssidan får se).
export type PublicSettings = Pick<
  AppSettings,
  | "systemOpen"
  | "openDays"
  | "sittings"
  | "maxOnlinePartySize"
  | "contactEmail"
  | "retentionMonths"
  | "restaurantName"
>;

function toAppSettings(row: {
  id: number;
  systemOpen: boolean;
  openDaysJson: string;
  sittingsJson: string;
  sittingWindowMinutes: number;
  slotIntervalMinutes: number;
  maxTablesPerSlot: number;
  tableTypesJson: string;
  maxOnlinePartySize: number;
  contactEmail: string;
  retentionMonths: number;
  restaurantName: string;
}): AppSettings {
  return {
    id: row.id,
    systemOpen: row.systemOpen,
    openDays: JSON.parse(row.openDaysJson),
    sittings: JSON.parse(row.sittingsJson),
    sittingWindowMinutes: row.sittingWindowMinutes,
    slotIntervalMinutes: row.slotIntervalMinutes,
    maxTablesPerSlot: row.maxTablesPerSlot,
    tableTypes: JSON.parse(row.tableTypesJson),
    maxOnlinePartySize: row.maxOnlinePartySize,
    contactEmail: row.contactEmail,
    retentionMonths: row.retentionMonths,
    restaurantName: row.restaurantName,
  };
}

// Hämtar inställningsraden (skapar en med standardvärden om den saknas).
export async function getSettings(): Promise<AppSettings> {
  let row = await prisma.settings.findFirst({ orderBy: { id: "asc" } });
  if (!row) {
    row = await prisma.settings.create({ data: {} });
  }
  return toAppSettings(row);
}

export function toPublicSettings(settings: AppSettings): PublicSettings {
  return {
    systemOpen: settings.systemOpen,
    openDays: settings.openDays,
    sittings: settings.sittings,
    maxOnlinePartySize: settings.maxOnlinePartySize,
    contactEmail: settings.contactEmail,
    retentionMonths: settings.retentionMonths,
    restaurantName: settings.restaurantName,
  };
}

export type SettingsUpdateInput = Partial<{
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
}>;

export async function updateSettings(
  input: SettingsUpdateInput
): Promise<AppSettings> {
  const current = await getSettings();

  const data: Record<string, unknown> = {};
  if (input.systemOpen !== undefined) data.systemOpen = input.systemOpen;
  if (input.openDays !== undefined)
    data.openDaysJson = JSON.stringify(input.openDays);
  if (input.sittings !== undefined)
    data.sittingsJson = JSON.stringify(input.sittings);
  if (input.sittingWindowMinutes !== undefined)
    data.sittingWindowMinutes = input.sittingWindowMinutes;
  if (input.slotIntervalMinutes !== undefined)
    data.slotIntervalMinutes = input.slotIntervalMinutes;
  if (input.maxTablesPerSlot !== undefined)
    data.maxTablesPerSlot = input.maxTablesPerSlot;
  if (input.tableTypes !== undefined)
    data.tableTypesJson = JSON.stringify(input.tableTypes);
  if (input.maxOnlinePartySize !== undefined)
    data.maxOnlinePartySize = input.maxOnlinePartySize;
  if (input.contactEmail !== undefined)
    data.contactEmail = input.contactEmail;
  if (input.retentionMonths !== undefined)
    data.retentionMonths = input.retentionMonths;
  if (input.restaurantName !== undefined)
    data.restaurantName = input.restaurantName;

  const row = await prisma.settings.update({
    where: { id: current.id },
    data,
  });
  return toAppSettings(row);
}

export const DUNGEON_MASTER_ID = "1496164e-1897-496a-a4ce-416ec19b7d89";

export function isDungeonMaster(id: string) {
  return id.toLowerCase() === DUNGEON_MASTER_ID;
}

export const BADGE_IDS = [
  "dd_resist",
  "dd_ano",
  "pandemic_new",
  "pandemic_history",
  "pandemic_delete",
  "donate_beer",
  "donate_kobliha",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export type Badge = {
  id: BadgeId;
  src: string;
  title: string;
  description: string;
};

export const HEADER_BADGE_LIMIT = 4;

export const BADGES: readonly Badge[] = [
  {
    id: "dd_resist",
    src: `/Images/${encodeURIComponent("D&D-resist.jpg")}`,
    title: "Poslušný ovčan",
    description:
      "Sklonil ses před Pánem jeskyně a uznal chybu. Doupě tě tentokrát nechalo odejít.",
  },
  {
    id: "dd_ano",
    src: "/Images/ANO.jpg",
    title: "Bude líp",
    description:
      "Koblihový renegát. Na varování jsi kašlal a loot sis vzal i tak.",
  },
  {
    id: "pandemic_new",
    src: "/Images/Pandemic-New-Game.jpg",
    title: "První dávka",
    description: "Poprvé jsi zapsal novou partii Pandemicu.",
  },
  {
    id: "pandemic_history",
    src: "/Images/Pandemic-History.jpg",
    title: "Přepis z archivu",
    description:
      "Poprvé jsi přepsal historický formulář a starou partii uložil do databáze.",
  },
  {
    id: "pandemic_delete",
    src: "/Images/Pandemic-Delete.jpg",
    title: "Vymazaná nákaza",
    description:
      "Poprvé jsi ve statistikách smazal partii. Ze záznamů zmizela, odznak zůstává.",
  },
  {
    id: "donate_beer",
    src: "/Images/PIVO.jpg",
    title: "Svatý slib",
    description:
      "Slíbil jsi Gartovi pivo. Džbánov si to zapsal a pěna na tomhle slibu neopadla.",
  },
  {
    id: "donate_kobliha",
    src: "/Images/KOBLIHA.jpg",
    title: "Kobliha pro Garta",
    description:
      "Dal jsi Gartovi koblihu. Žádná brána, žádný poplatek, jen cukr na správném místě.",
  },
];

const BADGE_ID_SET = new Set<string>(BADGE_IDS);

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === "string" && BADGE_ID_SET.has(value);
}

export function badgeById(id: BadgeId): Badge {
  const badge = BADGES.find((item) => item.id === id);
  if (!badge) {
    throw new Error(`Neznámý odznak ${id}.`);
  }
  return badge;
}

export type EarnedBadges = Partial<Record<BadgeId, string>>;

export type BadgeStorageShape = "map" | "list";

function isEarnedAt(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function badgeStorageShape(value: unknown): BadgeStorageShape {
  return Array.isArray(value) ? "list" : "map";
}

export function serializeEarnedBadges(earned: EarnedBadges, shape: BadgeStorageShape) {
  if (shape === "map") return earned;
  return earnedBadgeIds(earned).map((id) => `${id}|${earned[id]}`);
}

export function parseEarnedBadges(value: unknown): EarnedBadges {
  const earned: EarnedBadges = {};

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "string") continue;
      const pipe = item.indexOf("|");
      if (pipe <= 0) continue;
      const id = item.slice(0, pipe);
      const at = item.slice(pipe + 1);
      if (!isBadgeId(id) || !isEarnedAt(at)) continue;
      earned[id] = new Date(at).toISOString();
    }
    return earned;
  }

  if (!value || typeof value !== "object") return earned;

  const record = value as Record<string, unknown>;
  for (const id of BADGE_IDS) {
    const at = record[id];
    if (typeof at !== "string" || !isEarnedAt(at)) continue;
    earned[id] = new Date(at).toISOString();
  }
  return earned;
}

export function earnedBadgeIds(earned: EarnedBadges): BadgeId[] {
  return BADGE_IDS.filter((id) => typeof earned[id] === "string");
}

export function formatEarnedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function sampleBadges(
  owned: readonly BadgeId[],
  limit: number,
  prefer?: BadgeId | null,
): Badge[] {
  const pool = BADGES.filter((badge) => owned.includes(badge.id));
  const shuffled = [...pool];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swap];
    shuffled[swap] = current;
  }

  const picked = shuffled.slice(0, limit);
  if (!prefer || !owned.includes(prefer) || picked.some((badge) => badge.id === prefer)) {
    return picked;
  }

  const preferred = badgeById(prefer);
  if (picked.length < limit) return [preferred, ...picked];
  return [preferred, ...picked.slice(0, limit - 1)];
}

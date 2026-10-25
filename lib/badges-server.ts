import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BADGE_IDS,
  badgeStorageShape,
  isBadgeId,
  parseEarnedBadges,
  serializeEarnedBadges,
  type BadgeId,
  type BadgeStorageShape,
  type EarnedBadges,
} from "@/lib/badges";

type BadgeWriteError = { message: string; code?: string };

export type BadgeGrant =
  | { ok: true; granted: boolean; id: BadgeId; earnedAt: string; badges: EarnedBadges }
  | { ok: false; error: string };

function shapeMismatch(error: BadgeWriteError) {
  const message = error.message.toLowerCase();
  return (
    error.code === "22P02" ||
    message.includes("text[]") ||
    message.includes("jsonb") ||
    message.includes("malformed array") ||
    message.includes("invalid input syntax") ||
    message.includes("array value")
  );
}

function oppositeShape(shape: BadgeStorageShape): BadgeStorageShape {
  return shape === "list" ? "map" : "list";
}

async function writeBadges(
  supabase: SupabaseClient,
  userId: string,
  earned: EarnedBadges,
  exists: boolean,
  shape: BadgeStorageShape,
) {
  const badges = serializeEarnedBadges(earned, shape);
  if (!exists) {
    return supabase.from("profiles").insert({ id: userId, badges });
  }
  return supabase.from("profiles").update({ badges }).eq("id", userId);
}

export async function saveEarnedBadges(
  supabase: SupabaseClient,
  userId: string,
  earned: EarnedBadges,
  currentValue: unknown,
  exists: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const preferred = badgeStorageShape(currentValue);
  const first = await writeBadges(supabase, userId, earned, exists, preferred);
  if (!first.error) return { ok: true };

  if (!shapeMismatch(first.error)) {
    console.error("Odznak se nepodařilo uložit.", first.error.message);
    return { ok: false, error: "Odznak se nepodařilo uložit." };
  }

  const second = await writeBadges(supabase, userId, earned, exists, oppositeShape(preferred));
  if (!second.error) return { ok: true };

  console.error("Odznak se nepodařilo uložit.", second.error.message);
  return { ok: false, error: "Odznak se nepodařilo uložit." };
}

async function readProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("badges")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Odznak se nepodařilo načíst.", error.message);
    return { ok: false as const, error: "Odznak se nepodařilo uložit." };
  }

  return { ok: true as const, profile: data };
}

export async function grantBadge(
  supabase: SupabaseClient,
  userId: string,
  badge: BadgeId,
): Promise<BadgeGrant> {
  if (!isBadgeId(badge) || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return { ok: false, error: "Odznak se nepodařilo uložit." };
  }

  const loaded = await readProfile(supabase, userId);
  if (!loaded.ok) return loaded;

  const owned = parseEarnedBadges(loaded.profile?.badges);
  const existing = owned[badge];
  if (existing) {
    return { ok: true, granted: false, id: badge, earnedAt: existing, badges: owned };
  }

  const earnedAt = new Date().toISOString();
  const badges: EarnedBadges = { ...owned, [badge]: earnedAt };
  const saved = await saveEarnedBadges(
    supabase,
    userId,
    badges,
    loaded.profile?.badges,
    Boolean(loaded.profile),
  );
  if (!saved.ok) return saved;

  return { ok: true, granted: true, id: badge, earnedAt, badges };
}

export async function grantEveryBadge(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; badges: EarnedBadges } | { ok: false; error: string }> {
  const loaded = await readProfile(supabase, userId);
  if (!loaded.ok) return { ok: false, error: "Odznaky se nepodařilo přidat." };

  const current = parseEarnedBadges(loaded.profile?.badges);
  const earnedAt = new Date().toISOString();
  const badges: EarnedBadges = {};
  for (const id of BADGE_IDS) {
    badges[id] = current[id] ?? earnedAt;
  }

  const saved = await saveEarnedBadges(
    supabase,
    userId,
    badges,
    loaded.profile?.badges,
    Boolean(loaded.profile),
  );
  if (!saved.ok) return { ok: false, error: "Odznaky se nepodařilo přidat." };
  return { ok: true, badges };
}

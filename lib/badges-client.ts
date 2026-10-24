"use client";

import { createClient } from "@/lib/supabase/client";
import {
  BADGE_IDS,
  isBadgeId,
  parseBadges,
  type BadgeId,
} from "@/lib/badges";

type BadgeUpdate =
  | { type: "grant"; id: BadgeId }
  | { type: "reset" }
  | { type: "sync"; ids: BadgeId[] };

const listeners = new Set<(update: BadgeUpdate) => void>();
const pendingGrants = new Set<BadgeId>();

let known: Set<BadgeId> | null = null;
let resetEpoch = 0;

function remember(ids: readonly BadgeId[]) {
  known = new Set(ids);
}

export function subscribeBadges(listener: (update: BadgeUpdate) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function replaceOwnedBadges(ids: readonly BadgeId[]) {
  const next = BADGE_IDS.filter((id) => ids.includes(id));
  resetEpoch += 1;
  pendingGrants.clear();
  remember(next);
  listeners.forEach((listener) => listener({ type: "sync", ids: next }));
}

export async function grantAllBadges() {
  const response = await fetch("/api/badges/grant-all", { method: "POST" });
  const payload = (await response.json().catch(() => null)) as { error?: string; badges?: unknown } | null;

  if (!response.ok) {
    return {
      ok: false as const,
      error: payload?.error ?? "Odznaky se nepodařilo přidat.",
    };
  }

  const ids = Array.isArray(payload?.badges)
    ? payload.badges.filter((id): id is BadgeId => isBadgeId(id))
    : [...BADGE_IDS];
  replaceOwnedBadges(ids);
  return { ok: true as const };
}

export function announceBadge(id: BadgeId) {
  const already = known?.has(id) ?? false;
  pendingGrants.add(id);
  if (known) known.add(id);
  else known = new Set([id]);
  if (already) return;
  listeners.forEach((listener) => listener({ type: "grant", id }));
}

export async function loadUserBadges(): Promise<BadgeId[]> {
  const epoch = resetEpoch;
  const supabase = createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user || epoch !== resetEpoch) {
    return [...(known ?? [])];
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("badges, has_achievement_42, has_achievement_ano")
    .eq("id", data.user.id)
    .maybeSingle();

  if (epoch !== resetEpoch) return [...(known ?? [])];

  let loaded = profile ? parseBadges(profile.badges, profile) : [];
  if (error) {
    const legacy = await supabase
      .from("profiles")
      .select("has_achievement_42, has_achievement_ano")
      .eq("id", data.user.id)
      .maybeSingle();
    if (epoch !== resetEpoch) return [...(known ?? [])];
    loaded = legacy.data ? parseBadges(null, legacy.data) : [...(known ?? [])];
  }
  for (const id of pendingGrants) {
    if (!loaded.includes(id)) loaded.push(id);
  }
  pendingGrants.clear();
  remember(loaded);
  return loaded;
}

export async function grantOwnBadge(id: BadgeId) {
  if (known?.has(id)) {
    return { ok: true as const, granted: false };
  }

  const supabase = createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    return {
      ok: false as const,
      error: "Pro uložení odznaku se musíš přihlásit.",
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("badges, has_achievement_42, has_achievement_ano")
    .eq("id", data.user.id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: "Odznak se nepodařilo uložit." };
  }

  const owned = parseBadges(profile?.badges, profile);
  remember(owned);
  if (owned.includes(id)) {
    return { ok: true as const, granted: false };
  }

  const next = [...owned, id];
  const { error: writeError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    badges: next,
    has_achievement_42: next.includes("dd_resist"),
    has_achievement_ano: next.includes("dd_ano"),
  });

  if (writeError) {
    return { ok: false as const, error: "Odznak se nepodařilo uložit." };
  }

  announceBadge(id);
  remember(next);
  return { ok: true as const, granted: true };
}

export async function resetUserBadges() {
  const supabase = createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    return {
      ok: false as const,
      error: "Pro zahození odznaků se musíš přihlásit.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      badges: [],
      has_achievement_42: false,
      has_achievement_ano: false,
    })
    .eq("id", data.user.id);

  if (error) {
    const { error: legacyError } = await supabase
      .from("profiles")
      .update({
        has_achievement_42: false,
        has_achievement_ano: false,
      })
      .eq("id", data.user.id);

    if (legacyError) {
      return { ok: false as const, error: "Odznaky se nepodařilo zahodit." };
    }
  }

  resetEpoch += 1;
  pendingGrants.clear();
  known = new Set();
  listeners.forEach((listener) => listener({ type: "reset" }));
  return { ok: true as const };
}

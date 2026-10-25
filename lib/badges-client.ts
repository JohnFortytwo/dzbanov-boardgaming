"use client";

import { createClient } from "@/lib/supabase/client";
import {
  BADGE_IDS,
  badgeStorageShape,
  earnedBadgeIds,
  isBadgeId,
  parseEarnedBadges,
  serializeEarnedBadges,
  type BadgeId,
  type BadgeStorageShape,
  type EarnedBadges,
} from "@/lib/badges";

type BadgeUpdate =
  | { type: "grant"; id: BadgeId; earnedAt: string }
  | { type: "reset" }
  | { type: "sync"; earned: EarnedBadges };

const listeners = new Set<(update: BadgeUpdate) => void>();
const pendingGrants = new Map<BadgeId, string>();

let known: EarnedBadges | null = null;
let resetEpoch = 0;

function remember(earned: EarnedBadges) {
  known = { ...earned };
}

async function clearStoredBadges(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  shape: BadgeStorageShape,
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      badges: serializeEarnedBadges({}, shape),
      has_achievement_42: false,
      has_achievement_ano: false,
    })
    .eq("id", userId);

  return !error;
}

function snapshotKnown(): EarnedBadges {
  return { ...(known ?? {}) };
}

export function subscribeBadges(listener: (update: BadgeUpdate) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function replaceEarnedBadges(earned: EarnedBadges) {
  const next = parseEarnedBadges(earned);
  resetEpoch += 1;
  pendingGrants.clear();
  remember(next);
  listeners.forEach((listener) => listener({ type: "sync", earned: next }));
}

export async function grantAllBadges() {
  const response = await fetch("/api/badges/grant-all", { method: "POST" });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    badges?: unknown;
  } | null;

  if (!response.ok) {
    return {
      ok: false as const,
      error: payload?.error ?? "Odznaky se nepodařilo přidat.",
    };
  }

  const earned = parseEarnedBadges(payload?.badges);
  const fallbackAt = new Date().toISOString();
  if (earnedBadgeIds(earned).length === 0) {
    for (const id of BADGE_IDS) earned[id] = fallbackAt;
  }
  replaceEarnedBadges(earned);
  return { ok: true as const };
}

export function announceBadge(id: BadgeId, earnedAt: string) {
  const at = Number.isNaN(Date.parse(earnedAt)) ? new Date().toISOString() : new Date(earnedAt).toISOString();
  const already = Boolean(known?.[id]);
  pendingGrants.set(id, at);
  if (!known) known = {};
  if (!known[id]) known[id] = at;
  if (already) return;
  listeners.forEach((listener) => listener({ type: "grant", id, earnedAt: at }));
}

export function announceBadgeFromPayload(badge: unknown, earnedAt: unknown) {
  if (!isBadgeId(badge)) return;
  announceBadge(badge, typeof earnedAt === "string" ? earnedAt : new Date().toISOString());
}

export async function loadUserBadges(): Promise<EarnedBadges> {
  const epoch = resetEpoch;
  const supabase = createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user || epoch !== resetEpoch) {
    return snapshotKnown();
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("badges")
    .eq("id", data.user.id)
    .maybeSingle();

  if (epoch !== resetEpoch) return snapshotKnown();
  if (error) return snapshotKnown();

  const loaded = parseEarnedBadges(profile?.badges);
  for (const [id, earnedAt] of pendingGrants) {
    if (!loaded[id]) loaded[id] = earnedAt;
  }
  pendingGrants.clear();
  remember(loaded);
  return loaded;
}

export async function grantOwnBadge(id: BadgeId) {
  if (known?.[id]) {
    return { ok: true as const, granted: false };
  }

  const response = await fetch("/api/badges/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    granted?: boolean;
    badge?: unknown;
    earned_at?: unknown;
    badges?: unknown;
  } | null;

  if (!response.ok) {
    return {
      ok: false as const,
      error: payload?.error ?? "Odznak se nepodařilo uložit.",
    };
  }

  if (payload?.granted && isBadgeId(payload.badge)) {
    const earnedAt = typeof payload.earned_at === "string" ? payload.earned_at : new Date().toISOString();
    announceBadge(payload.badge, earnedAt);
  }

  const earned = parseEarnedBadges(payload?.badges);
  if (earnedBadgeIds(earned).length > 0) remember(earned);

  return { ok: true as const, granted: Boolean(payload?.granted && isBadgeId(payload.badge)) };
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("badges")
    .eq("id", data.user.id)
    .maybeSingle();

  const preferred = badgeStorageShape(profile?.badges);
  const cleared = await clearStoredBadges(supabase, data.user.id, preferred);
  if (!cleared) {
    const fallback = preferred === "list" ? "map" : "list";
    const retried = await clearStoredBadges(supabase, data.user.id, fallback);
    if (!retried) {
      return { ok: false as const, error: "Odznaky se nepodařilo zahodit." };
    }
  }

  resetEpoch += 1;
  pendingGrants.clear();
  known = {};
  listeners.forEach((listener) => listener({ type: "reset" }));
  return { ok: true as const };
}

"use client";

import { createClient } from "@/lib/supabase/client";

export const ACHIEVEMENT_FLAGS = [
  "has_achievement_42",
  "has_achievement_ano",
] as const;

export type AchievementFlag = (typeof ACHIEVEMENT_FLAGS)[number];

export type UserAchievements = {
  has_achievement_42: boolean;
  has_achievement_ano: boolean;
};

const emptyAchievements: UserAchievements = {
  has_achievement_42: false,
  has_achievement_ano: false,
};

const listeners = new Set<(flag: AchievementFlag) => void>();

export function subscribeAchievement(
  listener: (flag: AchievementFlag) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadUserAchievements(): Promise<UserAchievements> {
  const supabase = createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    return emptyAchievements;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("has_achievement_42, has_achievement_ano")
    .eq("id", data.user.id)
    .maybeSingle();

  if (error || !profile) {
    return emptyAchievements;
  }

  return {
    has_achievement_42: profile.has_achievement_42 === true,
    has_achievement_ano: profile.has_achievement_ano === true,
  };
}

export async function setUserAchievement(flag: AchievementFlag) {
  const supabase = createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    return {
      ok: false as const,
      error: "Pro uložení achievementu se musíte přihlásit.",
    };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: data.user.id,
    [flag]: true,
  });

  if (error) {
    return {
      ok: false as const,
      error: "Achievement se nepodařilo uložit.",
    };
  }

  listeners.forEach((listener) => listener(flag));

  return { ok: true as const };
}

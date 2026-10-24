import { supabaseAdmin } from "@/lib/supabase/admin";
import { isBadgeId, parseBadges, type BadgeId } from "@/lib/badges";

export async function grantBadge(
  userId: string,
  badge: BadgeId,
): Promise<BadgeId | null> {
  if (!isBadgeId(badge) || !/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("badges, has_achievement_42, has_achievement_ano")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Odznak se nepodařilo načíst.", error.message);
    return null;
  }

  const owned = parseBadges(data?.badges, data);
  if (owned.includes(badge)) return null;

  const { error: writeError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    badges: [...owned, badge],
  });

  if (writeError) {
    console.error("Odznak se nepodařilo uložit.", writeError.message);
    return null;
  }
  return badge;
}

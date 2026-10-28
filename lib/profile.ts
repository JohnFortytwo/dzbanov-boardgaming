import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadOwnNickname(supabase: SupabaseClient, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return "";

  const { data, error } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .maybeSingle();

  if (error || typeof data?.nickname !== "string") return "";
  return data.nickname;
}

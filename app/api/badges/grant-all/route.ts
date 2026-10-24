import { connection } from "next/server";
import { BADGE_IDS, isDungeonMaster } from "@/lib/badges";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";

  if (!data?.claims || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return Response.json({ error: "Nejsi přihlášený." }, { status: 401 });
  }

  if (!isDungeonMaster(userId)) {
    return Response.json({ error: "Tohle tlačítko není tvoje." }, { status: 403 });
  }

  const badges = [...BADGE_IDS];
  const { error } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    badges,
    has_achievement_42: true,
    has_achievement_ano: true,
  });

  if (error) {
    return Response.json({ error: "Odznaky se nepodařilo přidat." }, { status: 500 });
  }

  return Response.json({ ok: true, badges });
}

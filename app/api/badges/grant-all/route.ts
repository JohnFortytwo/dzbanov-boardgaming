import { connection } from "next/server";
import { isDungeonMaster } from "@/lib/badges";
import { grantEveryBadge } from "@/lib/badges-server";
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

  const result = await grantEveryBadge(supabase, userId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true, badges: result.badges });
}

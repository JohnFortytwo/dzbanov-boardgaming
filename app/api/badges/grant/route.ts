import { connection } from "next/server";
import { isBadgeId } from "@/lib/badges";
import { grantBadge } from "@/lib/badges-server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";

  if (!data?.claims || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return Response.json({ error: "Pro uložení odznaku se musíš přihlásit." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Odznak se nepodařilo uložit." }, { status: 400 });
  }

  const id = body && typeof body === "object" ? (body as { id?: unknown }).id : null;
  if (!isBadgeId(id)) {
    return Response.json({ error: "Odznak se nepodařilo uložit." }, { status: 400 });
  }

  const result = await grantBadge(supabase, userId, id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({
    ok: true,
    granted: result.granted,
    badge: result.id,
    earned_at: result.earnedAt,
    badges: result.badges,
  });
}

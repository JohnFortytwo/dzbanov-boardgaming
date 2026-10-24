import { connection } from "next/server";
import { requirePandemicUser } from "@/lib/pandemic/auth";
import { normalizeDraftData, prepareDraft } from "@/lib/pandemic/drafts";
import { grantBadge } from "@/lib/badges-server";
import { LIVE_GAME_SOURCE, savePandemicGame } from "@/lib/pandemic/save-game";

export async function POST(request: Request) {
  await connection();
  const { userId, response } = await requirePandemicUser();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Neplatné tělo požadavku." }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const incoming = normalizeDraftData(payload.draft_data ?? payload);
  incoming.card_image_url = null;
  incoming.card_content = null;

  const { draft, errors } = prepareDraft(incoming);
  if (errors.length > 0) {
    return Response.json({ error: errors[0], errors }, { status: 400 });
  }

  const saved = await savePandemicGame(draft, {
    source: LIVE_GAME_SOURCE,
    createdBy: userId,
  });
  if ("error" in saved) {
    return Response.json({ error: saved.error }, { status: 400 });
  }

  const badge = await grantBadge(userId, "pandemic_new");
  return Response.json({ ok: true, game_id: saved.id, badge });
}

import { createClient } from "@/lib/supabase/server";
import {
  DraftQueueError,
  heartbeatDraft,
  moveDraftQueue,
  releaseDraft,
} from "@/lib/pandemic/draft-queue";

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";

  if (!data?.claims || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return {
      userId: "",
      response: Response.json({ error: "Nejste přihlášeni." }, { status: 401 }),
    };
  }

  return { userId, response: null };
}

function queueError(error: unknown) {
  if (error instanceof DraftQueueError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "Zámek karty se nepodařilo upravit." }, { status: 500 });
}

export async function POST(request: Request) {
  const { userId, response } = await requireUserId();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Neplatné tělo požadavku." }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof payload.action === "string" ? payload.action : "";
  const id = typeof payload.id === "string" ? payload.id : "";

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "Chybí identifikátor draftu." }, { status: 400 });
  }

  try {
    if (action === "release") {
      await releaseDraft(userId, id);
      return Response.json({ ok: true });
    }

    if (action === "heartbeat") {
      await heartbeatDraft(userId, id);
      return Response.json({ ok: true });
    }

    if (action === "next" || action === "previous") {
      const queue = await moveDraftQueue(userId, action, id);
      return Response.json(queue);
    }
  } catch (error) {
    return queueError(error);
  }

  return Response.json({ error: "Neznámá akce zámku." }, { status: 400 });
}

import { connection } from "next/server";
import { grantBadge } from "@/lib/badges-server";
import { requirePandemicUser } from "@/lib/pandemic/auth";
import { voidLatestGame } from "@/lib/pandemic/latest-game";

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
  const id = typeof payload.id === "string" ? payload.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "Chybí identifikátor partie." }, { status: 400 });
  }

  try {
    const result = await voidLatestGame(id, userId);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    const badge = await grantBadge(userId, "pandemic_delete");
    return Response.json({ ok: true, badge });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Partii se nepodařilo smazat.";
    return Response.json({ error: message }, { status: 500 });
  }
}

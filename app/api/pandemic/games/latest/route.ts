import { connection } from "next/server";
import { requirePandemicUser } from "@/lib/pandemic/auth";
import { loadLatestValidGame } from "@/lib/pandemic/latest-game";

export async function GET() {
  await connection();
  const { response } = await requirePandemicUser();
  if (response) return response;

  try {
    const game = await loadLatestValidGame();
    return Response.json({ game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poslední partii se nepodařilo načíst.";
    return Response.json({ error: message }, { status: 500 });
  }
}

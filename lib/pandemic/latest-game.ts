import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccountLabels } from "@/lib/pandemic/accounts";
import { loadPandemicCatalogs } from "@/lib/pandemic/catalogs";
import { foldCode } from "@/lib/pandemic/drafts";
import {
  describeRecentGame,
  type CodeName,
  type RecentGame,
  type StatsGame,
  type StatsRoleChange,
  type StatsSeat,
} from "@/lib/pandemic/stats";

const GAME_COLUMNS =
  "id, played_at, created_at, result_code, difficulty_code, game_mode_code, yellow_disease, red_disease, blue_disease, black_disease, purple_disease, virulent_strain_color, note, created_by";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asOrder(value: unknown) {
  const order = typeof value === "number" ? value : Number(value);
  return Number.isFinite(order) ? order : 0;
}

function labelMap(rows: CodeName[]) {
  const labels = new Map<string, string>();
  for (const row of rows) {
    if (!row.code) continue;
    labels.set(row.code, row.name_cs || row.code);
    labels.set(foldCode(row.code), row.name_cs || row.code);
  }
  return (code: string | null) => {
    if (!code) return "Neuvedeno";
    return labels.get(code) ?? labels.get(foldCode(code)) ?? code;
  };
}

function readGame(row: Record<string, unknown>): StatsGame | null {
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    played_at: asString(row.played_at),
    created_at: asString(row.created_at),
    result_code: asString(row.result_code),
    difficulty_code: asString(row.difficulty_code),
    game_mode_code: asString(row.game_mode_code),
    yellow_disease: asString(row.yellow_disease),
    red_disease: asString(row.red_disease),
    blue_disease: asString(row.blue_disease),
    black_disease: asString(row.black_disease),
    purple_disease: asString(row.purple_disease),
    virulent_strain_color: asString(row.virulent_strain_color),
    note: asString(row.note),
    created_by: asString(row.created_by),
  };
}

export async function findLatestValidGameId(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("pandemic_games")
    .select("id")
    .is("voided_at", null)
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return asString(data?.id);
}

export async function loadLatestValidGame(): Promise<RecentGame | null> {
  const { data, error } = await supabaseAdmin
    .from("pandemic_games")
    .select(GAME_COLUMNS)
    .is("voided_at", null)
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const game = data ? readGame(data as unknown as Record<string, unknown>) : null;
  if (!game) return null;

  const [seatResult, changeResult, catalogs, accounts] = await Promise.all([
    supabaseAdmin
      .from("pandemic_game_players")
      .select("game_id, player_id, role_code, player_order")
      .eq("game_id", game.id),
    supabaseAdmin
      .from("pandemic_game_role_changes")
      .select("game_id, player_id, from_role_code, to_role_code, change_order")
      .eq("game_id", game.id),
    loadPandemicCatalogs(),
    loadAccountLabels(),
  ]);

  if (seatResult.error) throw new Error(seatResult.error.message);
  if (changeResult.error) throw new Error(changeResult.error.message);

  const seats: StatsSeat[] = (seatResult.data ?? []).map((row) => ({
    game_id: game.id,
    player_id: asString(row.player_id),
    role_code: asString(row.role_code),
    player_order: asOrder(row.player_order),
  }));
  const changes: StatsRoleChange[] = (changeResult.data ?? []).map((row) => ({
    game_id: game.id,
    player_id: asString(row.player_id),
    from_role_code: asString(row.from_role_code),
    to_role_code: asString(row.to_role_code),
    change_order: asOrder(row.change_order),
  }));

  const players = new Map(catalogs.players.map((player) => [player.id, player.name]));
  const role = labelMap(catalogs.roles);
  const result = labelMap(catalogs.gameResults);
  const mode = labelMap(catalogs.gameModes);
  const difficulty = labelMap(catalogs.difficulties);
  const disease = labelMap(catalogs.diseaseStates);
  const strain = labelMap(catalogs.virulentStrainColors);

  return describeRecentGame(game, seats, changes, {
    player: (playerId) => (playerId && players.get(playerId)) || "Neznámý hráč",
    role,
    result,
    mode,
    difficulty,
    disease,
    strain,
    account: (userId) => {
      if (!userId) return null;
      return accounts.get(userId) ?? "Neznámý účet";
    },
  });
}

export async function voidLatestGame(
  gameId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const latestId = await findLatestValidGameId();
  if (!latestId) {
    return { ok: false, status: 404, error: "V databázi není žádná platná partie." };
  }
  if (latestId !== gameId) {
    return {
      ok: false,
      status: 409,
      error: "Tahle partie už není poslední uložená. Obnovte statistiky a zkuste to znovu.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("pandemic_games")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: userId,
    })
    .eq("id", gameId)
    .is("voided_at", null)
    .select("id");

  if (error) {
    return { ok: false, status: 500, error: `Partii se nepodařilo smazat. ${error.message}` };
  }
  if (!data?.length) {
    return {
      ok: false,
      status: 409,
      error: "Partii se nepodařilo smazat. Obnovte statistiky a zkuste to znovu.",
    };
  }

  return { ok: true };
}

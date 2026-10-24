import { createClient as createAdminClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { loadAccountLabels } from "@/lib/pandemic/accounts";
import {
  buildPandemicStatsBundle,
  type CodeName,
  type StatsGame,
  type StatsRoleChange,
  type StatsSeat,
  type StatsSource,
} from "@/lib/pandemic/stats";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Chybí přístup k databázi.");
  }
  return createAdminClient(url, key);
}

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const supabase = adminClient();
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) {
      throw new Error(error.message);
    }
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function fetchCodes(table: string): Promise<CodeName[]> {
  const supabase = adminClient();
  const { data, error } = await supabase.from(table).select("code, name_cs");
  if (error || !data) return [];
  return data.flatMap((row) => {
    const code = typeof row.code === "string" ? row.code.trim() : "";
    if (!code) return [];
    const name =
      typeof row.name_cs === "string" && row.name_cs.trim() ? row.name_cs.trim() : code;
    return [{ code, name_cs: name }];
  });
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function loadPandemicStats() {
  await connection();

  const [gameRows, seatRows, changeRows, playerRows, roles, modes, difficulties, results, diseaseStates, strainColors, accounts] =
    await Promise.all([
      fetchAll<Record<string, unknown>>(
        "pandemic_games",
        "id, played_at, created_at, result_code, difficulty_code, game_mode_code, yellow_disease, red_disease, blue_disease, black_disease, purple_disease, virulent_strain_color, note, created_by, voided_at",
      ),
      fetchAll<Record<string, unknown>>(
        "pandemic_game_players",
        "game_id, player_id, role_code, player_order",
      ),
      fetchAll<Record<string, unknown>>(
        "pandemic_game_role_changes",
        "game_id, player_id, from_role_code, to_role_code, change_order",
      ),
      fetchAll<Record<string, unknown>>("players", "id, name"),
      fetchCodes("roles"),
      fetchCodes("game_modes"),
      fetchCodes("difficulties"),
      fetchCodes("game_results"),
      fetchCodes("disease_states"),
      fetchCodes("virulent_strain_colors"),
      loadAccountLabels(),
    ]);

  const games: StatsGame[] = gameRows.flatMap((row) => {
    const id = asString(row.id);
    if (!id || asString(row.voided_at)) return [];
    return [
      {
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
      },
    ];
  });
  const validGameIds = new Set(games.map((game) => game.id));

  const seats: StatsSeat[] = seatRows.flatMap((row) => {
    const gameId = asString(row.game_id);
    if (!gameId || !validGameIds.has(gameId)) return [];
    const order = typeof row.player_order === "number" ? row.player_order : Number(row.player_order);
    return [
      {
        game_id: gameId,
        player_id: asString(row.player_id),
        role_code: asString(row.role_code),
        player_order: Number.isFinite(order) ? order : 0,
      },
    ];
  });

  const roleChanges: StatsRoleChange[] = changeRows.flatMap((row) => {
    const gameId = asString(row.game_id);
    if (!gameId || !validGameIds.has(gameId)) return [];
    const order = typeof row.change_order === "number" ? row.change_order : Number(row.change_order);
    return [
      {
        game_id: gameId,
        player_id: asString(row.player_id),
        from_role_code: asString(row.from_role_code),
        to_role_code: asString(row.to_role_code),
        change_order: Number.isFinite(order) ? order : 0,
      },
    ];
  });

  const players: CodeName[] = playerRows.flatMap((row) => {
    const code = asString(row.id);
    const name = asString(row.name);
    if (!code || !name) return [];
    return [{ code, name_cs: name }];
  });

  const source: StatsSource = {
    games,
    seats,
    roleChanges,
    players,
    roles,
    modes,
    difficulties,
    results,
    diseaseStates,
    strainColors,
    accounts: [...accounts.entries()].map(([code, name_cs]) => ({ code, name_cs })),
  };

  return buildPandemicStatsBundle(source);
}

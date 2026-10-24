import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DraftData } from "@/lib/pandemic/drafts";

export const SCAN_GAME_SOURCE = "PDF_scan_confirmed";
export const LIVE_GAME_SOURCE = "live";

async function rollbackGame(gameId: string) {
  await supabaseAdmin.from("pandemic_game_role_changes").delete().eq("game_id", gameId);
  await supabaseAdmin.from("pandemic_game_players").delete().eq("game_id", gameId);
  await supabaseAdmin.from("pandemic_games").delete().eq("id", gameId);
}

export async function savePandemicGame(
  draft: DraftData,
  options: { source: string; createdBy: string },
): Promise<{ id: string } | { error: string }> {
  const { data: game, error: gameError } = await supabaseAdmin
    .from("pandemic_games")
    .insert({
      played_at: draft.played_at,
      result_code: draft.result_code,
      difficulty_code: draft.difficulty_code,
      game_mode_code: draft.game_mode_code,
      yellow_disease: draft.yellow_disease,
      red_disease: draft.red_disease,
      blue_disease: draft.blue_disease,
      black_disease: draft.black_disease,
      purple_disease: draft.purple_disease,
      virulent_strain_color: draft.virulent_strain_color,
      note: draft.note ?? null,
      source: options.source,
      created_by: options.createdBy,
    })
    .select("id")
    .single();

  if (gameError || !game?.id) {
    return {
      error: `Hru se nepodařilo uložit. ${gameError?.message ?? "Neznámá chyba."}`,
    };
  }

  const gameId = String(game.id);

  const { error: playersError } = await supabaseAdmin.from("pandemic_game_players").insert(
    draft.players.map((player) => ({
      game_id: gameId,
      player_id: player.matched_player_id,
      role_code: player.role_code,
      player_order: player.player_order,
    })),
  );

  if (playersError) {
    await rollbackGame(gameId);
    return { error: `Hráče se nepodařilo uložit. ${playersError.message}` };
  }

  if (draft.role_changes.length > 0) {
    const { error: changesError } = await supabaseAdmin.from("pandemic_game_role_changes").insert(
      draft.role_changes.map((change) => ({
        game_id: gameId,
        player_id: change.matched_player_id,
        from_role_code: change.from_role_code,
        to_role_code: change.to_role_code,
        change_order: change.change_order,
      })),
    );

    if (changesError) {
      await rollbackGame(gameId);
      return { error: `Změny rolí se nepodařilo uložit. ${changesError.message}` };
    }
  }

  return { id: gameId };
}

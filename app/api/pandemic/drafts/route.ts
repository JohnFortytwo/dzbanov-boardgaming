// app/api/pandemic/drafts/route.ts
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDraftData,
  prepareDraft,
  type CodeLabel,
  type DraftGame,
  type PandemicCatalogs,
  type PlayerOption,
} from "@/lib/pandemic/drafts";

// Admin klient pro obcházení RLS na staging i jádrových tabulkách
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CODE_TABLES = [
  ["roles", "roles"],
  ["difficulties", "difficulties"],
  ["game_results", "gameResults"],
  ["disease_states", "diseaseStates"],
  ["game_modes", "gameModes"],
  ["virulent_strain_colors", "virulentStrainColors"],
] as const;

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return {
      supabase,
      response: Response.json({ error: "Nejste přihlášeni." }, { status: 401 }),
    };
  }

  return { supabase, response: null };
}

async function loadCodes(
  supabase: typeof supabaseAdmin,
  table: (typeof CODE_TABLES)[number][0],
): Promise<CodeLabel[]> {
  const { data, error } = await supabase
    .from(table)
    .select("code, name_cs")
    .order("name_cs", { ascending: true });

  if (error || !data) return [];

  return data.flatMap((row) => {
    const code = typeof row.code === "string" ? row.code.trim() : "";
    if (!code) return [];
    const name =
      typeof row.name_cs === "string" && row.name_cs.trim()
        ? row.name_cs.trim()
        : code;
    return [{ code, name_cs: name }];
  });
}

async function loadCatalogs(
  supabase: typeof supabaseAdmin,
): Promise<PandemicCatalogs> {
  const { data: playerRows } = await supabase
    .from("players")
    .select("id, name")
    .order("name", { ascending: true });

  const players: PlayerOption[] = (playerRows ?? []).flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!id || !name) return [];
    return [{ id, name }];
  });

  const codeLists = await Promise.all(
    CODE_TABLES.map(async ([table, key]) => [key, await loadCodes(supabase, table)] as const),
  );

  const catalogs: PandemicCatalogs = {
    players,
    roles: [],
    difficulties: [],
    gameResults: [],
    diseaseStates: [],
    gameModes: [],
    virulentStrainColors: [],
  };

  for (const [key, values] of codeLists) {
    catalogs[key] = values;
  }

  return catalogs;
}

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const { data, error } = await supabaseAdmin
    .from("a4_draft_games")
    .select("id, scan_id, game_order, is_verified, created_at, draft_data")
    .eq("is_verified", false)
    .order("created_at", { ascending: true })
    .order("game_order", { ascending: true });

  if (error) {
    return Response.json(
      { error: "Neschválené hry se nepodařilo načíst." },
      { status: 500 },
    );
  }

  const drafts: DraftGame[] = (data ?? [])
    .flatMap((row) => {
      if (typeof row.id !== "string" || typeof row.scan_id !== "string") {
        return [];
      }

      return [
        {
          id: row.id,
          scan_id: row.scan_id,
          game_order: typeof row.game_order === "number" ? row.game_order : 0,
          is_verified: Boolean(row.is_verified),
          created_at: typeof row.created_at === "string" ? row.created_at : "",
          draft_data: normalizeDraftData(row.draft_data),
        },
      ];
    })
    .sort((left, right) => {
      const byCreated = left.created_at.localeCompare(right.created_at);
      if (byCreated !== 0) return byCreated;
      return left.game_order - right.game_order;
    });

  const catalogs = await loadCatalogs(supabase as unknown as typeof supabaseAdmin);

  return Response.json({ drafts, catalogs });
}

async function rollbackGame(
  supabase: typeof supabaseAdmin,
  gameId: string,
) {
  await supabase.from("pandemic_game_role_changes").delete().eq("game_id", gameId);
  await supabase.from("pandemic_game_players").delete().eq("game_id", gameId);
  await supabase.from("pandemic_games").delete().eq("id", gameId);
}

export async function POST(request: Request) {
  const { response } = await requireUser();
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
    return Response.json({ error: "Chybí identifikátor draftu." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("a4_draft_games")
    .select("id, is_verified, draft_data")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return Response.json(
      { error: "Draft se nepodařilo načíst." },
      { status: 500 },
    );
  }

  if (!existing) {
    return Response.json({ error: "Draft už neexistuje." }, { status: 404 });
  }

  if (existing.is_verified) {
    return Response.json({ error: "Tato hra už je schválená." }, { status: 409 });
  }

  const stored = normalizeDraftData(existing.draft_data);
  const incoming = normalizeDraftData(payload.draft_data);
  incoming.card_image_url = stored.card_image_url;

  const { draft, errors } = prepareDraft(incoming);
  if (errors.length > 0) {
    return Response.json({ error: errors[0], errors }, { status: 400 });
  }

  // Zápis schválené hry do ostré tabulky pandemic_games
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
      source: "PDF_scan_confirmed",
    })
    .select("id")
    .single();

  if (gameError || !game?.id) {
    return Response.json(
      {
        error: `Hru se nepodařilo uložit. ${gameError?.message ?? "Neznámá chyba."}`,
      },
      { status: 400 },
    );
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
    await rollbackGame(supabaseAdmin, gameId);
    return Response.json(
      { error: `Hráče se nepodařilo uložit. ${playersError.message}` },
      { status: 400 },
    );
  }

  if (draft.role_changes.length > 0) {
    const { error: changesError } = await supabaseAdmin
      .from("pandemic_game_role_changes")
      .insert(
        draft.role_changes.map((change) => ({
          game_id: gameId,
          player_id: change.matched_player_id,
          from_role_code: change.from_role_code,
          to_role_code: change.to_role_code,
          change_order: change.change_order,
        })),
      );

    if (changesError) {
      await rollbackGame(supabaseAdmin, gameId);
      return Response.json(
        { error: `Změny rolí se nepodařilo uložit. ${changesError.message}` },
        { status: 400 },
      );
    }
  }

  const { data: verified, error: verifyError } = await supabaseAdmin
    .from("a4_draft_games")
    .update({
      is_verified: true,
      draft_data: draft,
    })
    .eq("id", id)
    .eq("is_verified", false)
    .select("id");

  if (verifyError || !verified?.length) {
    await rollbackGame(supabaseAdmin, gameId);
    return Response.json(
      {
        error: verifyError
          ? `Draft se nepodařilo označit jako schválený. ${verifyError.message}`
          : "Draft mezitím schválil někdo jiný.",
      },
      { status: verifyError ? 500 : 409 },
    );
  }

  return Response.json({ ok: true, game_id: gameId });
}

const PUBLIC_SCAN_OBJECT = /\/storage\/v1\/object\/public\/scans\/([^?#]+)/i;

function objectPathFromCardUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let raw: string | null = null;
  if (/^https?:\/\//i.test(trimmed)) {
    const match = trimmed.match(PUBLIC_SCAN_OBJECT);
    raw = match?.[1] ?? null;
    if (!raw) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (base) {
      try {
        if (new URL(trimmed).host !== new URL(base).host) return null;
      } catch {
        return null;
      }
    }
  } else {
    const withoutSlash = trimmed.replace(/^\/+/, "");
    raw = withoutSlash.startsWith("scans/")
      ? withoutSlash.slice("scans/".length)
      : withoutSlash;
  }

  let path: string;
  try {
    path = decodeURIComponent(raw).split("?")[0].replace(/^\/+/, "");
  } catch {
    return null;
  }

  if (!path || path.includes("..") || path.includes("\\") || path.endsWith("/")) {
    return null;
  }

  return path;
}

export async function DELETE(request: Request) {
  const { response } = await requireUser();
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
    return Response.json({ error: "Chybí identifikátor draftu." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("a4_draft_games")
    .select("id, scan_id, is_verified, draft_data")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return Response.json(
      { error: "Draft se nepodařilo načíst." },
      { status: 500 },
    );
  }

  if (!existing || typeof existing.scan_id !== "string") {
    return Response.json({ error: "Draft už neexistuje." }, { status: 404 });
  }

  if (existing.is_verified) {
    return Response.json(
      { error: "Schválenou hru už nelze z přepisu smazat." },
      { status: 409 },
    );
  }

  const cardImageUrl = normalizeDraftData(existing.draft_data).card_image_url;
  const scanId = existing.scan_id;

  const { data: removed, error: deleteError } = await supabaseAdmin
    .from("a4_draft_games")
    .delete()
    .eq("id", id)
    .eq("is_verified", false)
    .select("id");

  if (deleteError || !removed?.length) {
    return Response.json(
      {
        error: deleteError
          ? `Draft se nepodařilo smazat. ${deleteError.message}`
          : "Draft mezitím schválil někdo jiný.",
      },
      { status: deleteError ? 500 : 409 },
    );
  }

  let imageWarning: string | null = null;
  const objectPath = objectPathFromCardUrl(cardImageUrl);
  if (objectPath) {
    const { error: storageError } = await supabaseAdmin.storage
      .from("scans")
      .remove([objectPath]);
    if (storageError) {
      imageWarning = storageError.message;
    }
  }

  const { count, error: countError } = await supabaseAdmin
    .from("a4_draft_games")
    .select("id", { count: "exact", head: true })
    .eq("scan_id", scanId);

  if (!countError && count === 0) {
    await supabaseAdmin.from("a4_scans").delete().eq("id", scanId);
  }

  return Response.json({
    ok: true,
    image_deleted: Boolean(objectPath) && !imageWarning,
    image_warning: imageWarning,
  });
}
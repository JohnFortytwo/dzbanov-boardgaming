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
  const { response } = await requireUser();
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

  const catalogs = await loadCatalogs(supabaseAdmin);

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
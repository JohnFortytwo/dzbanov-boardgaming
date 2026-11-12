import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sortDiseaseStates } from "@/lib/pandemic/disease-states";
import { isHiddenRoleCode, type CodeLabel, type PandemicCatalogs, type PlayerOption } from "@/lib/pandemic/drafts";

const CODE_TABLES = [
  ["roles", "roles"],
  ["difficulties", "difficulties"],
  ["game_results", "gameResults"],
  ["disease_states", "diseaseStates"],
  ["game_modes", "gameModes"],
  ["virulent_strain_colors", "virulentStrainColors"],
] as const;

function serviceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

async function loadCodes(
  supabase: SupabaseClient,
  table: (typeof CODE_TABLES)[number][0],
): Promise<CodeLabel[]> {
  const { data, error } = await supabase
    .from(table)
    .select("code, name_cs")
    .order("name_cs", { ascending: true });

  if (error) {
    throw new Error(`Číselník ${table} se nepodařilo načíst. ${error.message}`);
  }
  if (!data) return [];

  return data.flatMap((row) => {
    const code = typeof row.code === "string" ? row.code.trim() : "";
    if (!code) return [];
    const name =
      typeof row.name_cs === "string" && row.name_cs.trim() ? row.name_cs.trim() : code;
    return [{ code, name_cs: name }];
  });
}

async function loadPlayers(supabase: SupabaseClient): Promise<PlayerOption[]> {
  const flagged = await supabase
    .from("players")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  let rows: Array<{ id?: unknown; name?: unknown; is_active?: unknown }> | null = flagged.data;
  if (flagged.error) {
    const plain = await supabase.from("players").select("id, name").order("name", { ascending: true });
    if (plain.error) {
      throw new Error(`Seznam hráčů se nepodařilo načíst. ${plain.error.message}`);
    }
    rows = plain.data;
  }

  return (rows ?? []).flatMap((row) => {
    if (row.is_active === false) return [];
    const id = typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!id || !name) return [];
    return [{ id, name }];
  });
}

async function readCatalogs(supabase: SupabaseClient): Promise<PandemicCatalogs> {
  const players = await loadPlayers(supabase);

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
  catalogs.diseaseStates = sortDiseaseStates(catalogs.diseaseStates);
  catalogs.roles = catalogs.roles.filter((role) => !isHiddenRoleCode(role.code));

  return catalogs;
}

function codesMissing(catalogs: PandemicCatalogs) {
  return (
    catalogs.difficulties.length === 0 ||
    catalogs.gameResults.length === 0 ||
    catalogs.diseaseStates.length === 0 ||
    catalogs.gameModes.length === 0 ||
    catalogs.virulentStrainColors.length === 0
  );
}

export async function loadPandemicCatalogs(): Promise<PandemicCatalogs> {
  const catalogs = await readCatalogs(await createClient());
  if (!codesMissing(catalogs)) return catalogs;

  const admin = serviceRoleClient();
  if (!admin) return catalogs;
  return readCatalogs(admin);
}

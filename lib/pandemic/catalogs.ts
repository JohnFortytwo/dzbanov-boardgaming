import { createClient } from "@supabase/supabase-js";
import type { CodeLabel, PandemicCatalogs, PlayerOption } from "@/lib/pandemic/drafts";

const CODE_TABLES = [
  ["roles", "roles"],
  ["difficulties", "difficulties"],
  ["game_results", "gameResults"],
  ["disease_states", "diseaseStates"],
  ["game_modes", "gameModes"],
  ["virulent_strain_colors", "virulentStrainColors"],
] as const;

function catalogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Chybí přístup k číselníkům.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

async function loadCodes(
  supabase: ReturnType<typeof catalogClient>,
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

export async function loadPandemicCatalogs(): Promise<PandemicCatalogs> {
  const supabase = catalogClient();
  const { data: playerRows, error: playerError } = await supabase
    .from("players")
    .select("id, name")
    .order("name", { ascending: true });

  if (playerError) {
    throw new Error(`Seznam hráčů se nepodařilo načíst. ${playerError.message}`);
  }

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

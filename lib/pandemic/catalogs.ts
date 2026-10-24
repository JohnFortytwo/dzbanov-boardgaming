import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CodeLabel, PandemicCatalogs, PlayerOption } from "@/lib/pandemic/drafts";

const CODE_TABLES = [
  ["roles", "roles"],
  ["difficulties", "difficulties"],
  ["game_results", "gameResults"],
  ["disease_states", "diseaseStates"],
  ["game_modes", "gameModes"],
  ["virulent_strain_colors", "virulentStrainColors"],
] as const;

async function loadCodes(table: (typeof CODE_TABLES)[number][0]): Promise<CodeLabel[]> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("code, name_cs")
    .order("name_cs", { ascending: true });

  if (error || !data) return [];

  return data.flatMap((row) => {
    const code = typeof row.code === "string" ? row.code.trim() : "";
    if (!code) return [];
    const name =
      typeof row.name_cs === "string" && row.name_cs.trim() ? row.name_cs.trim() : code;
    return [{ code, name_cs: name }];
  });
}

export async function loadPandemicCatalogs(): Promise<PandemicCatalogs> {
  const { data: playerRows } = await supabaseAdmin
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
    CODE_TABLES.map(async ([table, key]) => [key, await loadCodes(table)] as const),
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

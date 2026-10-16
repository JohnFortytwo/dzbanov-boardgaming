export type DraftPlayer = {
  raw_name: string | null;
  matched_player_id: string | null;
  role_code: string | null;
  player_order: number;
};

export type DraftRoleChange = {
  matched_player_id: string | null;
  from_role_code: string | null;
  to_role_code: string | null;
  change_order: number;
};

export type DraftData = {
  card_image_url: string | null;
  played_at: string | null;
  result_code: string | null;
  difficulty_code: string | null;
  game_mode_code: string | null;
  yellow_disease: string | null;
  red_disease: string | null;
  blue_disease: string | null;
  black_disease: string | null;
  purple_disease: string | null;
  virulent_strain_color: string | null;
  note: string | null;
  players: DraftPlayer[];
  role_changes: DraftRoleChange[];
};

export type DraftGame = {
  id: string;
  scan_id: string;
  game_order: number;
  is_verified: boolean;
  created_at: string;
  draft_data: DraftData;
};

export type CodeLabel = {
  code: string;
  name_cs: string;
};

export type PlayerOption = {
  id: string;
  name: string;
};

export type PandemicCatalogs = {
  players: PlayerOption[];
  roles: CodeLabel[];
  difficulties: CodeLabel[];
  gameResults: CodeLabel[];
  diseaseStates: CodeLabel[];
  gameModes: CodeLabel[];
  virulentStrainColors: CodeLabel[];
};

export type DraftsResponse = {
  drafts: DraftGame[];
  catalogs: PandemicCatalogs;
};

const DISEASE_LABELS: Record<string, string> = {
  yellow_disease: "žluté nemoci",
  red_disease: "červené nemoci",
  blue_disease: "modré nemoci",
  black_disease: "černé nemoci",
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function foldCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const ROLE_ALIAS_TO_CODE: Record<string, string> = {
  dis: "disp",
  med: "med",
  ved: "věd",
  vyz: "výzk",
  plan: "plán",
  oper: "oper",
  pilot: "pilot",
  arch: "arch",
  epid: "epid",
  q: "q",
  lok: "lokál",
  rej: "rejža",
  ter: "terka",
  vse: "všest",
  vsest: "všest",
};

const RESULT_ALIASES: Record<string, string[]> = {
  victory: ["vyhra"],
  defeat: ["prohra"],
  loss: ["prohra"],
};

const DIFFICULTY_ALIASES: Record<string, string[]> = {
  standard: ["legendarni"],
  legendary: ["legendarni"],
  heroic: ["hrdinska"],
};

const MODE_ALIASES: Record<string, string[]> = {
  base: ["klasika"],
  virulent: ["zhoubny kmen"],
  mutation: ["mutace"],
};

const PURPLE_MODES = new Set([
  "mut",
  "mutace",
  "mutation",
  "combo",
  "wwm",
  "worldwide",
  "worldwide m",
  "worldwide m.",
]);

const VIRULENT_MODES = new Set(["virulent", "vir", "zhoubny kmen", "combo"]);

export function modeAllowsPurple(mode: string | null) {
  if (!mode) return false;
  const folded = foldCode(mode);
  return PURPLE_MODES.has(folded) || folded.startsWith("worldwide");
}

export function modeAllowsVirulentStrain(mode: string | null) {
  if (!mode) return false;
  return VIRULENT_MODES.has(foldCode(mode));
}

const DISEASE_ALIASES: Record<string, string[]> = {
  cured: ["vynalezeno", "vyleceno"],
  eradicated: ["vymyceno"],
  none: ["nic"],
};

const COLOR_ALIASES: Record<string, string[]> = {
  yellow: ["zluta"],
  red: ["cervena"],
  blue: ["modra"],
  black: ["cerna"],
  purple: ["fialova"],
};

export function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && isIsoDate(value)) return value;

  const match = value.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/);
  if (!match) return value;

  const iso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : value;
}

export function matchCatalogCode(
  raw: string | null,
  options: CodeLabel[],
  aliases: Record<string, string[]> = {},
): string | null {
  if (!raw) return null;
  const foldedRaw = foldCode(raw);
  const direct = options.find(
    (option) => foldCode(option.code) === foldedRaw || foldCode(option.name_cs) === foldedRaw,
  );
  if (direct) return direct.code;

  for (const candidate of aliases[foldedRaw] ?? []) {
    const foldedCandidate = foldCode(candidate);
    const hit = options.find(
      (option) =>
        foldCode(option.code) === foldedCandidate ||
        foldCode(option.name_cs) === foldedCandidate,
    );
    if (hit) return hit.code;
  }

  return raw.trim();
}

export function roleCodeFromName(name: string) {
  const trimmed = name.trim();
  return ROLE_ALIAS_TO_CODE[foldCode(trimmed)] ?? trimmed.toLocaleLowerCase("cs");
}

function uniqueRole(roles: CodeLabel[]): CodeLabel | null {
  const unique = [...new Map(roles.map((role) => [role.code, role])).values()];
  return unique.length === 1 ? unique[0] : null;
}

function roleByFoldedCode(roles: CodeLabel[], folded: string): CodeLabel | null {
  return (
    roles.find(
      (role) => foldCode(role.code) === folded || foldCode(role.name_cs) === folded,
    ) ?? null
  );
}

export function matchRoleCode(raw: string | null, roles: CodeLabel[]): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const folded = foldCode(trimmed);

  const alias = ROLE_ALIAS_TO_CODE[folded];
  if (alias) {
    const aliased = roleByFoldedCode(roles, foldCode(alias));
    if (aliased) return aliased.code;
  }

  const exact = roleByFoldedCode(roles, folded);
  if (exact) return exact.code;

  if (folded.length >= 3 && roles.length > 0) {
    const byCode = uniqueRole(
      roles.filter((role) => {
        const code = foldCode(role.code);
        return code.startsWith(folded) || (code.length >= 3 && folded.startsWith(code));
      }),
    );
    if (byCode) return byCode.code;

    const byName = uniqueRole(
      roles.filter((role) => foldCode(role.name_cs).startsWith(folded)),
    );
    if (byName) return byName.code;
  }

  return alias ?? trimmed;
}

function splitRoleChain(raw: string): string[] | null {
  if (!raw.includes("/")) return null;
  const parts = raw
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(0, 3);
}

function presentPlayerRole(raw: string | null, roles: CodeLabel[]): string | null {
  if (!raw) return null;
  const chain = splitRoleChain(raw);
  return matchRoleCode(chain ? chain[0] : raw, roles);
}

function inferRoleChanges(players: DraftPlayer[], roles: CodeLabel[]): DraftRoleChange[] {
  const changes: DraftRoleChange[] = [];

  for (const player of players) {
    if (!player.role_code || changes.length >= 2) continue;
    const chain = splitRoleChain(player.role_code);
    if (!chain) continue;

    const codes = chain.map((part) => matchRoleCode(part, roles));
    for (let step = 1; step < codes.length && changes.length < 2; step += 1) {
      const fromRole = codes[step - 1];
      const toRole = codes[step];
      if (!fromRole || !toRole || fromRole === toRole) continue;
      changes.push({
        matched_player_id: player.matched_player_id,
        from_role_code: fromRole,
        to_role_code: toRole,
        change_order: changes.length + 1,
      });
    }
  }

  return changes;
}

function foldPlayerName(value: string) {
  return foldCode(value).replace(/\s+/g, "");
}

function matchPlayerId(rawName: string | null, players: PlayerOption[]): string | null {
  if (!rawName) return null;
  const folded = foldPlayerName(rawName);
  if (!folded) return null;
  return players.find((player) => foldPlayerName(player.name) === folded)?.id ?? null;
}

export function emptyPlayer(order: number): DraftPlayer {
  return {
    raw_name: null,
    matched_player_id: null,
    role_code: null,
    player_order: order,
  };
}

function presentDisease(raw: string | null, states: CodeLabel[]) {
  if (!raw || foldCode(raw) === "cured") return null;
  return matchCatalogCode(raw, states, DISEASE_ALIASES);
}

export function presentDraft(data: DraftData, catalogs: PandemicCatalogs): DraftData {
  const sourcePlayers =
    data.players.length > 0
      ? data.players
      : [emptyPlayer(1), emptyPlayer(2), emptyPlayer(3)];

  return {
    ...data,
    played_at: toIsoDate(data.played_at),
    result_code: matchCatalogCode(data.result_code, catalogs.gameResults, RESULT_ALIASES),
    difficulty_code: matchCatalogCode(
      data.difficulty_code,
      catalogs.difficulties,
      DIFFICULTY_ALIASES,
    ),
    game_mode_code: matchCatalogCode(data.game_mode_code, catalogs.gameModes, MODE_ALIASES),
    yellow_disease: presentDisease(data.yellow_disease, catalogs.diseaseStates),
    red_disease: presentDisease(data.red_disease, catalogs.diseaseStates),
    blue_disease: presentDisease(data.blue_disease, catalogs.diseaseStates),
    black_disease: presentDisease(data.black_disease, catalogs.diseaseStates),
    purple_disease: presentDisease(data.purple_disease, catalogs.diseaseStates),
    virulent_strain_color: matchCatalogCode(
      data.virulent_strain_color,
      catalogs.virulentStrainColors,
      COLOR_ALIASES,
    ),
    players: sourcePlayers.map((player, index) => ({
      ...player,
      player_order: index + 1,
      matched_player_id:
        player.matched_player_id ?? matchPlayerId(player.raw_name, catalogs.players),
      role_code: presentPlayerRole(player.role_code, catalogs.roles),
    })),
    role_changes: (
      data.role_changes.length > 0
        ? data.role_changes
        : inferRoleChanges(
            sourcePlayers.map((player) => ({
              ...player,
              matched_player_id:
                player.matched_player_id ?? matchPlayerId(player.raw_name, catalogs.players),
            })),
            catalogs.roles,
          )
    ).map((change, index) => ({
      ...change,
      change_order: index + 1,
      from_role_code: matchRoleCode(change.from_role_code, catalogs.roles),
      to_role_code: matchRoleCode(change.to_role_code, catalogs.roles),
    })),
  };
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function readPlayer(value: unknown, index: number): DraftPlayer {
  const row = asRecord(value);
  return {
    raw_name: asString(row.raw_name),
    matched_player_id:
      asString(row.matched_player_id) ?? asString(row.player_id),
    role_code: asString(row.role_code),
    player_order: asNumber(row.player_order, index + 1),
  };
}

function readRoleChange(value: unknown, index: number): DraftRoleChange {
  const row = asRecord(value);
  return {
    matched_player_id:
      asString(row.matched_player_id) ?? asString(row.player_id),
    from_role_code: asString(row.from_role_code) ?? asString(row.from_role),
    to_role_code: asString(row.to_role_code) ?? asString(row.to_role),
    change_order: asNumber(row.change_order, index + 1),
  };
}

export function emptyDraftData(): DraftData {
  return {
    card_image_url: null,
    played_at: null,
    result_code: null,
    difficulty_code: null,
    game_mode_code: null,
    yellow_disease: null,
    red_disease: null,
    blue_disease: null,
    black_disease: null,
    purple_disease: null,
    virulent_strain_color: null,
    note: null,
    players: [],
    role_changes: [],
  };
}

export function normalizeDraftData(value: unknown): DraftData {
  const row = asRecord(value);
  const players = Array.isArray(row.players) ? row.players : [];
  const roleChanges = Array.isArray(row.role_changes) ? row.role_changes : [];

  return {
    card_image_url: asString(row.card_image_url),
    played_at: toIsoDate(asString(row.played_at)),
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
    players: players.map(readPlayer),
    role_changes: roleChanges.map(readRoleChange),
  };
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function prepareDraft(value: DraftData): {
  draft: DraftData;
  errors: string[];
} {
  const draft: DraftData = {
    ...value,
    note: value.note?.trim() || null,
    players: value.players
      .filter(
        (player) =>
          player.matched_player_id || player.role_code || player.raw_name,
      )
      .map((player, index) => ({ ...player, player_order: index + 1 })),
    role_changes: value.role_changes
      .filter(
        (change) =>
          change.matched_player_id ||
          change.from_role_code ||
          change.to_role_code,
      )
      .map((change, index) => ({ ...change, change_order: index + 1 })),
  };

  const errors: string[] = [];

  if (!draft.played_at || !isIsoDate(draft.played_at)) {
    errors.push("Vyplňte platné datum hry.");
  }

  if (!draft.result_code) errors.push("Vyberte výsledek.");
  if (!draft.difficulty_code) errors.push("Vyberte obtížnost.");
  if (!draft.game_mode_code) errors.push("Vyberte režim hry.");

  for (const [key, label] of Object.entries(DISEASE_LABELS)) {
    if (!draft[key as keyof DraftData]) {
      errors.push(`Vyberte stav ${label}.`);
    }
  }

  if (modeAllowsPurple(draft.game_mode_code)) {
    if (!draft.purple_disease) errors.push("Vyberte stav fialové nemoci.");
  } else {
    draft.purple_disease = null;
  }

  if (modeAllowsVirulentStrain(draft.game_mode_code)) {
    if (!draft.virulent_strain_color) errors.push("Vyberte barvu kmene.");
  } else {
    draft.virulent_strain_color = null;
  }

  if (draft.players.length === 0) {
    errors.push("Přidejte alespoň jednoho hráče a jeho roli.");
  }

  if (draft.players.length > 5) {
    errors.push("Partie může mít nejvýše pět hráčů.");
  }

  const seenPlayers = new Set<string>();
  draft.players.forEach((player, index) => {
    const label = player.raw_name
      ? `hráče ${index + 1} (${player.raw_name})`
      : `hráče ${index + 1}`;

    if (!player.matched_player_id || !isUuid(player.matched_player_id)) {
      errors.push(`Vyberte ${label} ze seznamu hráčů.`);
    } else if (seenPlayers.has(player.matched_player_id)) {
      errors.push("Stejný hráč je v partii vícekrát.");
    } else {
      seenPlayers.add(player.matched_player_id);
    }

    if (!player.role_code) {
      errors.push(`Vyberte roli u ${label}.`);
    }
  });

  if (draft.role_changes.length > 2) {
    errors.push("Partie může mít nejvýše dvě změny rolí.");
  }

  draft.role_changes.forEach((change, index) => {
    const label = `změny role ${index + 1}`;
    if (!change.matched_player_id || !isUuid(change.matched_player_id)) {
      errors.push(`Vyberte hráče u ${label}.`);
    } else if (!seenPlayers.has(change.matched_player_id)) {
      errors.push(`Hráč u ${label} musí hrát v této partii.`);
    }
    if (!change.from_role_code || !change.to_role_code) {
      errors.push(`Vyplňte výchozí i novou roli u ${label}.`);
    }
  });

  return { draft, errors };
}

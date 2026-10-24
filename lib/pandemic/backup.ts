import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAccountLabels } from "@/lib/pandemic/accounts";
import { foldCode } from "@/lib/pandemic/drafts";

type CodeName = {
  code: string;
  name_cs: string;
};

type BackupPlayer = {
  id: string;
  name: string;
};

type BackupGameRow = {
  id: string;
  played_at: string | null;
  created_at: string | null;
  source: string | null;
  note: string | null;
  result_code: string | null;
  difficulty_code: string | null;
  game_mode_code: string | null;
  yellow_disease: string | null;
  red_disease: string | null;
  blue_disease: string | null;
  black_disease: string | null;
  purple_disease: string | null;
  virulent_strain_color: string | null;
  created_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
};

type BackupSeat = {
  game_id: string;
  player_id: string | null;
  role_code: string | null;
  player_order: number;
};

type BackupChange = {
  game_id: string;
  player_id: string | null;
  from_role_code: string | null;
  to_role_code: string | null;
  change_order: number;
};

export type BackupSource = {
  games: BackupGameRow[];
  seats: BackupSeat[];
  roleChanges: BackupChange[];
  players: BackupPlayer[];
  roles: CodeName[];
  results: CodeName[];
  difficulties: CodeName[];
  modes: CodeName[];
  diseaseStates: CodeName[];
  strainColors: CodeName[];
  accounts: { id: string; label: string }[];
};

const PLAYER_COLUMNS = 5;
const CHANGE_COLUMNS = 2;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asOrder(value: unknown): number {
  const order = typeof value === "number" ? value : Number(value);
  return Number.isFinite(order) ? order : 0;
}

async function fetchPage(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  order: string[],
  from: number,
): Promise<Record<string, unknown>[]> {
  let query = supabase.from(table).select(columns).order(order[0]);
  for (const column of order.slice(1)) query = query.order(column);
  const { data, error } = await query.range(from, from + 999);
  if (error) {
    throw new Error(`Zálohu se nepodařilo načíst. ${error.message}`);
  }
  return (data ?? []) as unknown as Record<string, unknown>[];
}

async function fetchAll(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  order: string[],
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await fetchPage(supabase, table, columns, order, from);
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function fetchCodes(supabase: SupabaseClient, table: string): Promise<CodeName[]> {
  const { data, error } = await supabase.from(table).select("code, name_cs").order("code");
  if (error) {
    throw new Error(`Zálohu se nepodařilo načíst. ${error.message}`);
  }
  return (data ?? []).flatMap((row) => {
    const code = asString(row.code);
    if (!code) return [];
    const name = asString(row.name_cs) ?? code;
    return [{ code, name_cs: name }];
  });
}

export async function loadPandemicBackup(): Promise<BackupSource> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const [gameRows, seatRows, changeRows, playerRows, roles, results, difficulties, modes, diseaseStates, strainColors, accounts] =
    await Promise.all([
      fetchAll(
        supabaseAdmin,
        "pandemic_games",
        "id, played_at, created_at, source, note, result_code, difficulty_code, game_mode_code, yellow_disease, red_disease, blue_disease, black_disease, purple_disease, virulent_strain_color, created_by, voided_at, voided_by",
        ["id"],
      ),
      fetchAll(
        supabaseAdmin,
        "pandemic_game_players",
        "game_id, player_id, role_code, player_order",
        ["game_id", "player_order"],
      ),
      fetchAll(
        supabaseAdmin,
        "pandemic_game_role_changes",
        "game_id, player_id, from_role_code, to_role_code, change_order",
        ["game_id", "change_order"],
      ),
      fetchAll(supabaseAdmin, "players", "id, name", ["id"]),
      fetchCodes(supabaseAdmin, "roles"),
      fetchCodes(supabaseAdmin, "game_results"),
      fetchCodes(supabaseAdmin, "difficulties"),
      fetchCodes(supabaseAdmin, "game_modes"),
      fetchCodes(supabaseAdmin, "disease_states"),
      fetchCodes(supabaseAdmin, "virulent_strain_colors"),
      loadAccountLabels(),
    ]);

  return {
    games: gameRows.flatMap((row) => {
      const id = asString(row.id);
      if (!id) return [];
      return [
        {
          id,
          played_at: asString(row.played_at),
          created_at: asString(row.created_at),
          source: asString(row.source),
          note: asString(row.note),
          result_code: asString(row.result_code),
          difficulty_code: asString(row.difficulty_code),
          game_mode_code: asString(row.game_mode_code),
          yellow_disease: asString(row.yellow_disease),
          red_disease: asString(row.red_disease),
          blue_disease: asString(row.blue_disease),
          black_disease: asString(row.black_disease),
          purple_disease: asString(row.purple_disease),
          virulent_strain_color: asString(row.virulent_strain_color),
          created_by: asString(row.created_by),
          voided_at: asString(row.voided_at),
          voided_by: asString(row.voided_by),
        },
      ];
    }),
    seats: seatRows.flatMap((row) => {
      const gameId = asString(row.game_id);
      const playerId = asString(row.player_id);
      const roleCode = asString(row.role_code);
      if (!gameId || (!playerId && !roleCode)) return [];
      return [
        {
          game_id: gameId,
          player_id: playerId,
          role_code: roleCode,
          player_order: asOrder(row.player_order),
        },
      ];
    }),
    roleChanges: changeRows.flatMap((row) => {
      const gameId = asString(row.game_id);
      const playerId = asString(row.player_id);
      const fromRole = asString(row.from_role_code);
      const toRole = asString(row.to_role_code);
      if (!gameId || (!playerId && !fromRole && !toRole)) return [];
      return [
        {
          game_id: gameId,
          player_id: playerId,
          from_role_code: fromRole,
          to_role_code: toRole,
          change_order: asOrder(row.change_order),
        },
      ];
    }),
    players: playerRows.flatMap((row) => {
      const id = asString(row.id);
      const name = asString(row.name);
      if (!id || !name) return [];
      return [{ id, name }];
    }),
    roles,
    results,
    difficulties,
    modes,
    diseaseStates,
    strainColors,
    accounts: [...accounts.entries()].map(([id, label]) => ({ id, label })),
  };
}

function labelLookup(rows: CodeName[]) {
  const labels = new Map<string, string>();
  for (const row of rows) {
    labels.set(row.code, row.name_cs || row.code);
    labels.set(foldCode(row.code), row.name_cs || row.code);
  }
  return (code: string | null) => {
    if (!code) return "";
    return labels.get(code) ?? labels.get(foldCode(code)) ?? code;
  };
}

function compareText(left: string | null, right: string | null) {
  if (left && right && left !== right) return left < right ? -1 : 1;
  if (left && !right) return -1;
  if (!left && right) return 1;
  return 0;
}

function csvField(value: string) {
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[;"\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function formatPlayedAt(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

function formatSavedAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function backupDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function backupFilename(now = new Date()) {
  return `pandemic-zaloha-${backupDay(now)}.zip`;
}

export function renderPandemicBackup(source: BackupSource, now = new Date()) {
  const resultLabel = labelLookup(source.results);
  const difficultyLabel = labelLookup(source.difficulties);
  const modeLabel = labelLookup(source.modes);
  const roleLabel = labelLookup(source.roles);
  const diseaseLabel = labelLookup(source.diseaseStates);
  const strainLabel = labelLookup(source.strainColors);
  const accountLabel = new Map(source.accounts.map((account) => [account.id, account.label]));
  const playerNames = new Map(source.players.map((player) => [player.id, player.name]));

  const seatsByGame = new Map<string, BackupSeat[]>();
  for (const seat of source.seats) {
    const list = seatsByGame.get(seat.game_id) ?? [];
    list.push(seat);
    seatsByGame.set(seat.game_id, list);
  }
  const changesByGame = new Map<string, BackupChange[]>();
  for (const change of source.roleChanges) {
    const list = changesByGame.get(change.game_id) ?? [];
    list.push(change);
    changesByGame.set(change.game_id, list);
  }

  const games = [...source.games].sort((left, right) => {
    const byDate = compareText(left.played_at, right.played_at);
    if (byDate !== 0) return byDate;
    return left.id.localeCompare(right.id);
  });

  const nameOf = (playerId: string | null) => {
    if (!playerId) return "";
    return playerNames.get(playerId) ?? playerId;
  };

  const rendered = games.map((game) => {
    const players = (seatsByGame.get(game.id) ?? [])
      .sort((left, right) => left.player_order - right.player_order || left.player_id?.localeCompare(right.player_id ?? "") || 0)
      .map((seat) => ({
        player_order: seat.player_order,
        player_id: seat.player_id,
        name: nameOf(seat.player_id) || null,
        role_code: seat.role_code,
        role: seat.role_code ? roleLabel(seat.role_code) : null,
      }));
    const roleChanges = (changesByGame.get(game.id) ?? [])
      .sort((left, right) => left.change_order - right.change_order)
      .map((change) => ({
        change_order: change.change_order,
        player_id: change.player_id,
        name: nameOf(change.player_id) || null,
        from_role_code: change.from_role_code,
        from_role: change.from_role_code ? roleLabel(change.from_role_code) : null,
        to_role_code: change.to_role_code,
        to_role: change.to_role_code ? roleLabel(change.to_role_code) : null,
      }));
    return { game, players, roleChanges };
  });

  const playerColumns = Math.max(PLAYER_COLUMNS, ...rendered.map((row) => row.players.length));
  const changeColumns = Math.max(CHANGE_COLUMNS, ...rendered.map((row) => row.roleChanges.length));

  const headers = [
    "Datum",
    "Výsledek",
    "Obtížnost",
    "Režim",
    "Hráčů",
    ...Array.from({ length: playerColumns }, (_, index) => [`Hráč ${index + 1}`, `Role ${index + 1}`]).flat(),
    ...Array.from({ length: changeColumns }, (_, index) => [
      `Změna ${index + 1} hráč`,
      `Změna ${index + 1} z role`,
      `Změna ${index + 1} na roli`,
    ]).flat(),
    "Žlutá",
    "Červená",
    "Modrá",
    "Černá",
    "Fialová",
    "Barva kmene",
    "Poznámka",
    "Id",
    "Uloženo",
    "Zapsal",
    "Platnost",
    "Zneplatnil",
    "Zneplatněno",
  ];

  const lines = rendered.map(({ game, players, roleChanges }) => {
    const cells = [
      formatPlayedAt(game.played_at),
      resultLabel(game.result_code),
      difficultyLabel(game.difficulty_code),
      modeLabel(game.game_mode_code),
      String(players.length),
    ];
    for (let index = 0; index < playerColumns; index += 1) {
      const player = players[index];
      cells.push(player?.name ?? "", player?.role ?? "");
    }
    for (let index = 0; index < changeColumns; index += 1) {
      const change = roleChanges[index];
      cells.push(change?.name ?? "", change?.from_role ?? "", change?.to_role ?? "");
    }
    cells.push(
      diseaseLabel(game.yellow_disease),
      diseaseLabel(game.red_disease),
      diseaseLabel(game.blue_disease),
      diseaseLabel(game.black_disease),
      diseaseLabel(game.purple_disease),
      strainLabel(game.virulent_strain_color),
      game.note ?? "",
      game.id,
      formatSavedAt(game.created_at),
      game.created_by ? (accountLabel.get(game.created_by) ?? "Neznámý účet") : "",
      game.voided_at ? "Neplatná" : "Platná",
      game.voided_by ? (accountLabel.get(game.voided_by) ?? "Neznámý účet") : "",
      formatSavedAt(game.voided_at),
    );
    return cells.map(csvField).join(";");
  });

  const csv = `\uFEFF${[headers.map(csvField).join(";"), ...lines].join("\r\n")}\r\n`;

  const byName = (left: { name_cs: string }, right: { name_cs: string }) =>
    left.name_cs.localeCompare(right.name_cs, "cs");

  const json = `${JSON.stringify(
    {
      exported_at: now.toISOString(),
      games: rendered.map(({ game, players, roleChanges }) => ({
        id: game.id,
        played_at: game.played_at,
        created_at: game.created_at,
        source: game.source,
        note: game.note,
        result_code: game.result_code,
        result: game.result_code ? resultLabel(game.result_code) : null,
        difficulty_code: game.difficulty_code,
        difficulty: game.difficulty_code ? difficultyLabel(game.difficulty_code) : null,
        game_mode_code: game.game_mode_code,
        game_mode: game.game_mode_code ? modeLabel(game.game_mode_code) : null,
        yellow_disease: game.yellow_disease,
        yellow_disease_label: game.yellow_disease ? diseaseLabel(game.yellow_disease) : null,
        red_disease: game.red_disease,
        red_disease_label: game.red_disease ? diseaseLabel(game.red_disease) : null,
        blue_disease: game.blue_disease,
        blue_disease_label: game.blue_disease ? diseaseLabel(game.blue_disease) : null,
        black_disease: game.black_disease,
        black_disease_label: game.black_disease ? diseaseLabel(game.black_disease) : null,
        purple_disease: game.purple_disease,
        purple_disease_label: game.purple_disease ? diseaseLabel(game.purple_disease) : null,
        virulent_strain_color: game.virulent_strain_color,
        virulent_strain_color_label: game.virulent_strain_color
          ? strainLabel(game.virulent_strain_color)
          : null,
        created_by: game.created_by,
        recorded_by: game.created_by ? (accountLabel.get(game.created_by) ?? "Neznámý účet") : null,
        voided_at: game.voided_at,
        voided_by: game.voided_by,
        voided_by_label: game.voided_by ? (accountLabel.get(game.voided_by) ?? "Neznámý účet") : null,
        valid: !game.voided_at,
        players,
        role_changes: roleChanges,
      })),
      catalogs: {
        players: [...source.players].sort((left, right) => left.name.localeCompare(right.name, "cs")),
        roles: [...source.roles].sort(byName),
        game_results: [...source.results].sort(byName),
        difficulties: [...source.difficulties].sort(byName),
        game_modes: [...source.modes].sort(byName),
        disease_states: [...source.diseaseStates].sort(byName),
        virulent_strain_colors: [...source.strainColors].sort(byName),
      },
    },
    null,
    2,
  )}\n`;

  return { filename: backupFilename(now), csv, json };
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp(date: Date) {
  const year = Math.max(1980, date.getUTCFullYear());
  const time =
    (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time, day };
}

export function storeZip(
  files: { name: string; text: string }[],
  modified = new Date(),
): Uint8Array {
  const encoder = new TextEncoder();
  const { time, day } = dosStamp(modified);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, day, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, day, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const archive = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  return archive;
}

export function buildBackupZip(source: BackupSource, now = new Date()) {
  const rendered = renderPandemicBackup(source, now);
  return {
    filename: rendered.filename,
    bytes: storeZip(
      [
        { name: "hry.csv", text: rendered.csv },
        { name: "pandemic.json", text: rendered.json },
      ],
      now,
    ),
  };
}

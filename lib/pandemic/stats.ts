import { foldCode, modeAllowsVirulentStrain } from "@/lib/pandemic/drafts";

export type CodeName = {
  code: string;
  name_cs: string;
};

export type StatsGame = {
  id: string;
  played_at: string | null;
  created_at: string | null;
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
  created_by: string | null;
};

export type StatsSeat = {
  game_id: string;
  player_id: string | null;
  role_code: string | null;
  player_order: number;
};

export type StatsRoleChange = {
  game_id: string;
  player_id: string | null;
  from_role_code: string | null;
  to_role_code: string | null;
  change_order: number;
};

export type StatsSource = {
  games: StatsGame[];
  seats: StatsSeat[];
  roleChanges: StatsRoleChange[];
  players: CodeName[];
  roles: CodeName[];
  modes: CodeName[];
  difficulties: CodeName[];
  results: CodeName[];
  diseaseStates: CodeName[];
  strainColors: CodeName[];
  accounts: CodeName[];
};

export type CountRow = {
  key: string;
  label: string;
  games: number;
  wins: number;
  share: number | null;
  winRate: number | null;
};

export type RoleLens = "any" | "entire" | "from" | "to";

export type RoleRow = CountRow & {
  starts: number;
  arrivals: number;
  departures: number;
  retired: boolean;
};

export type PlayerRow = {
  key: string;
  label: string;
  games: number;
  wins: number;
  winRate: number | null;
  topRole: string | null;
};

export type DiseaseRow = {
  key: string;
  label: string;
  total: number;
  states: { key: string; label: string; count: number; share: number | null }[];
};

export type ChangeRow = {
  key: string;
  from: string;
  to: string;
  count: number;
  games: number;
  wins: number;
  share: number | null;
  winRate: number | null;
};

export type ChangeSideRow = {
  key: string;
  label: string;
  count: number;
  games: number;
  wins: number;
  share: number | null;
  winRate: number | null;
};

export type CrewRow = {
  key: string;
  label: string;
  games: number;
  wins: number;
  winRate: number | null;
};

export type TimelineBucket = "month" | "year";

export type TimelinePoint = {
  key: string;
  label: string;
  games: number;
  wins: number;
  winRate: number | null;
};

export type Highlight = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type StatsGameFilter = {
  mode?: string | null;
  difficulty?: string | null;
  playerCount?: number | null;
};

export type RecentPlayer = {
  name: string;
  role: string;
};

export type RecentChange = {
  name: string;
  from: string;
  to: string;
};

export type RecentDisease = {
  label: string;
  state: string;
};

export type RecentGame = {
  id: string;
  playedAt: string | null;
  savedAt: string | null;
  result: string;
  mode: string;
  difficulty: string;
  players: RecentPlayer[];
  changes: RecentChange[];
  diseases: RecentDisease[];
  strain: string | null;
  note: string | null;
  recordedBy: string | null;
};

export const RECENT_GAME_OPTIONS = [5, 10, 20] as const;
export type RecentGameLimit = (typeof RECENT_GAME_OPTIONS)[number];
export const DEFAULT_RECENT_GAME_LIMIT: RecentGameLimit = 5;
export const MAX_RECENT_GAMES = 20;

export const STATS_RANGE_OPTIONS = [
  { id: "all", limit: null, label: "Celá historie" },
  { id: "1000", limit: 1000, label: "1000 her" },
  { id: "500", limit: 500, label: "500 her" },
  { id: "100", limit: 100, label: "100 her" },
  { id: "50", limit: 50, label: "50 her" },
  { id: "10", limit: 10, label: "10 her" },
] as const;

export type StatsRangeId = (typeof STATS_RANGE_OPTIONS)[number]["id"];
export const DEFAULT_STATS_RANGE: StatsRangeId = "1000";

export type PandemicStatsBundle = {
  ranges: Record<StatsRangeId, PandemicStats>;
  recentGames: RecentGame[];
};

export type PandemicStats = {
  games: number;
  wins: number;
  winRate: number | null;
  seats: number;
  averagePlayers: number | null;
  gamesWithRoleChange: number;
  roleChanges: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
  missing: {
    result: number;
    mode: number;
    difficulty: number;
    players: number;
  };
  modeDifficulty: {
    modes: CountRow[];
    difficulties: CountRow[];
    counts: number[][];
  };
  modes: CountRow[];
  difficulties: CountRow[];
  results: CountRow[];
  roles: RoleRow[];
  players: PlayerRow[];
  diseases: DiseaseRow[];
  strainColors: CountRow[];
  strainGames: number;
  roleChangePairs: ChangeRow[];
  roleChangeFrom: ChangeSideRow[];
  roleChangeTo: ChangeSideRow[];
  roleChangeDepth: { none: number; one: number; twoOrMore: number };
  favorites: CountRow[];
  playerCounts: CountRow[];
  recentGames: RecentGame[];
};

const MODE_ORDER = [
  "klasika",
  "zhoubny kmen",
  "mutace",
  "worldwide m.",
  "worldwide m",
  "laborator",
  "bioterorista",
  "combo",
];

const DIFFICULTY_ORDER = [
  "jednoducha",
  "stredne narocna",
  "velmi narocna",
  "legendarni",
];

const RESULT_ORDER = [
  "vyhra",
  "prohra - kostky",
  "prohra - karty",
  "prohra - pandemie",
];

const DISEASE_STATE_ORDER = ["nic", "vynalezeno", "vymyceno"];

const DISEASES = [
  { key: "yellow_disease", label: "Žlutá" },
  { key: "red_disease", label: "Červená" },
  { key: "blue_disease", label: "Modrá" },
  { key: "black_disease", label: "Černá" },
  { key: "purple_disease", label: "Fialová" },
] as const;

export function isWin(result: string | null) {
  return foldCode(result ?? "") === "vyhra";
}

export function share(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return (part / whole) * 100;
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

function byPreferred(order: string[]) {
  const rank = new Map(order.map((value, index) => [value, index]));
  return (left: string, right: string) => {
    const leftRank = rank.get(foldCode(left)) ?? order.length;
    const rightRank = rank.get(foldCode(right)) ?? order.length;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.localeCompare(right, "cs");
  };
}

function bySavedAtDesc(left: StatsGame, right: StatsGame) {
  const byTime = (right.created_at ?? "").localeCompare(left.created_at ?? "");
  if (byTime !== 0) return byTime;
  return right.id.localeCompare(left.id);
}

function byPlayedThenSavedDesc(left: StatsGame, right: StatsGame) {
  const byPlayed = (right.played_at ?? "").localeCompare(left.played_at ?? "");
  if (byPlayed !== 0) return byPlayed;
  return bySavedAtDesc(left, right);
}

export function statsRangeLimit(rangeId: StatsRangeId): number | null {
  return STATS_RANGE_OPTIONS.find((option) => option.id === rangeId)?.limit ?? null;
}

export function windowSource(source: StatsSource, limit: number | null): StatsSource {
  if (limit === null || source.games.length <= limit) return source;
  const games = [...source.games].sort(byPlayedThenSavedDesc).slice(0, limit);
  const ids = new Set(games.map((game) => game.id));
  return {
    ...source,
    games,
    seats: source.seats.filter((seat) => ids.has(seat.game_id)),
    roleChanges: source.roleChanges.filter((change) => ids.has(change.game_id)),
  };
}

export function filterStatsSource(source: StatsSource, filter: StatsGameFilter): StatsSource {
  const mode = filter.mode || null;
  const difficulty = filter.difficulty || null;
  const playerCount = filter.playerCount ?? null;
  if (!mode && !difficulty && playerCount == null) return source;

  const seatsByGame = new Map<string, number>();
  if (playerCount != null) {
    for (const seat of source.seats) {
      seatsByGame.set(seat.game_id, (seatsByGame.get(seat.game_id) ?? 0) + 1);
    }
  }

  const games = source.games.filter((game) => {
    if (mode && foldCode(game.game_mode_code ?? "") !== foldCode(mode)) return false;
    if (difficulty && foldCode(game.difficulty_code ?? "") !== foldCode(difficulty)) return false;
    if (playerCount != null && (seatsByGame.get(game.id) ?? 0) !== playerCount) return false;
    return true;
  });
  const ids = new Set(games.map((game) => game.id));
  return {
    ...source,
    games,
    seats: source.seats.filter((seat) => ids.has(seat.game_id)),
    roleChanges: source.roleChanges.filter((change) => ids.has(change.game_id)),
  };
}

function collectKeys(values: (string | null)[], catalog: CodeName[], order: string[]) {
  const keys = new Set<string>();
  for (const value of values) {
    if (value) keys.add(value);
  }
  for (const row of catalog) {
    if (row.code) keys.add(row.code);
  }
  return [...keys].sort(byPreferred(order));
}

function countRows(
  keys: string[],
  games: StatsGame[],
  field: keyof Pick<StatsGame, "game_mode_code" | "difficulty_code" | "result_code">,
  label: (code: string | null) => string,
): CountRow[] {
  return keys.map((key) => {
    const matched = games.filter((game) => game[field] === key);
    const wins = matched.filter((game) => isWin(game.result_code)).length;
    return {
      key,
      label: label(key),
      games: matched.length,
      wins,
      share: share(matched.length, games.length),
      winRate: share(wins, matched.length),
    };
  });
}

export function describeRecentGame(
  game: StatsGame,
  seats: StatsSeat[],
  changes: StatsRoleChange[],
  names: {
    player: (playerId: string | null) => string;
    role: (code: string | null) => string;
    result: (code: string | null) => string;
    mode: (code: string | null) => string;
    difficulty: (code: string | null) => string;
    disease: (code: string | null) => string;
    strain: (code: string | null) => string;
    account: (userId: string | null) => string | null;
  },
): RecentGame {
  const orderedSeats = [...seats].sort((left, right) => left.player_order - right.player_order);
  const orderedChanges = [...changes].sort((left, right) => left.change_order - right.change_order);

  return {
    id: game.id,
    playedAt: game.played_at,
    savedAt: game.created_at,
    result: names.result(game.result_code),
    mode: names.mode(game.game_mode_code),
    difficulty: names.difficulty(game.difficulty_code),
    players: orderedSeats.map((seat) => ({
      name: names.player(seat.player_id),
      role: names.role(seat.role_code),
    })),
    changes: orderedChanges.map((change) => ({
      name: names.player(change.player_id),
      from: names.role(change.from_role_code),
      to: names.role(change.to_role_code),
    })),
    diseases: DISEASES.flatMap((disease) => {
      const code = game[disease.key];
      if (!code) return [];
      return [{ label: disease.label, state: names.disease(code) }];
    }),
    strain: modeAllowsVirulentStrain(game.game_mode_code)
      ? game.virulent_strain_color
        ? names.strain(game.virulent_strain_color)
        : "neuvedeno"
      : null,
    note: game.note,
    recordedBy: names.account(game.created_by),
  };
}

export type NotedGame = {
  id: string;
  playedAt: string | null;
  note: string;
  summary: string;
};

export function listNotedGames(source: StatsSource): NotedGame[] {
  const modeLabel = labelMap(source.modes);
  const difficultyLabel = labelMap(source.difficulties);
  const resultLabel = labelMap(source.results);
  const roleLabel = labelMap(source.roles);
  const diseaseLabel = labelMap(source.diseaseStates);
  const strainLabel = labelMap(source.strainColors);
  const playerNames = new Map(source.players.map((player) => [player.code, player.name_cs]));
  const accountNames = new Map(source.accounts.map((account) => [account.code, account.name_cs]));
  const names = {
    player: (playerId: string | null) => (playerId && playerNames.get(playerId)) || "Neznámý hráč",
    role: roleLabel,
    result: resultLabel,
    mode: modeLabel,
    difficulty: difficultyLabel,
    disease: diseaseLabel,
    strain: strainLabel,
    account: (userId: string | null) => {
      if (!userId) return null;
      return accountNames.get(userId) ?? "Neznámý účet";
    },
  };

  const seatsByGame = new Map<string, StatsSeat[]>();
  for (const seat of source.seats) {
    const list = seatsByGame.get(seat.game_id) ?? [];
    list.push(seat);
    seatsByGame.set(seat.game_id, list);
  }
  const changesByGame = new Map<string, StatsRoleChange[]>();
  for (const change of source.roleChanges) {
    const list = changesByGame.get(change.game_id) ?? [];
    list.push(change);
    changesByGame.set(change.game_id, list);
  }

  const noted: NotedGame[] = [];
  for (const game of source.games) {
    const note = game.note?.trim();
    if (!note) continue;
    const recent = describeRecentGame(
      game,
      seatsByGame.get(game.id) ?? [],
      changesByGame.get(game.id) ?? [],
      names,
    );
    noted.push({
      id: game.id,
      playedAt: game.played_at,
      note,
      summary: notedGameSummary(recent),
    });
  }
  return noted;
}

function notedGameSummary(game: RecentGame) {
  const stated = (value: string | null | undefined) =>
    value && value !== "Neuvedeno" ? value : null;
  const headline = [stated(game.result), stated(game.difficulty), stated(game.mode)]
    .filter((part): part is string => Boolean(part))
    .join(", ");
  const players = game.players
    .map((player) => {
      const role = stated(player.role);
      return role ? `${player.name} (${role})` : player.name;
    })
    .join(", ");
  const changes =
    game.changes.length > 0
      ? `Změny rolí: ${game.changes
          .map((change) => `${change.name} ${change.from} → ${change.to}`)
          .join("; ")}`
      : null;
  const diseases =
    game.diseases.length > 0
      ? `Nemocí: ${game.diseases.map((disease) => `${disease.label} ${disease.state}`).join(", ")}`
      : null;
  const strain = game.strain && game.strain !== "neuvedeno" ? `Zhoubný kmen: ${game.strain}` : null;
  const recorded = game.recordedBy ? `Zapsal ${game.recordedBy}` : null;
  const parts = [headline, players ? `Hráli ${players}` : null, changes, diseases, strain, recorded].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join(". ");
}

export function buildPandemicStats(
  source: StatsSource,
  options?: { recentLimit?: number },
): PandemicStats {
  const recentLimit = options?.recentLimit ?? MAX_RECENT_GAMES;
  const games = source.games;
  const gameCount = games.length;
  const wins = games.filter((game) => isWin(game.result_code)).length;
  const modeLabel = labelMap(source.modes);
  const difficultyLabel = labelMap(source.difficulties);
  const resultLabel = labelMap(source.results);
  const roleLabel = labelMap(source.roles);
  const diseaseLabel = labelMap(source.diseaseStates);
  const strainLabel = labelMap(source.strainColors);
  const playerNames = new Map(source.players.map((player) => [player.code, player.name_cs]));
  const accountNames = new Map(source.accounts.map((account) => [account.code, account.name_cs]));

  const seatsByGame = new Map<string, StatsSeat[]>();
  for (const seat of source.seats) {
    const list = seatsByGame.get(seat.game_id) ?? [];
    list.push(seat);
    seatsByGame.set(seat.game_id, list);
  }

  const changesByGame = new Map<string, StatsRoleChange[]>();
  for (const change of source.roleChanges) {
    const list = changesByGame.get(change.game_id) ?? [];
    list.push(change);
    changesByGame.set(change.game_id, list);
  }

  const modeKeys = collectKeys(
    games.map((game) => game.game_mode_code),
    source.modes,
    MODE_ORDER,
  );
  const difficultyKeys = collectKeys(
    games.map((game) => game.difficulty_code),
    source.difficulties,
    DIFFICULTY_ORDER,
  );
  const resultKeys = collectKeys(
    games.map((game) => game.result_code),
    source.results,
    RESULT_ORDER,
  );

  const modes = countRows(modeKeys, games, "game_mode_code", modeLabel);
  const difficulties = countRows(difficultyKeys, games, "difficulty_code", difficultyLabel);
  const results = countRows(resultKeys, games, "result_code", resultLabel).sort(
    (left, right) => right.games - left.games || left.label.localeCompare(right.label, "cs"),
  );

  const counts = modeKeys.map((mode) =>
    difficultyKeys.map(
      (difficulty) =>
        games.filter(
          (game) => game.game_mode_code === mode && game.difficulty_code === difficulty,
        ).length,
    ),
  );

  const roles = summarizeRoles(source, "any");
  const players = summarizePlayers(source);

  const diseaseStateKeys = collectKeys(
    games.flatMap((game) => [
      game.yellow_disease,
      game.red_disease,
      game.blue_disease,
      game.black_disease,
      game.purple_disease,
    ]),
    source.diseaseStates,
    DISEASE_STATE_ORDER,
  );

  const diseases: DiseaseRow[] = DISEASES.map((disease) => {
    const recorded = games.filter((game) => Boolean(game[disease.key]));
    return {
      key: disease.key,
      label: disease.label,
      total: recorded.length,
      states: diseaseStateKeys.map((state) => {
        const count = recorded.filter((game) => game[disease.key] === state).length;
        return {
          key: state,
          label: diseaseLabel(state),
          count,
          share: share(count, recorded.length),
        };
      }),
    };
  });

  const strainKeys = collectKeys(
    games.map((game) => game.virulent_strain_color),
    source.strainColors,
    [],
  );
  const strainGames = games.filter((game) => Boolean(game.virulent_strain_color));
  const strainColors = strainKeys.map((key) => {
    const matched = strainGames.filter((game) => game.virulent_strain_color === key);
    const strainWins = matched.filter((game) => isWin(game.result_code)).length;
    return {
      key,
      label: strainLabel(key),
      games: matched.length,
      wins: strainWins,
      share: share(matched.length, strainGames.length),
      winRate: share(strainWins, matched.length),
    };
  });

  const gameById = new Map(games.map((game) => [game.id, game]));
  const pairCounts = new Map<string, { from: string; to: string; count: number; gameIds: Set<string> }>();
  const fromCounts = new Map<string, { count: number; gameIds: Set<string> }>();
  const toCounts = new Map<string, { count: number; gameIds: Set<string> }>();
  for (const change of source.roleChanges) {
    const from = change.from_role_code ?? "";
    const to = change.to_role_code ?? "";
    const key = `${from}\u0000${to}`;
    const pair = pairCounts.get(key) ?? { from, to, count: 0, gameIds: new Set<string>() };
    pair.count += 1;
    pair.gameIds.add(change.game_id);
    pairCounts.set(key, pair);

    if (from) {
      const side = fromCounts.get(from) ?? { count: 0, gameIds: new Set<string>() };
      side.count += 1;
      side.gameIds.add(change.game_id);
      fromCounts.set(from, side);
    }
    if (to) {
      const side = toCounts.get(to) ?? { count: 0, gameIds: new Set<string>() };
      side.count += 1;
      side.gameIds.add(change.game_id);
      toCounts.set(to, side);
    }
  }

  function winsIn(gameIds: Set<string>) {
    let winCount = 0;
    for (const gameId of gameIds) {
      const game = gameById.get(gameId);
      if (game && isWin(game.result_code)) winCount += 1;
    }
    return winCount;
  }

  const roleChangePairs: ChangeRow[] = [...pairCounts.values()]
    .map((pair) => {
      const pairWins = winsIn(pair.gameIds);
      return {
        key: `${pair.from}\u0000${pair.to}`,
        from: roleLabel(pair.from || null),
        to: roleLabel(pair.to || null),
        count: pair.count,
        games: pair.gameIds.size,
        wins: pairWins,
        share: share(pair.count, source.roleChanges.length),
        winRate: share(pairWins, pair.gameIds.size),
      };
    })
    .sort((left, right) => right.count - left.count || left.from.localeCompare(right.from, "cs"));

  function sideRows(counts: Map<string, { count: number; gameIds: Set<string> }>): ChangeSideRow[] {
    return [...counts.entries()]
      .map(([key, side]) => {
        const sideWins = winsIn(side.gameIds);
        return {
          key,
          label: roleLabel(key),
          count: side.count,
          games: side.gameIds.size,
          wins: sideWins,
          share: share(side.count, source.roleChanges.length),
          winRate: share(sideWins, side.gameIds.size),
        };
      })
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "cs"));
  }

  const roleChangeFrom = sideRows(fromCounts);
  const roleChangeTo = sideRows(toCounts);
  const favorites = summarizeFavorites(source);
  const playerCounts = summarizePlayerCounts(source);

  let none = 0;
  let one = 0;
  let twoOrMore = 0;
  for (const game of games) {
    const count = changesByGame.get(game.id)?.length ?? 0;
    if (count === 0) none += 1;
    else if (count === 1) one += 1;
    else twoOrMore += 1;
  }

  const playedDates = games
    .map((game) => game.played_at)
    .filter((value): value is string => Boolean(value))
    .sort();

  const nameFor = (playerId: string | null) =>
    (playerId && playerNames.get(playerId)) || "Neznámý hráč";
  const accountFor = (userId: string | null) => {
    if (!userId) return null;
    return accountNames.get(userId) ?? "Neznámý účet";
  };

  const recentGames: RecentGame[] =
    recentLimit <= 0
      ? []
      : [...games]
          .sort(bySavedAtDesc)
          .slice(0, recentLimit)
          .map((game) =>
            describeRecentGame(
              game,
              seatsByGame.get(game.id) ?? [],
              changesByGame.get(game.id) ?? [],
              {
                player: nameFor,
                role: roleLabel,
                result: resultLabel,
                mode: modeLabel,
                difficulty: difficultyLabel,
                disease: diseaseLabel,
                strain: strainLabel,
                account: accountFor,
              },
            ),
          );

  const gamesWithSeats = new Set(source.seats.map((seat) => seat.game_id));

  return {
    games: gameCount,
    wins,
    winRate: share(wins, gameCount),
    seats: source.seats.length,
    averagePlayers: gameCount > 0 ? source.seats.length / gameCount : null,
    gamesWithRoleChange: gameCount - none,
    roleChanges: source.roleChanges.length,
    firstPlayedAt: playedDates[0] ?? null,
    lastPlayedAt: playedDates.at(-1) ?? null,
    missing: {
      result: games.filter((game) => !game.result_code).length,
      mode: games.filter((game) => !game.game_mode_code).length,
      difficulty: games.filter((game) => !game.difficulty_code).length,
      players: games.filter((game) => !gamesWithSeats.has(game.id)).length,
    },
    modeDifficulty: { modes, difficulties, counts },
    modes,
    difficulties,
    results,
    roles,
    players,
    diseases,
    strainColors,
    strainGames: strainGames.length,
    roleChangePairs,
    roleChangeFrom,
    roleChangeTo,
    roleChangeDepth: { none, one, twoOrMore },
    favorites,
    playerCounts,
    recentGames,
  };
}

export function buildPandemicStatsBundle(source: StatsSource): PandemicStatsBundle {
  const ranges = {} as Record<StatsRangeId, PandemicStats>;
  for (const option of STATS_RANGE_OPTIONS) {
    ranges[option.id] = buildPandemicStats(windowSource(source, option.limit), {
      recentLimit: option.limit === null ? MAX_RECENT_GAMES : 0,
    });
  }
  return {
    ranges,
    recentGames: ranges.all.recentGames,
  };
}

const RETIRED_ROLE_FOLDS = new Set([
  "virolozka",
  "vir",
  "bioterorista",
  "booterorista",
  "bio",
  "kontak",
  "cont",
  "lokalka",
  "lokal",
  "rejza",
  "pilot",
]);

const FAVORITE_COMBOS = [
  { key: "klasika-legendarni", label: "Legendární klasika", mode: "klasika", difficulty: "legendarni" },
  {
    key: "zhoubny-velmi",
    label: "Velmi náročný zhoubný kmen",
    mode: "zhoubny kmen",
    difficulty: "velmi narocna",
  },
  { key: "mutace-velmi", label: "Velmi náročná mutace", mode: "mutace", difficulty: "velmi narocna" },
] as const;

const MONTH_LABELS = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

export function isRetiredRole(code: string, label: string) {
  return [foldCode(code), foldCode(label)].some((value) => RETIRED_ROLE_FOLDS.has(value));
}

function playerCountLabel(count: number) {
  if (count === 1) return "1 hráč";
  if (count >= 2 && count <= 4) return `${count} hráči`;
  return `${count} hráčů`;
}

function matchesCatalog(code: string | null, expected: string, label: (value: string | null) => string) {
  if (!code) return false;
  return foldCode(code) === expected || foldCode(label(code)) === expected;
}

function winsAmong(gameIds: Iterable<string>, gameById: Map<string, StatsGame>) {
  let wins = 0;
  for (const gameId of gameIds) {
    const game = gameById.get(gameId);
    if (game && isWin(game.result_code)) wins += 1;
  }
  return wins;
}

export function summarizeRoles(source: StatsSource, lens: RoleLens = "any"): RoleRow[] {
  const roleLabel = labelMap(source.roles);
  const gameById = new Map(source.games.map((game) => [game.id, game]));
  const byGame = new Map<string, Map<string, { starts: number; arrivals: number; departures: number }>>();

  function touch(
    gameId: string,
    role: string | null,
    field: "starts" | "arrivals" | "departures",
  ) {
    if (!role || !gameById.has(gameId)) return;
    const roles = byGame.get(gameId) ?? new Map<string, { starts: number; arrivals: number; departures: number }>();
    const current = roles.get(role) ?? { starts: 0, arrivals: 0, departures: 0 };
    current[field] += 1;
    roles.set(role, current);
    byGame.set(gameId, roles);
  }

  for (const seat of source.seats) touch(seat.game_id, seat.role_code, "starts");
  for (const change of source.roleChanges) {
    touch(change.game_id, change.from_role_code, "departures");
    touch(change.game_id, change.to_role_code, "arrivals");
  }

  const totals = new Map<
    string,
    { games: Set<string>; starts: number; arrivals: number; departures: number }
  >();

  for (const [gameId, roles] of byGame) {
    for (const [role, touchInfo] of roles) {
      const qualifies =
        lens === "entire"
          ? touchInfo.starts > 0 && touchInfo.arrivals === 0 && touchInfo.departures === 0
          : lens === "from"
            ? touchInfo.departures > 0
            : lens === "to"
              ? touchInfo.arrivals > 0
              : touchInfo.starts > 0 || touchInfo.arrivals > 0 || touchInfo.departures > 0;
      if (!qualifies) continue;
      const total = totals.get(role) ?? {
        games: new Set<string>(),
        starts: 0,
        arrivals: 0,
        departures: 0,
      };
      total.games.add(gameId);
      total.starts += touchInfo.starts;
      total.arrivals += touchInfo.arrivals;
      total.departures += touchInfo.departures;
      totals.set(role, total);
    }
  }

  const gameCount = source.games.length;
  const keys = new Set<string>([...source.roles.map((role) => role.code), ...totals.keys()]);
  return [...keys].filter(Boolean).map((key) => {
    const total = totals.get(key);
    const played = total?.games.size ?? 0;
    const roleWins = total ? winsAmong(total.games, gameById) : 0;
    const label = roleLabel(key);
    return {
      key,
      label,
      games: played,
      wins: roleWins,
      share: share(played, gameCount),
      winRate: share(roleWins, played),
      starts: total?.starts ?? 0,
      arrivals: total?.arrivals ?? 0,
      departures: total?.departures ?? 0,
      retired: isRetiredRole(key, label),
    };
  });
}

export function summarizePlayers(source: StatsSource): PlayerRow[] {
  const roleLabel = labelMap(source.roles);
  const playerNames = new Map(source.players.map((player) => [player.code, player.name_cs]));
  const gameById = new Map(source.games.map((game) => [game.id, game]));
  const playerGameIds = new Map<string, Set<string>>();
  const playerRoleCounts = new Map<string, Map<string, number>>();

  for (const seat of source.seats) {
    if (!seat.player_id || !gameById.has(seat.game_id)) continue;
    const ids = playerGameIds.get(seat.player_id) ?? new Set<string>();
    ids.add(seat.game_id);
    playerGameIds.set(seat.player_id, ids);
    if (seat.role_code) {
      const rolesForPlayer = playerRoleCounts.get(seat.player_id) ?? new Map<string, number>();
      rolesForPlayer.set(seat.role_code, (rolesForPlayer.get(seat.role_code) ?? 0) + 1);
      playerRoleCounts.set(seat.player_id, rolesForPlayer);
    }
  }

  return [...playerGameIds.entries()]
    .map(([playerId, ids]) => {
      const playerWins = winsAmong(ids, gameById);
      const roleCounts = [...(playerRoleCounts.get(playerId)?.entries() ?? [])].sort(
        (left, right) =>
          right[1] - left[1] || roleLabel(left[0]).localeCompare(roleLabel(right[0]), "cs"),
      );
      return {
        key: playerId,
        label: playerNames.get(playerId) ?? "Neznámý hráč",
        games: ids.size,
        wins: playerWins,
        winRate: share(playerWins, ids.size),
        topRole: roleCounts[0] ? roleLabel(roleCounts[0][0]) : null,
      };
    })
    .sort((left, right) => right.games - left.games || left.label.localeCompare(right.label, "cs"));
}

export function summarizeFavorites(source: StatsSource): CountRow[] {
  const modeLabel = labelMap(source.modes);
  const difficultyLabel = labelMap(source.difficulties);
  return FAVORITE_COMBOS.map((combo) => {
    const matched = source.games.filter(
      (game) =>
        matchesCatalog(game.game_mode_code, combo.mode, modeLabel) &&
        matchesCatalog(game.difficulty_code, combo.difficulty, difficultyLabel),
    );
    const comboWins = matched.filter((game) => isWin(game.result_code)).length;
    return {
      key: combo.key,
      label: combo.label,
      games: matched.length,
      wins: comboWins,
      share: share(matched.length, source.games.length),
      winRate: share(comboWins, matched.length),
    };
  });
}

export function summarizePlayerCounts(source: StatsSource): CountRow[] {
  const seatsByGame = new Map<string, number>();
  for (const seat of source.seats) {
    seatsByGame.set(seat.game_id, (seatsByGame.get(seat.game_id) ?? 0) + 1);
  }
  const groups = new Map<number, StatsGame[]>();
  for (const game of source.games) {
    const count = seatsByGame.get(game.id) ?? 0;
    if (count <= 0) continue;
    const list = groups.get(count) ?? [];
    list.push(game);
    groups.set(count, list);
  }
  return [...groups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([count, matched]) => {
      const groupWins = matched.filter((game) => isWin(game.result_code)).length;
      return {
        key: String(count),
        label: playerCountLabel(count),
        games: matched.length,
        wins: groupWins,
        share: share(matched.length, source.games.length),
        winRate: share(groupWins, matched.length),
      };
    });
}

export function summarizeCrews(source: StatsSource, size: 2 | 3 | 4): CrewRow[] {
  const playerNames = new Map(source.players.map((player) => [player.code, player.name_cs]));
  const seatsByGame = new Map<string, StatsSeat[]>();
  for (const seat of source.seats) {
    const list = seatsByGame.get(seat.game_id) ?? [];
    list.push(seat);
    seatsByGame.set(seat.game_id, list);
  }

  const crews = new Map<string, { label: string; games: number; wins: number }>();
  for (const game of source.games) {
    const seats = (seatsByGame.get(game.id) ?? []).filter((seat) => seat.player_id);
    if (seats.length !== size) continue;
    const ids = [...new Set(seats.map((seat) => seat.player_id as string))];
    if (ids.length !== size) continue;
    ids.sort();
    const key = ids.join("\u0000");
    const label = ids
      .map((id) => playerNames.get(id) ?? "Neznámý hráč")
      .sort((left, right) => left.localeCompare(right, "cs"))
      .join(", ");
    const current = crews.get(key) ?? { label, games: 0, wins: 0 };
    current.games += 1;
    if (isWin(game.result_code)) current.wins += 1;
    crews.set(key, current);
  }

  return [...crews.entries()]
    .map(([key, crew]) => ({
      key,
      label: crew.label,
      games: crew.games,
      wins: crew.wins,
      winRate: share(crew.wins, crew.games),
    }))
    .sort((left, right) => right.games - left.games || left.label.localeCompare(right.label, "cs"));
}

export function buildTimeline(source: StatsSource, bucket: TimelineBucket) {
  const buckets = new Map<string, { games: number; wins: number }>();
  let undated = 0;
  for (const game of source.games) {
    const day = game.played_at?.slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      undated += 1;
      continue;
    }
    const key = bucket === "year" ? day.slice(0, 4) : day.slice(0, 7);
    const current = buckets.get(key) ?? { games: 0, wins: 0 };
    current.games += 1;
    if (isWin(game.result_code)) current.wins += 1;
    buckets.set(key, current);
  }

  const known = [...buckets.keys()].sort();
  if (known.length === 0) return { points: [] as TimelinePoint[], undated };

  const filled: string[] = [];
  if (bucket === "year") {
    const start = Number(known[0]);
    const end = Number(known[known.length - 1]);
    for (let year = start; year <= end; year += 1) filled.push(String(year));
  } else {
    let year = Number(known[0]?.slice(0, 4));
    let month = Number(known[0]?.slice(5, 7));
    const endYear = Number(known[known.length - 1]?.slice(0, 4));
    const endMonth = Number(known[known.length - 1]?.slice(5, 7));
    while (year < endYear || (year === endYear && month <= endMonth)) {
      filled.push(`${year}-${String(month).padStart(2, "0")}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  const points = filled.map((key) => {
    const current = buckets.get(key) ?? { games: 0, wins: 0 };
    const label =
      bucket === "year" ? key : `${MONTH_LABELS[Number(key.slice(5, 7)) - 1] ?? key} ${key.slice(0, 4)}`;
    return {
      key,
      label,
      games: current.games,
      wins: current.wins,
      winRate: share(current.wins, current.games),
    };
  });
  return { points, undated };
}

function formatStatDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

export function buildHighlights(source: StatsSource): Highlight[] {
  const numberFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
  const dated = source.games.filter((game) => /^\d{4}-\d{2}-\d{2}/.test(game.played_at ?? ""));
  const highlights: Highlight[] = [];

  const byDay = new Map<string, number>();
  for (const game of dated) {
    const day = game.played_at?.slice(0, 10) ?? "";
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  let busiestDay = "";
  let busiestCount = 0;
  for (const [day, count] of byDay) {
    if (count > busiestCount || (count === busiestCount && day > busiestDay)) {
      busiestDay = day;
      busiestCount = count;
    }
  }
  if (busiestCount >= 2) {
    highlights.push({
      id: "busiest-day",
      label: "Nejvíc her v jeden den",
      value: `${numberFormat.format(busiestCount)} her`,
      detail: formatStatDay(busiestDay),
    });
  }

  const ordered = [...dated].sort((left, right) => byPlayedThenSavedDesc(right, left));
  const streak: {
    current: { win: boolean; count: number; from: string; to: string } | null;
    win: { count: number; from: string; to: string } | null;
    loss: { count: number; from: string; to: string } | null;
  } = { current: null, win: null, loss: null };
  function closeStreak() {
    const current = streak.current;
    streak.current = null;
    if (!current || current.count < 2) return;
    const next = { count: current.count, from: current.from, to: current.to };
    const best = current.win ? streak.win : streak.loss;
    if (!best || next.count > best.count) {
      if (current.win) streak.win = next;
      else streak.loss = next;
    }
  }
  for (const game of ordered) {
    if (!game.result_code) {
      closeStreak();
      continue;
    }
    const win = isWin(game.result_code);
    const day = game.played_at?.slice(0, 10) ?? "";
    if (streak.current && streak.current.win === win) {
      streak.current.count += 1;
      streak.current.to = day;
    } else {
      closeStreak();
      streak.current = { win, count: 1, from: day, to: day };
    }
  }
  closeStreak();
  if (streak.win) {
    highlights.push({
      id: "win-streak",
      label: "Nejdelší série výher",
      value: `${numberFormat.format(streak.win.count)} výher`,
      detail: `${formatStatDay(streak.win.from)} – ${formatStatDay(streak.win.to)}`,
    });
  }
  if (streak.loss) {
    highlights.push({
      id: "loss-streak",
      label: "Nejdelší série proher",
      value: `${numberFormat.format(streak.loss.count)} proher`,
      detail: `${formatStatDay(streak.loss.from)} – ${formatStatDay(streak.loss.to)}`,
    });
  }

  const months = buildTimeline(source, "month").points.filter((point) => point.games >= 8);
  const bestMonth = [...months].sort(
    (left, right) => (right.winRate ?? 0) - (left.winRate ?? 0) || right.games - left.games,
  )[0];
  const worstMonth = [...months].sort(
    (left, right) => (left.winRate ?? 0) - (right.winRate ?? 0) || right.games - left.games,
  )[0];
  if (bestMonth && bestMonth.winRate !== null) {
    highlights.push({
      id: "best-month",
      label: "Nejúspěšnější měsíc",
      value: `${numberFormat.format(bestMonth.winRate)} %`,
      detail: `${bestMonth.label} · ${numberFormat.format(bestMonth.games)} her`,
    });
  }
  if (worstMonth && worstMonth !== bestMonth && worstMonth.winRate !== null) {
    highlights.push({
      id: "worst-month",
      label: "Nejslabší měsíc",
      value: `${numberFormat.format(worstMonth.winRate)} %`,
      detail: `${worstMonth.label} · ${numberFormat.format(worstMonth.games)} her`,
    });
  }

  const players = summarizePlayers(source);
  const busiestPlayer = players[0];
  if (busiestPlayer && busiestPlayer.games > 0) {
    highlights.push({
      id: "busiest-player",
      label: "Nejvíc odehraných her",
      value: busiestPlayer.label,
      detail: `${numberFormat.format(busiestPlayer.games)} her · ${
        busiestPlayer.winRate === null ? "bez úspěšnosti" : `${numberFormat.format(busiestPlayer.winRate)} %`
      }`,
    });
  }
  const minPlayerGames = source.games.length >= 40 ? 10 : 3;
  const sharpest = players
    .filter((player) => player.games >= minPlayerGames && player.winRate !== null)
    .sort((left, right) => (right.winRate ?? 0) - (left.winRate ?? 0) || right.games - left.games)[0];
  if (sharpest && sharpest.winRate !== null) {
    highlights.push({
      id: "sharpest-player",
      label: "Nejvyšší úspěšnost hráče",
      value: sharpest.label,
      detail: `${numberFormat.format(sharpest.winRate)} % z ${numberFormat.format(sharpest.games)} her`,
    });
  }

  const topRole = summarizeRoles(source, "any")
    .filter((role) => role.games > 0)
    .sort((left, right) => right.games - left.games)[0];
  if (topRole) {
    highlights.push({
      id: "top-role",
      label: "Nejhranější role",
      value: topRole.label,
      detail: `${numberFormat.format(topRole.games)} her · ${
        topRole.winRate === null ? "bez úspěšnosti" : `${numberFormat.format(topRole.winRate)} %`
      }`,
    });
  }

  const seatsByGame = new Map<string, StatsSeat[]>();
  for (const seat of source.seats) {
    const list = seatsByGame.get(seat.game_id) ?? [];
    list.push(seat);
    seatsByGame.set(seat.game_id, list);
  }
  const playerNames = new Map(source.players.map((player) => [player.code, player.name_cs]));
  const playerDays = new Map<string, { name: string; day: string; count: number }>();
  for (const game of dated) {
    const day = game.played_at?.slice(0, 10) ?? "";
    const seen = new Set<string>();
    for (const seat of seatsByGame.get(game.id) ?? []) {
      if (!seat.player_id || seen.has(seat.player_id)) continue;
      seen.add(seat.player_id);
      const key = `${seat.player_id}\u0000${day}`;
      const entry = playerDays.get(key) ?? {
        name: playerNames.get(seat.player_id) ?? "Neznámý hráč",
        day,
        count: 0,
      };
      entry.count += 1;
      playerDays.set(key, entry);
    }
  }
  const busiestPlayerDay = [...playerDays.values()].sort(
    (left, right) => right.count - left.count || right.day.localeCompare(left.day),
  )[0];
  if (busiestPlayerDay && busiestPlayerDay.count >= 2) {
    highlights.push({
      id: "player-day",
      label: "Nejvíc her jednoho hráče za den",
      value: `${numberFormat.format(busiestPlayerDay.count)} her`,
      detail: `${busiestPlayerDay.name} · ${formatStatDay(busiestPlayerDay.day)}`,
    });
  }

  return highlights;
}

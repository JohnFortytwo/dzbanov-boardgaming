import { foldCode } from "@/lib/pandemic/drafts";

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
};

export type CountRow = {
  key: string;
  label: string;
  games: number;
  wins: number;
  share: number | null;
  winRate: number | null;
};

export type RoleRow = CountRow & {
  starts: number;
  arrivals: number;
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
  from: string;
  to: string;
  count: number;
  share: number | null;
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

export type RecentGame = {
  id: string;
  playedAt: string | null;
  savedAt: string | null;
  result: string;
  mode: string;
  difficulty: string;
  players: RecentPlayer[];
  changes: RecentChange[];
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
  roleChangeDepth: { none: number; one: number; twoOrMore: number };
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

export function buildPandemicStats(source: StatsSource): PandemicStats {
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

  const roleGames = new Map<string, Set<string>>();
  const roleStarts = new Map<string, number>();
  const roleArrivals = new Map<string, number>();
  const roleWins = new Map<string, number>();

  function touchRole(role: string | null, gameId: string) {
    if (!role) return;
    const ids = roleGames.get(role) ?? new Set<string>();
    ids.add(gameId);
    roleGames.set(role, ids);
  }

  for (const seat of source.seats) {
    if (!seat.role_code) continue;
    touchRole(seat.role_code, seat.game_id);
    roleStarts.set(seat.role_code, (roleStarts.get(seat.role_code) ?? 0) + 1);
  }
  for (const change of source.roleChanges) {
    touchRole(change.from_role_code, change.game_id);
    touchRole(change.to_role_code, change.game_id);
    if (change.to_role_code) {
      roleArrivals.set(change.to_role_code, (roleArrivals.get(change.to_role_code) ?? 0) + 1);
    }
  }
  for (const [role, ids] of roleGames) {
    let roleWinCount = 0;
    for (const gameId of ids) {
      const game = games.find((item) => item.id === gameId);
      if (game && isWin(game.result_code)) roleWinCount += 1;
    }
    roleWins.set(role, roleWinCount);
  }

  const roleKeys = new Set<string>([
    ...source.roles.map((role) => role.code),
    ...roleGames.keys(),
  ]);
  const roles: RoleRow[] = [...roleKeys]
    .filter(Boolean)
    .map((key) => {
      const played = roleGames.get(key)?.size ?? 0;
      const roleWinCount = roleWins.get(key) ?? 0;
      return {
        key,
        label: roleLabel(key),
        games: played,
        wins: roleWinCount,
        share: share(played, gameCount),
        winRate: share(roleWinCount, played),
        starts: roleStarts.get(key) ?? 0,
        arrivals: roleArrivals.get(key) ?? 0,
      };
    })
    .sort((left, right) => right.games - left.games || left.label.localeCompare(right.label, "cs"));

  const playerGameIds = new Map<string, Set<string>>();
  const playerRoleCounts = new Map<string, Map<string, number>>();
  for (const seat of source.seats) {
    if (!seat.player_id) continue;
    const ids = playerGameIds.get(seat.player_id) ?? new Set<string>();
    ids.add(seat.game_id);
    playerGameIds.set(seat.player_id, ids);
    if (seat.role_code) {
      const rolesForPlayer = playerRoleCounts.get(seat.player_id) ?? new Map<string, number>();
      rolesForPlayer.set(seat.role_code, (rolesForPlayer.get(seat.role_code) ?? 0) + 1);
      playerRoleCounts.set(seat.player_id, rolesForPlayer);
    }
  }

  const players: PlayerRow[] = [...playerGameIds.entries()]
    .map(([playerId, ids]) => {
      let playerWins = 0;
      for (const gameId of ids) {
        const game = games.find((item) => item.id === gameId);
        if (game && isWin(game.result_code)) playerWins += 1;
      }
      const roleCounts = [...(playerRoleCounts.get(playerId)?.entries() ?? [])].sort(
        (left, right) => right[1] - left[1] || roleLabel(left[0]).localeCompare(roleLabel(right[0]), "cs"),
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

  const pairCounts = new Map<string, { from: string; to: string; count: number }>();
  for (const change of source.roleChanges) {
    const from = change.from_role_code ?? "";
    const to = change.to_role_code ?? "";
    const key = `${from}\u0000${to}`;
    const current = pairCounts.get(key) ?? { from, to, count: 0 };
    current.count += 1;
    pairCounts.set(key, current);
  }
  const roleChangePairs: ChangeRow[] = [...pairCounts.values()]
    .map((pair) => ({
      from: roleLabel(pair.from || null),
      to: roleLabel(pair.to || null),
      count: pair.count,
      share: share(pair.count, source.roleChanges.length),
    }))
    .sort((left, right) => right.count - left.count || left.from.localeCompare(right.from, "cs"));

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

  const recentGames: RecentGame[] = [...games]
    .sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? ""))
    .slice(0, 8)
    .map((game) => {
      const seats = [...(seatsByGame.get(game.id) ?? [])].sort(
        (left, right) => left.player_order - right.player_order,
      );
      const changes = [...(changesByGame.get(game.id) ?? [])].sort(
        (left, right) => left.change_order - right.change_order,
      );
      const nameFor = (playerId: string | null) =>
        (playerId && playerNames.get(playerId)) || "Neznámý hráč";
      return {
        id: game.id,
        playedAt: game.played_at,
        savedAt: game.created_at,
        result: resultLabel(game.result_code),
        mode: modeLabel(game.game_mode_code),
        difficulty: difficultyLabel(game.difficulty_code),
        players: seats.map((seat) => ({
          name: nameFor(seat.player_id),
          role: roleLabel(seat.role_code),
        })),
        changes: changes.map((change) => ({
          name: nameFor(change.player_id),
          from: roleLabel(change.from_role_code),
          to: roleLabel(change.to_role_code),
        })),
      };
    });

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
    roleChangeDepth: { none, one, twoOrMore },
    recentGames,
  };
}

export type RoleSeat = {
  player_id: string | null;
  role_code: string | null;
};

export type RoleChangeCore = {
  player_id: string | null;
  to_role_code: string | null;
  change_order: number;
};

export function deriveFromRole(
  change: RoleChangeCore,
  changes: readonly RoleChangeCore[],
  seats: readonly RoleSeat[],
): string | null {
  if (!change.player_id) return null;

  const earlier = changes
    .filter(
      (item) =>
        item !== change &&
        item.player_id === change.player_id &&
        item.change_order < change.change_order,
    )
    .sort((left, right) => right.change_order - left.change_order);

  if (earlier.length > 0) return earlier[0].to_role_code;
  return seats.find((seat) => seat.player_id === change.player_id)?.role_code ?? null;
}

export function deriveOrderedFromRoles<T extends { player_id: string | null; to_role_code: string | null }>(
  changes: readonly T[],
  seats: readonly RoleSeat[],
): Array<T & { change_order: number; from_role_code: string | null }> {
  const cores: RoleChangeCore[] = changes.map((change, index) => ({
    player_id: change.player_id,
    to_role_code: change.to_role_code,
    change_order: index + 1,
  }));

  return changes.map((change, index) => ({
    ...change,
    change_order: index + 1,
    from_role_code: deriveFromRole(cores[index], cores, seats),
  }));
}

export function deriveStoredRoleChanges<
  T extends RoleChangeCore & { game_id: string },
>(
  changes: readonly T[],
  seats: readonly (RoleSeat & { game_id: string })[],
): Array<T & { from_role_code: string | null }> {
  const gameIds = [...new Set(changes.map((change) => change.game_id))];
  return gameIds.flatMap((gameId) => {
    const gameChanges = changes.filter((change) => change.game_id === gameId);
    const gameSeats = seats.filter((seat) => seat.game_id === gameId);
    const cores: RoleChangeCore[] = gameChanges.map((change) => ({
      player_id: change.player_id,
      to_role_code: change.to_role_code,
      change_order: change.change_order,
    }));
    return gameChanges.map((change, index) => ({
      ...change,
      from_role_code: deriveFromRole(cores[index], cores, gameSeats),
    }));
  });
}

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeDraftData,
  type DraftGame,
} from "@/lib/pandemic/drafts";

const LOCK_TTL_MS = 15 * 60 * 1000;

export class DraftQueueError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export type DraftQueueSnapshot = {
  draft: DraftGame | null;
  waiting_count: number;
  held_by_others: number;
  has_previous: boolean;
  has_next: boolean;
};

type DraftLock = {
  user_id: string;
  locked_at: string;
};

type QueueRow = {
  id: string;
  created_at: string;
  game_order: number;
  _lock: unknown;
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

function readLock(value: unknown): DraftLock | null {
  const record = asRecord(value);
  const userId = record.user_id;
  const lockedAt = record.locked_at;
  if (typeof userId !== "string" || typeof lockedAt !== "string") return null;
  if (!/^[0-9a-f-]{36}$/i.test(userId) || Number.isNaN(Date.parse(lockedAt))) return null;
  return { user_id: userId, locked_at: lockedAt };
}

function lockIsActive(lock: DraftLock | null, now: number) {
  if (!lock) return false;
  return now - Date.parse(lock.locked_at) < LOCK_TTL_MS;
}

function isClaimable(row: QueueRow, userId: string, now: number) {
  const lock = readLock(row._lock);
  if (!lock) return true;
  if (lock.user_id === userId) return true;
  return !lockIsActive(lock, now);
}

function compareRows(left: QueueRow, right: QueueRow) {
  const byCreated = left.created_at.localeCompare(right.created_at);
  if (byCreated !== 0) return byCreated;
  return left.game_order - right.game_order;
}

function isAfter(row: QueueRow, createdAt: string, gameOrder: number) {
  if (row.created_at > createdAt) return true;
  if (row.created_at < createdAt) return false;
  return row.game_order > gameOrder;
}

async function listQueue(): Promise<QueueRow[]> {
  const { data, error } = await supabaseAdmin
    .from("a4_draft_games")
    .select("id, created_at, game_order, draft_data->_lock")
    .eq("is_verified", false)
    .order("created_at", { ascending: true })
    .order("game_order", { ascending: true });

  if (error) {
    throw new DraftQueueError("Frontu přepisu se nepodařilo načíst.");
  }

  return (data ?? []).flatMap((row) => {
    if (typeof row.id !== "string" || typeof row.created_at !== "string") return [];
    return [
      {
        id: row.id,
        created_at: row.created_at,
        game_order: typeof row.game_order === "number" ? row.game_order : 0,
        _lock: row._lock,
      },
    ];
  }).sort(compareRows);
}

async function loadDraft(id: string): Promise<DraftGame | null> {
  const { data, error } = await supabaseAdmin
    .from("a4_draft_games")
    .select("id, scan_id, game_order, is_verified, created_at, draft_data")
    .eq("id", id)
    .eq("is_verified", false)
    .maybeSingle();

  if (error) {
    throw new DraftQueueError("Draft se nepodařilo načíst.");
  }

  if (!data || typeof data.id !== "string" || typeof data.scan_id !== "string") {
    return null;
  }

  return {
    id: data.id,
    scan_id: data.scan_id,
    game_order: typeof data.game_order === "number" ? data.game_order : 0,
    is_verified: Boolean(data.is_verified),
    created_at: typeof data.created_at === "string" ? data.created_at : "",
    draft_data: normalizeDraftData(data.draft_data),
  };
}

function neighbor(rows: QueueRow[], currentId: string, userId: string, now: number, direction: "next" | "previous") {
  const index = rows.findIndex((row) => row.id === currentId);
  if (index < 0) return null;
  const step = direction === "next" ? 1 : -1;

  for (let cursor = index + step; cursor >= 0 && cursor < rows.length; cursor += step) {
    const row = rows[cursor];
    if (row && isClaimable(row, userId, now)) return row;
  }

  return null;
}

async function snapshot(rows: QueueRow[], currentId: string | null, userId: string): Promise<DraftQueueSnapshot> {
  const now = Date.now();
  const heldByOthers = rows.filter((row) => {
    const lock = readLock(row._lock);
    return Boolean(lock && lock.user_id !== userId && lockIsActive(lock, now));
  }).length;

  return {
    draft: currentId ? await loadDraft(currentId) : null,
    waiting_count: rows.length,
    held_by_others: heldByOthers,
    has_previous: currentId ? Boolean(neighbor(rows, currentId, userId, now, "previous")) : false,
    has_next: currentId ? Boolean(neighbor(rows, currentId, userId, now, "next")) : false,
  };
}

async function claimRow(userId: string, row: QueueRow) {
  const { data, error } = await supabaseAdmin
    .from("a4_draft_games")
    .select("draft_data")
    .eq("id", row.id)
    .eq("is_verified", false)
    .maybeSingle();

  if (error || !data) return false;

  const record = asRecord(data.draft_data);
  const observed = readLock(record._lock);
  if (observed && observed.user_id !== userId && lockIsActive(observed, Date.now())) {
    return false;
  }

  const nextData = {
    ...record,
    _lock: { user_id: userId, locked_at: new Date().toISOString() },
  };

  let update = supabaseAdmin
    .from("a4_draft_games")
    .update({ draft_data: nextData })
    .eq("id", row.id)
    .eq("is_verified", false);

  update = observed
    ? update
        .eq("draft_data->_lock->>user_id", observed.user_id)
        .eq("draft_data->_lock->>locked_at", observed.locked_at)
    : update.is("draft_data->_lock->>user_id", null);

  const { data: updated, error: updateError } = await update.select("id");
  return !updateError && Boolean(updated?.length);
}

async function releaseOthers(userId: string, keepId: string, rows: QueueRow[]) {
  await Promise.all(
    rows.map(async (row) => {
      const lock = readLock(row._lock);
      if (!lock || lock.user_id !== userId || row.id === keepId) return;
      await releaseDraft(userId, row.id);
    }),
  );
}

async function claimFirst(userId: string, rows: QueueRow[], predicate: (row: QueueRow) => boolean) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const queue = attempt === 0 ? rows : await listQueue();
    const now = Date.now();
    const candidate = queue.find((row) => predicate(row) && isClaimable(row, userId, now));
    if (!candidate) {
      return snapshot(queue, null, userId);
    }

    const claimed = await claimRow(userId, candidate);
    if (!claimed) continue;

    const fresh = await listQueue();
    await releaseOthers(userId, candidate.id, fresh);
    return snapshot(fresh, candidate.id, userId);
  }

  throw new DraftQueueError("Volnou kartu se nepodařilo zamknout. Zkuste to znovu.");
}

function ownActiveRow(rows: QueueRow[], userId: string, now: number) {
  let best: QueueRow | null = null;
  let bestAt = "";

  for (const row of rows) {
    const lock = readLock(row._lock);
    if (!lock || lock.user_id !== userId || !lockIsActive(lock, now)) continue;
    if (!best || lock.locked_at > bestAt) {
      best = row;
      bestAt = lock.locked_at;
    }
  }

  return best;
}

export async function openDraftQueue(userId: string) {
  const rows = await listQueue();
  const now = Date.now();
  const current = ownActiveRow(rows, userId, now);

  if (current) {
    const refreshed = await claimRow(userId, current);
    if (refreshed) {
      const fresh = await listQueue();
      await releaseOthers(userId, current.id, fresh);
      return snapshot(fresh, current.id, userId);
    }
  }

  return claimFirst(userId, rows, () => true);
}

export async function moveDraftQueue(userId: string, direction: "next" | "previous", currentId: string) {
  const rows = await listQueue();
  if (!rows.some((row) => row.id === currentId)) {
    return openDraftQueue(userId);
  }

  const target = neighbor(rows, currentId, userId, Date.now(), direction);
  if (!target) {
    return snapshot(rows, currentId, userId);
  }

  const moved = await claimFirst(userId, rows, (row) => row.id === target.id);
  if (moved.draft?.id === target.id) return moved;

  const fresh = await listQueue();
  return snapshot(fresh, fresh.some((row) => row.id === currentId) ? currentId : null, userId);
}

export async function claimDraftAfter(userId: string, createdAt: string, gameOrder: number) {
  const rows = await listQueue();
  const later = await claimFirst(userId, rows, (row) => isAfter(row, createdAt, gameOrder));
  if (later.draft) return later;
  return claimFirst(userId, await listQueue(), () => true);
}

export async function releaseDraft(userId: string, draftId: string) {
  const { data, error } = await supabaseAdmin
    .from("a4_draft_games")
    .select("draft_data")
    .eq("id", draftId)
    .eq("is_verified", false)
    .maybeSingle();

  if (error || !data) return;

  const record = asRecord(data.draft_data);
  const lock = readLock(record._lock);
  if (!lock || lock.user_id !== userId) return;

  const nextData = { ...record };
  delete nextData._lock;

  await supabaseAdmin
    .from("a4_draft_games")
    .update({ draft_data: nextData })
    .eq("id", draftId)
    .eq("is_verified", false)
    .eq("draft_data->_lock->>user_id", userId)
    .eq("draft_data->_lock->>locked_at", lock.locked_at);
}

export async function assertOwnLock(userId: string, draftId: string) {
  const { data, error } = await supabaseAdmin
    .from("a4_draft_games")
    .select("id, created_at, game_order, is_verified, draft_data->_lock")
    .eq("id", draftId)
    .maybeSingle();

  if (error) {
    throw new DraftQueueError("Draft se nepodařilo načíst.");
  }

  if (!data || data.is_verified || typeof data.id !== "string") {
    return false;
  }

  const row: QueueRow = {
    id: data.id,
    created_at: typeof data.created_at === "string" ? data.created_at : "",
    game_order: typeof data.game_order === "number" ? data.game_order : 0,
    _lock: data._lock,
  };
  const lock = readLock(row._lock);
  if (lock && lock.user_id !== userId && lockIsActive(lock, Date.now())) {
    return false;
  }

  return claimRow(userId, row);
}

export async function heartbeatDraft(userId: string, draftId: string) {
  const { data, error } = await supabaseAdmin
    .from("a4_draft_games")
    .select("is_verified")
    .eq("id", draftId)
    .maybeSingle();

  if (error) {
    throw new DraftQueueError("Draft se nepodařilo načíst.");
  }

  if (!data || data.is_verified) {
    throw new DraftQueueError("Tuhle kartu už ve frontě není.", 409);
  }

  const owns = await assertOwnLock(userId, draftId);
  if (!owns) {
    throw new DraftQueueError("Tuhle kartu už přepisuje někdo jiný.", 409);
  }
}

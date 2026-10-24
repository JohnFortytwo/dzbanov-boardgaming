"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isBadgeId } from "@/lib/badges";
import { announceBadge } from "@/lib/badges-client";
import type { RecentGame } from "@/lib/pandemic/stats";

const savedFormat = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDay(value: string | null) {
  if (!value) return "–";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

function formatSaved(value: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return savedFormat.format(date);
}

function lineup(game: RecentGame) {
  const players = game.players.map((player) => `${player.name} (${player.role})`).join(", ");
  return players || "bez hráčů";
}

export function VoidLatestGame({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [game, setGame] = useState<RecentGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  async function openDialog() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setNotice(null);
    setGame(null);
    try {
      const response = await fetch("/api/pandemic/games/latest");
      const payload = (await response.json()) as { game?: RecentGame | null; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Poslední partii se nepodařilo načíst.");
      }
      setGame(payload.game ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Poslední partii se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!game || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/pandemic/games/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: game.id }),
      });
      const payload = (await response.json()) as { error?: string; badge?: unknown };
      if (!response.ok) {
        throw new Error(payload.error ?? "Partii se nepodařilo smazat.");
      }
      if (isBadgeId(payload.badge)) announceBadge(payload.badge);
      setOpen(false);
      setNotice("Poslední partie je smazaná a ze statistik zmizela.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Partii se nepodařilo smazat.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => void openDialog()}
        disabled={!enabled || loading || pending}
        className="inline-flex h-9 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 px-4 text-sm font-medium text-red-200 transition hover:border-red-300/50 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Smazat poslední partii
      </button>
      {notice ? <p className="max-w-xs text-xs text-emerald-300 sm:text-right">{notice}</p> : null}
      {error && !open ? <p className="max-w-xs text-xs text-red-300 sm:text-right">{error}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-latest-title"
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
          >
            <h2 id="void-latest-title" className="text-lg font-semibold text-white">
              Opravdu si přejete nenávratně smazat poslední odehranou hru?
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Ze statistik zmizí. V záloze databáze zůstane označená jako neplatná.
            </p>

            {loading ? <p className="mt-4 text-sm text-zinc-400">Načítám poslední partii…</p> : null}

            {!loading && game ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
                <p>
                  Uloženo {formatSaved(game.savedAt)}
                  {game.recordedBy ? ` · ${game.recordedBy}` : ""}
                </p>
                <p className="mt-1">
                  {formatDay(game.playedAt)} · {game.result} · {game.mode} · {game.difficulty}
                </p>
                <p className="mt-1 text-zinc-400">{lineup(game)}</p>
                {game.strain ? <p className="mt-1 text-zinc-400">Kmen: {game.strain}</p> : null}
                {game.note ? <p className="mt-1 text-zinc-400">Poznámka: {game.note}</p> : null}
              </div>
            ) : null}

            {!loading && !game && !error ? (
              <p className="mt-4 text-sm text-zinc-400">V databázi není žádná platná partie.</p>
            ) : null}

            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-60"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={!game || pending || loading}
                className="inline-flex h-9 items-center justify-center rounded-full bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Mažu…" : "Smazat partii"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

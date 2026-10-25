"use client";

import Link from "next/link";
import { useState } from "react";
import {
  diseaseFields,
  fieldClassName,
  GameCodeSelect,
  GameField,
  GamePlayerSelect,
  QuickCreate,
  roleOptionLabels,
  sortWithPriority,
} from "../game-fields";
import {
  emptyDraftData,
  emptyPlayer,
  foldCode,
  modeAllowsPurple,
  modeAllowsVirulentStrain,
  prepareDraft,
  type CodeLabel,
  type DraftData,
  type DraftPlayer,
  type PandemicCatalogs,
  type PlayerOption,
} from "@/lib/pandemic/drafts";
import { announceBadgeFromPayload } from "@/lib/badges-client";

const PLAYER_PRIORITY = ["Dorian", "Gart", "Usha", "Ruiner", "Thunder", "Zelwa"];
const ROLE_SINK = ["bio", "lokál", "pilot", "rejža", "vir"];

const addRowClassName =
  "inline-flex h-10 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.95)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-zinc-500 disabled:shadow-none";

function sortRoles(roles: CodeLabel[]) {
  const rank = new Map(ROLE_SINK.map((code, index) => [foldCode(code), index]));
  return [...roles].sort((left, right) => {
    const leftRank = rank.get(foldCode(left.code));
    const rightRank = rank.get(foldCode(right.code));
    if (leftRank === undefined && rightRank === undefined) {
      return left.name_cs.localeCompare(right.name_cs, "cs");
    }
    if (leftRank === undefined) return -1;
    if (rightRank === undefined) return 1;
    return leftRank - rightRank;
  });
}

function sortPlayers(players: PlayerOption[]) {
  const rank = new Map(PLAYER_PRIORITY.map((name, index) => [foldCode(name), index]));
  return [...players].sort((left, right) => {
    const leftRank = rank.get(foldCode(left.name)) ?? PLAYER_PRIORITY.length;
    const rightRank = rank.get(foldCode(right.name)) ?? PLAYER_PRIORITY.length;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.name.localeCompare(right.name, "cs");
  });
}

function pragueToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function freshForm(): DraftData {
  return {
    ...emptyDraftData(),
    played_at: pragueToday(),
    players: [emptyPlayer(1), emptyPlayer(2)],
  };
}

async function postCatalog(url: string, body: { name: string }) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload: { error?: string; player?: PlayerOption; role?: CodeLabel };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error("Uložení se nezdařilo.");
  }
  if (!response.ok) {
    throw new Error(payload.error ?? "Uložení se nezdařilo.");
  }
  return payload;
}

function playersInGame(form: DraftData, players: PlayerOption[]) {
  const ids = new Set(
    form.players.map((player) => player.matched_player_id).filter((id): id is string => Boolean(id)),
  );
  return players.filter((player) => ids.has(player.id));
}

export function NewGameForm({ catalogs: initialCatalogs }: { catalogs: PandemicCatalogs }) {
  const [catalogs, setCatalogs] = useState(() => ({
    ...initialCatalogs,
    players: sortPlayers(initialCatalogs.players),
    roles: sortRoles(initialCatalogs.roles),
  }));
  const [form, setForm] = useState<DraftData>(freshForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateForm(next: DraftData) {
    setForm(next);
    setErrors([]);
    setSavedId(null);
  }

  function updatePlayer(playerIndex: number, patch: Partial<DraftPlayer>) {
    updateForm({
      ...form,
      players: form.players.map((player, index) =>
        index === playerIndex ? { ...player, ...patch } : player,
      ),
    });
  }

  async function createPlayer(name: string) {
    const payload = await postCatalog("/api/pandemic/players", { name });
    const player = payload.player;
    if (!player?.id || !player.name) {
      throw new Error("Hráče se nepodařilo uložit.");
    }
    setCatalogs((current) => ({
      ...current,
      players: sortPlayers(
        [...current.players.filter((item) => item.id !== player.id), player],
      ),
    }));
  }

  async function createRole(name: string) {
    const payload = await postCatalog("/api/pandemic/roles", { name });
    const role = payload.role;
    if (!role?.code) {
      throw new Error("Roli se nepodařilo uložit.");
    }
    setCatalogs((current) => ({
      ...current,
      roles: sortRoles([...current.roles.filter((item) => item.code !== role.code), role]),
    }));
  }

  async function submit() {
    if (saving) return;
    const prepared = prepareDraft(form);
    if (prepared.errors.length > 0) {
      setErrors(prepared.errors);
      setSavedId(null);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const response = await fetch("/api/pandemic/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_data: prepared.draft }),
      });
      const payload = (await response.json()) as {
        error?: string;
        errors?: string[];
        game_id?: string;
        badge?: unknown;
        earned_at?: unknown;
      };
      if (!response.ok) {
        setErrors(payload.errors?.length ? payload.errors : [payload.error ?? "Uložení se nezdařilo."]);
        return;
      }
      announceBadgeFromPayload(payload.badge, payload.earned_at);
      setSavedId(payload.game_id ?? "saved");
      setForm(freshForm());
    } catch {
      setErrors(["Uložení se nepodařilo. Zkuste to znovu."]);
    } finally {
      setSaving(false);
    }
  }

  const seatedPlayers = playersInGame(form, catalogs.players);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8 sm:py-10">
      <Link
        href="/pandemic"
        className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
      >
        Zpět na Pandemic
      </Link>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.28em] text-emerald-400/85">
        Pandemic
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Nová hra</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
        Zápis právě odehrané partie. Stejné údaje jako u přepisu skenu, jen bez karty.
      </p>

      <form
        className="mt-8 flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
            Datum, výsledek a režim
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <GameField label="Datum">
              <input
                type="date"
                value={form.played_at ?? ""}
                onChange={(event) => updateForm({ ...form, played_at: event.target.value || null })}
                className={fieldClassName}
              />
            </GameField>
            <GameCodeSelect
              label="Výsledek"
              value={form.result_code}
              options={sortWithPriority(catalogs.gameResults, ["Výhra"])}
              onChange={(result_code) => updateForm({ ...form, result_code })}
            />
            <GameCodeSelect
              label="Obtížnost"
              value={form.difficulty_code}
              options={sortWithPriority(catalogs.difficulties, ["Legendární", "Velmi náročná"])}
              onChange={(difficulty_code) => updateForm({ ...form, difficulty_code })}
            />
            <GameCodeSelect
              label="Režim"
              value={form.game_mode_code}
              options={sortWithPriority(catalogs.gameModes, ["Klasika", "Zhoubný kmen", "Mutace"])}
              onChange={(game_mode_code) =>
                updateForm({
                  ...form,
                  game_mode_code,
                  purple_disease: modeAllowsPurple(game_mode_code) ? form.purple_disease : null,
                  virulent_strain_color: modeAllowsVirulentStrain(game_mode_code)
                    ? form.virulent_strain_color
                    : null,
                })
              }
            />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
            Hráči a role
          </h2>
          <div className="mt-4 space-y-3">
            {form.players.map((player, playerIndex) => (
              <div
                key={`player-${playerIndex}`}
                className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <GamePlayerSelect
                  label={`Hráč ${playerIndex + 1}`}
                  value={player.matched_player_id}
                  players={catalogs.players}
                  onChange={(matched_player_id) => updatePlayer(playerIndex, { matched_player_id })}
                />
                <GameCodeSelect
                  label={`Role ${playerIndex + 1}`}
                  value={player.role_code}
                  options={roleOptionLabels(catalogs.roles)}
                  placeholder="Role"
                  onChange={(role_code) => updatePlayer(playerIndex, { role_code })}
                />
                <button
                  type="button"
                  onClick={() =>
                    updateForm({
                      ...form,
                      players: form.players.filter((_, index) => index !== playerIndex),
                    })
                  }
                  className="h-9 rounded-full border border-white/10 px-3 text-xs font-medium text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
                >
                  Odebrat
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={form.players.length >= 5}
              onClick={() =>
                updateForm({
                  ...form,
                  players: [...form.players, emptyPlayer(form.players.length + 1)],
                })
              }
              className={addRowClassName}
            >
              Přidat hráče
            </button>
            <QuickCreate label="+ Nový hráč" placeholder="Jméno hráče" onCreate={createPlayer} />
            <QuickCreate label="+ Nová role" placeholder="Název role" onCreate={createRole} />
          </div>

          <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
            <h3 className="text-sm font-medium text-zinc-300">Změny rolí</h3>
            {form.role_changes.map((change, changeIndex) => (
              <div
                key={`change-${changeIndex}`}
                className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-3 sm:grid-cols-2"
              >
                <GamePlayerSelect
                  value={change.matched_player_id}
                  players={seatedPlayers}
                  onChange={(matched_player_id) =>
                    updateForm({
                      ...form,
                      role_changes: form.role_changes.map((item, index) =>
                        index === changeIndex ? { ...item, matched_player_id } : item,
                      ),
                    })
                  }
                />
                <GameCodeSelect
                  label="Z role"
                  value={change.from_role_code}
                  options={roleOptionLabels(catalogs.roles)}
                  placeholder="Z role"
                  onChange={(from_role_code) =>
                    updateForm({
                      ...form,
                      role_changes: form.role_changes.map((item, index) =>
                        index === changeIndex ? { ...item, from_role_code } : item,
                      ),
                    })
                  }
                />
                <GameCodeSelect
                  label="Na roli"
                  value={change.to_role_code}
                  options={roleOptionLabels(catalogs.roles)}
                  placeholder="Na roli"
                  onChange={(to_role_code) =>
                    updateForm({
                      ...form,
                      role_changes: form.role_changes.map((item, index) =>
                        index === changeIndex ? { ...item, to_role_code } : item,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    updateForm({
                      ...form,
                      role_changes: form.role_changes.filter((_, index) => index !== changeIndex),
                    })
                  }
                  className="h-9 self-end rounded-full border border-white/10 px-3 text-xs font-medium text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
                >
                  Odebrat změnu
                </button>
              </div>
            ))}
            {form.role_changes.length < 2 ? (
              <button
                type="button"
                onClick={() =>
                  updateForm({
                    ...form,
                    role_changes: [
                      ...form.role_changes,
                      {
                        matched_player_id: null,
                        from_role_code: null,
                        to_role_code: null,
                        change_order: form.role_changes.length + 1,
                      },
                    ],
                  })
                }
                className={addRowClassName}
              >
                Přidat změnu role
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
            Stavy nemocí a kmen
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {diseaseFields.map((disease) => {
              const inactive = disease.key === "purple_disease" && !modeAllowsPurple(form.game_mode_code);
              return (
                <GameCodeSelect
                  key={disease.key}
                  label={disease.label}
                  swatch={disease.dot}
                  optional={inactive}
                  disabled={inactive}
                  value={inactive ? null : form[disease.key]}
                  options={catalogs.diseaseStates}
                  onChange={(value) => updateForm({ ...form, [disease.key]: value })}
                />
              );
            })}
            <GameCodeSelect
              label="Barva kmene"
              optional={!modeAllowsVirulentStrain(form.game_mode_code)}
              disabled={!modeAllowsVirulentStrain(form.game_mode_code)}
              value={modeAllowsVirulentStrain(form.game_mode_code) ? form.virulent_strain_color : null}
              options={catalogs.virulentStrainColors}
              onChange={(virulent_strain_color) => updateForm({ ...form, virulent_strain_color })}
            />
          </div>
          <div className="mt-4">
            <GameField label="Poznámka">
              <textarea
                value={form.note ?? ""}
                rows={3}
                onChange={(event) => updateForm({ ...form, note: event.target.value || null })}
                className={`${fieldClassName} h-auto min-h-20 py-2`}
              />
            </GameField>
          </div>
        </section>

        {savedId ? (
          <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            Partie je uložená.{" "}
            <Link href="/pandemic/statistiky" className="font-medium underline underline-offset-2">
              Otevřít statistiky
            </Link>
          </p>
        ) : null}

        {errors.length > 0 ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <ul className="space-y-1">
              {errors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Ukládám…" : "Uložit partii"}
        </button>
      </form>
    </main>
  );
}

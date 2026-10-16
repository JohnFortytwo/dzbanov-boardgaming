"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CardPreview } from "./card-preview";
import {
  emptyDraftData,
  prepareDraft,
  type CodeLabel,
  type DraftData,
  type DraftGame,
  type DraftPlayer,
  type DraftRoleChange,
  type DraftsResponse,
  type PandemicCatalogs,
  type PlayerOption,
} from "@/lib/pandemic/drafts";

const fieldClassName =
  "scheme-dark h-12 w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 text-sm text-white outline-none ring-emerald-400/40 transition focus:border-emerald-400/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

const emptyCatalogs: PandemicCatalogs = {
  players: [],
  roles: [],
  difficulties: [],
  gameResults: [],
  diseaseStates: [],
  gameModes: [],
  virulentStrainColors: [],
};

const diseases = [
  { key: "yellow_disease", label: "Žlutá", dot: "bg-yellow-400", optional: false },
  { key: "red_disease", label: "Červená", dot: "bg-red-500", optional: false },
  { key: "blue_disease", label: "Modrá", dot: "bg-sky-500", optional: false },
  { key: "black_disease", label: "Černá", dot: "bg-zinc-100", optional: false },
  { key: "purple_disease", label: "Fialová", dot: "bg-purple-500", optional: true },
] as const;

export function TranscriptionWorkspace() {
  const [drafts, setDrafts] = useState<DraftGame[]>([]);
  const [catalogs, setCatalogs] = useState<PandemicCatalogs>(emptyCatalogs);
  const [edits, setEdits] = useState<Record<string, DraftData>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/pandemic/drafts");
        const payload = (await response.json()) as DraftsResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Neschválené hry se nepodařilo načíst.");
        }
        if (cancelled) return;
        setDrafts(payload.drafts ?? []);
        setCatalogs(payload.catalogs ?? emptyCatalogs);
        setIndex(0);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Neschválené hry se nepodařilo načíst.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const draft = drafts[index] ?? null;
  const form = draft ? (edits[draft.id] ?? draft.draft_data) : emptyDraftData();

  function updateForm(next: DraftData) {
    if (!draft) return;
    setEdits((current) => ({ ...current, [draft.id]: next }));
    setFormErrors([]);
    setNotice(null);
  }

  function updatePlayer(playerIndex: number, patch: Partial<DraftPlayer>) {
    const players = form.players.map((player, currentIndex) =>
      currentIndex === playerIndex ? { ...player, ...patch } : player,
    );
    updateForm({ ...form, players });
  }

  function updateRoleChange(changeIndex: number, patch: Partial<DraftRoleChange>) {
    const roleChanges = form.role_changes.map((change, currentIndex) =>
      currentIndex === changeIndex ? { ...change, ...patch } : change,
    );
    updateForm({ ...form, role_changes: roleChanges });
  }

  async function approve() {
    if (!draft || saving) return;
    const prepared = prepareDraft(form);
    if (prepared.errors.length > 0) {
      setFormErrors(prepared.errors);
      setNotice(null);
      return;
    }

    setSaving(true);
    setFormErrors([]);
    setNotice(null);

    try {
      const response = await fetch("/api/pandemic/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, draft_data: prepared.draft }),
      });
      const payload = (await response.json()) as { error?: string; errors?: string[] };
      if (!response.ok) {
        setFormErrors(payload.errors?.length ? payload.errors : [payload.error ?? "Uložení se nezdařilo."]);
        return;
      }

      const nextDrafts = drafts.filter((item) => item.id !== draft.id);
      setDrafts(nextDrafts);
      setEdits((current) => {
        const remaining = { ...current };
        delete remaining[draft.id];
        return remaining;
      });
      setIndex((current) =>
        nextDrafts.length === 0 ? 0 : Math.min(current, nextDrafts.length - 1),
      );
      setNotice("Hra je schválená a uložená v databázi.");
    } catch {
      setFormErrors(["Uložení se nepodařilo. Zkuste to znovu."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 py-6">
      <Link
        href="/pandemic"
        className="mb-4 text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
      >
        Zpět na Pandemic
      </Link>

      <section className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
            Přepis historických her
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {loading
              ? "Načítám hry…"
              : drafts.length === 0
                ? "Žádné hry ke schválení"
                : `Hra ${index + 1} z ${drafts.length}`}
          </h1>
          {draft ? (
            <p className="mt-1 text-xs text-zinc-500">
              Karta {draft.game_order} na skenu
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIndex((current) => Math.max(0, current - 1));
              setFormErrors([]);
              setNotice(null);
            }}
            disabled={!draft || index === 0 || saving}
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Předchozí
          </button>
          <button
            type="button"
            onClick={() => {
              setIndex((current) => Math.min(drafts.length - 1, current + 1));
              setFormErrors([]);
              setNotice(null);
            }}
            disabled={!draft || index >= drafts.length - 1 || saving}
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Další
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={!draft || saving}
            className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Ukládám…" : "Schválit a uložit do databáze"}
          </button>
        </div>
      </section>

      {notice ? (
        <p className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      {loadError ? (
        <article className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-sm text-red-300">
          {loadError}
        </article>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Načítám neschválené drafty…</p>
      ) : null}

      {!loading && !loadError && drafts.length === 0 ? (
        <article className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm leading-6 text-zinc-400 backdrop-blur-xl sm:p-10">
          Všechny naskenované hry jsou schválené. Nové drafty se tady objeví po
          zpracování dalšího A4 skenu.
        </article>
      ) : null}

      {draft ? (
        <div className="grid min-h-0 flex-1 items-stretch gap-6 lg:grid-cols-2">
          <CardPreview
            key={draft.id}
            src={form.card_image_url}
            alt={`Náhled karty hry ${index + 1}`}
          />

          <form
            className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-6 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto"
            onSubmit={(event) => {
              event.preventDefault();
              void approve();
            }}
          >
            {formErrors.length > 0 ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <ul className="space-y-1">
                  {formErrors.map((error, errorIndex) => (
                    <li key={`${errorIndex}-${error}`}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Datum">
                <input
                  type="date"
                  value={form.played_at ?? ""}
                  onChange={(event) =>
                    updateForm({ ...form, played_at: event.target.value || null })
                  }
                  className={fieldClassName}
                />
              </Field>
              <CodeSelect
                label="Výsledek"
                value={form.result_code}
                options={catalogs.gameResults}
                onChange={(result_code) => updateForm({ ...form, result_code })}
              />
              <CodeSelect
                label="Obtížnost"
                value={form.difficulty_code}
                options={catalogs.difficulties}
                onChange={(difficulty_code) => updateForm({ ...form, difficulty_code })}
              />
              <CodeSelect
                label="Režim"
                value={form.game_mode_code}
                options={catalogs.gameModes}
                onChange={(game_mode_code) => updateForm({ ...form, game_mode_code })}
              />
            </div>

            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
                Hráči a role
              </h2>
              {catalogs.players.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Seznam hráčů je prázdný, schválení proto nejde dokončit.
                </p>
              ) : null}
              <div className="space-y-3">
                {form.players.map((player, playerIndex) => (
                  <div
                    key={`${draft.id}-player-${playerIndex}`}
                    className="rounded-2xl border border-white/10 bg-zinc-950/40 p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <PlayerSelect
                        value={player.matched_player_id}
                        players={catalogs.players}
                        onChange={(matched_player_id) =>
                          updatePlayer(playerIndex, { matched_player_id })
                        }
                      />
                      <CodeSelect
                        label="Role"
                        value={player.role_code}
                        options={catalogs.roles}
                        placeholder="Role"
                        onChange={(role_code) => updatePlayer(playerIndex, { role_code })}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateForm({
                            ...form,
                            players: form.players.filter((_, current) => current !== playerIndex),
                          })
                        }
                        className="h-12 self-end rounded-full border border-white/10 px-4 text-xs font-medium text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
                      >
                        Odebrat
                      </button>
                    </div>
                    {player.raw_name ? (
                      <p className="mt-2 text-xs text-zinc-500">Na papíře: {player.raw_name}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={form.players.length >= 5}
                onClick={() =>
                  updateForm({
                    ...form,
                    players: [
                      ...form.players,
                      {
                        raw_name: null,
                        matched_player_id: null,
                        role_code: null,
                        player_order: form.players.length + 1,
                      },
                    ],
                  })
                }
                className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Přidat hráče
              </button>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
                Změny rolí
              </h2>
              {form.role_changes.map((change, changeIndex) => (
                <div
                  key={`${draft.id}-change-${changeIndex}`}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-3 sm:grid-cols-2"
                >
                  <PlayerSelect
                    value={change.matched_player_id}
                    players={playersInGame(form, catalogs.players)}
                    onChange={(matched_player_id) =>
                      updateRoleChange(changeIndex, { matched_player_id })
                    }
                  />
                  <CodeSelect
                    label="Z role"
                    value={change.from_role_code}
                    options={catalogs.roles}
                    placeholder="Z role"
                    onChange={(from_role_code) =>
                      updateRoleChange(changeIndex, { from_role_code })
                    }
                  />
                  <CodeSelect
                    label="Na roli"
                    value={change.to_role_code}
                    options={catalogs.roles}
                    placeholder="Na roli"
                    onChange={(to_role_code) => updateRoleChange(changeIndex, { to_role_code })}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateForm({
                        ...form,
                        role_changes: form.role_changes.filter(
                          (_, current) => current !== changeIndex,
                        ),
                      })
                    }
                    className="h-12 self-end rounded-full border border-white/10 px-4 text-xs font-medium text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
                  >
                    Odebrat změnu
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={form.role_changes.length >= 6}
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
                className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Přidat změnu role
              </button>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
                Stavy nemocí
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {diseases.map((disease) => (
                  <CodeSelect
                    key={disease.key}
                    label={disease.label}
                    swatch={disease.dot}
                    optional={disease.optional}
                    value={form[disease.key]}
                    options={catalogs.diseaseStates}
                    onChange={(value) =>
                      updateForm({ ...form, [disease.key]: value } as DraftData)
                    }
                  />
                ))}
                <CodeSelect
                  label="Barva kmene"
                  optional
                  value={form.virulent_strain_color}
                  options={catalogs.virulentStrainColors}
                  onChange={(virulent_strain_color) =>
                    updateForm({ ...form, virulent_strain_color })
                  }
                />
              </div>
            </section>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function playersInGame(form: DraftData, players: PlayerOption[]) {
  const ids = new Set(
    form.players
      .map((player) => player.matched_player_id)
      .filter((id): id is string => Boolean(id)),
  );
  const selected = players.filter((player) => ids.has(player.id));
  return selected.length > 0 ? selected : players;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-zinc-300">{label}</span>
      {children}
    </label>
  );
}

function withCurrentOption(options: CodeLabel[], current: string | null) {
  if (!current || options.some((option) => option.code === current)) return options;
  return [{ code: current, name_cs: current }, ...options];
}

function CodeSelect({
  label,
  value,
  options,
  onChange,
  optional = false,
  placeholder,
  swatch,
}: {
  label: string;
  value: string | null;
  options: CodeLabel[];
  onChange: (value: string | null) => void;
  optional?: boolean;
  placeholder?: string;
  swatch?: string;
}) {
  const control =
    options.length === 0 ? (
      <input
        value={value ?? ""}
        placeholder={optional ? "Neurčeno" : placeholder ?? "Kód"}
        onChange={(event) => onChange(event.target.value.trim() || null)}
        className={fieldClassName}
      />
    ) : (
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className={fieldClassName}
      >
        <option value="">{optional ? "Neurčeno" : placeholder ?? "Vyberte"}</option>
        {withCurrentOption(options, value).map((option) => (
          <option key={option.code} value={option.code}>
            {option.name_cs}
          </option>
        ))}
      </select>
    );

  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        {swatch ? <span className={`h-2.5 w-2.5 rounded-full ${swatch}`} /> : null}
        {label}
      </span>
      {control}
    </label>
  );
}

function PlayerSelect({
  value,
  players,
  onChange,
}: {
  value: string | null;
  players: PlayerOption[];
  onChange: (value: string | null) => void;
}) {
  const options =
    value && !players.some((player) => player.id === value)
      ? [{ id: value, name: "Neznámý hráč" }, ...players]
      : players;

  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-zinc-300">Hráč</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className={fieldClassName}
      >
        <option value="">Vyberte hráče</option>
        {options.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CardPreview } from "./card-preview";
import { SubCropImage, type CropBox } from "./sub-crop-image";
import {
  emptyDraftData,
  emptyPlayer,
  foldCode,
  modeAllowsPurple,
  modeAllowsVirulentStrain,
  presentDraft,
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
  "scheme-dark h-9 w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-[13px] text-white outline-none ring-emerald-400/40 transition focus:border-emerald-400/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

const skipTab = -1;

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
  { key: "purple_disease", label: "Fialová", dot: "bg-purple-500", optional: false },
] as const;

const cardBoxes = {
  date: { x: 0, y: 0, w: 34, h: 22 },
  outcome: { x: 32, y: 0, w: 68, h: 55 },
  players: { x: 0, y: 20, w: 34, h: 80 },
  diseases: { x: 32, y: 50, w: 68, h: 50 },
} as const satisfies Record<string, CropBox>;

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
  const form = draft
    ? (edits[draft.id] ?? presentDraft(draft.draft_data, catalogs))
    : emptyDraftData();

  function patchForm(recipe: (current: DraftData) => DraftData) {
    if (!draft) return;
    const draftId = draft.id;
    const source = draft.draft_data;
    setEdits((current) => {
      const base = current[draftId] ?? presentDraft(source, catalogs);
      return { ...current, [draftId]: recipe(base) };
    });
    setFormErrors([]);
    setNotice(null);
  }

  function updateForm(next: DraftData) {
    patchForm(() => next);
  }

  function updatePlayer(playerIndex: number, patch: Partial<DraftPlayer>) {
    patchForm((currentForm) => ({
      ...currentForm,
      players: currentForm.players.map((player, currentIndex) =>
        currentIndex === playerIndex ? { ...player, ...patch } : player,
      ),
    }));
  }

  function updateRoleChange(changeIndex: number, patch: Partial<DraftRoleChange>) {
    patchForm((currentForm) => ({
      ...currentForm,
      role_changes: currentForm.role_changes.map((change, currentIndex) =>
        currentIndex === changeIndex ? { ...change, ...patch } : change,
      ),
    }));
  }

  async function createPlayer(name: string) {
    const payload = await postCatalog("/api/pandemic/players", { name });
    const player = payload.player;
    if (!player?.id || !player.name) {
      throw new Error("Hráče se nepodařilo uložit.");
    }
    setCatalogs((current) => ({
      ...current,
      players: sortByName(
        [...current.players.filter((item) => item.id !== player.id), player],
        (item) => item.name,
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
      roles: sortByName(
        [...current.roles.filter((item) => item.code !== role.code), role],
        (item) => item.name_cs,
      ),
    }));
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

      {!draft ? (
        <DraftToolbar
          loading={loading}
          count={drafts.length}
          index={index}
          gameOrder={null}
          saving={saving}
          onPrevious={() => {
            setIndex((current) => Math.max(0, current - 1));
            setFormErrors([]);
            setNotice(null);
          }}
          onNext={() => {
            setIndex((current) => Math.min(drafts.length - 1, current + 1));
            setFormErrors([]);
            setNotice(null);
          }}
          onApprove={() => void approve()}
        />
      ) : null}

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
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void approve();
          }}
        >
          <SectionBlock
            title="Datum"
            src={form.card_image_url}
            box={cardBoxes.date}
            alt={`Datum na kartě hry ${index + 1}`}
          >
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
          </SectionBlock>

          <SectionBlock
            title="Výsledek, obtížnost a režim"
            src={form.card_image_url}
            box={cardBoxes.outcome}
            alt={`Výsledek a obtížnost na kartě hry ${index + 1}`}
          >
            <CodeSelect
              label="Výsledek"
              value={form.result_code}
              options={sortWithPriority(catalogs.gameResults, ["Výhra"])}
              onChange={(result_code) => updateForm({ ...form, result_code })}
            />
            <CodeSelect
              label="Obtížnost"
              value={form.difficulty_code}
              options={sortWithPriority(catalogs.difficulties, ["Legendární", "Velmi náročná"])}
              onChange={(difficulty_code) => updateForm({ ...form, difficulty_code })}
            />
            <CodeSelect
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
          </SectionBlock>

          <SectionBlock
            title="Hráči a role"
            src={form.card_image_url}
            box={cardBoxes.players}
            alt={`Hráči a role na kartě hry ${index + 1}`}
          >
            {catalogs.players.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Seznam hráčů je prázdný. Nového hráče založíte tlačítkem pod seznamem.
              </p>
            ) : null}
            <div className="space-y-3">
              {form.players.map((player, playerIndex) => (
                <div
                  key={`${draft.id}-player-${playerIndex}`}
                  className="rounded-2xl border border-white/10 bg-zinc-950/40 p-3"
                >
                  <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
                    <PlayerSelect
                      label={`Hráč ${playerIndex + 1}`}
                      value={player.matched_player_id}
                      players={catalogs.players || []}
                      onChange={(matched_player_id) =>
                        updatePlayer(playerIndex, { matched_player_id })
                      }
                    />
                    <CodeSelect
                      label={`Role ${playerIndex + 1}`}
                      value={player.role_code}
                      options={roleLabels(catalogs.roles || [])}
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
                      tabIndex={skipTab}
                      className="h-9 self-end rounded-full border border-white/10 px-3 text-xs font-medium text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
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
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={form.players.length >= 5}
                onClick={() =>
                  updateForm({
                    ...form,
                    players: [...form.players, emptyPlayer(form.players.length + 1)],
                  })
                }
                tabIndex={skipTab}
                className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Přidat hráče
              </button>
              <QuickCreate
                label="+ Nový hráč"
                placeholder="Jméno hráče"
                onCreate={createPlayer}
              />
              <QuickCreate
                label="+ Nová role"
                placeholder="Název role"
                onCreate={createRole}
              />
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-sm font-medium text-zinc-300">Změny rolí</h3>
              {form.role_changes.map((change, changeIndex) => (
                <div
                  key={`${draft.id}-change-${changeIndex}`}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-3 sm:grid-cols-2"
                >
                  <PlayerSelect
                    value={change.matched_player_id}
                    players={playersInGame(form, catalogs.players || [])}
                    onChange={(matched_player_id) =>
                      updateRoleChange(changeIndex, { matched_player_id })
                    }
                  />
                  <CodeSelect
                    label="Z role"
                    value={change.from_role_code}
                    options={roleLabels(catalogs.roles || [])}
                    placeholder="Z role"
                    onChange={(from_role_code) =>
                      updateRoleChange(changeIndex, { from_role_code })
                    }
                  />
                  <CodeSelect
                    label="Na roli"
                    value={change.to_role_code}
                    options={roleLabels(catalogs.roles || [])}
                    placeholder="Na roli"
                    onChange={(to_role_code) =>
                      updateRoleChange(changeIndex, { to_role_code })
                    }
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
                    tabIndex={skipTab}
                    className="h-9 self-end rounded-full border border-white/10 px-3 text-xs font-medium text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
                  >
                    Odebrat změnu
                  </button>
                </div>
              ))}
              {form.role_changes.length < 2 ? (
              <button
                type="button"
                tabIndex={skipTab}
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
              ) : null}
            </div>
          </SectionBlock>

          <SectionBlock
            title="Stavy nemocí a kmen"
            src={form.card_image_url}
            box={cardBoxes.diseases}
            alt={`Stavy nemocí na kartě hry ${index + 1}`}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {diseases.map((disease) => {
                const inactive = disease.key === "purple_disease" && !modeAllowsPurple(form.game_mode_code);
                return (
                  <CodeSelect
                    key={disease.key}
                    label={disease.label}
                    swatch={disease.dot}
                    optional={inactive || disease.optional}
                    disabled={inactive}
                    value={inactive ? null : form[disease.key]}
                    options={catalogs.diseaseStates || []}
                    onChange={(value) =>
                      updateForm({ ...form, [disease.key]: value ?? null })
                    }
                  />
                );
              })}
              <CodeSelect
                label="Barva kmene"
                optional={!modeAllowsVirulentStrain(form.game_mode_code)}
                disabled={!modeAllowsVirulentStrain(form.game_mode_code)}
                value={
                  modeAllowsVirulentStrain(form.game_mode_code) ? form.virulent_strain_color : null
                }
                options={catalogs.virulentStrainColors || []}
                onChange={(virulent_strain_color) =>
                  updateForm({ ...form, virulent_strain_color: virulent_strain_color ?? null })
                }
              />
            </div>
            <Field label="Poznámka">
              <textarea
                value={form.note ?? ""}
                rows={3}
                onChange={(event) =>
                  updateForm({ ...form, note: event.target.value || null })
                }
                className={`${fieldClassName} h-auto min-h-20 py-2`}
              />
            </Field>
          </SectionBlock>

          <details className="rounded-3xl border border-white/10 bg-white/5 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl">
            <summary
              tabIndex={skipTab}
              className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-zinc-200 sm:px-6 [&::-webkit-details-marker]:hidden"
            >
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
                Kompletní náhled karty s možností zoomu
              </span>
            </summary>
            <div className="px-5 pb-5 sm:px-6">
              <CardPreview
                key={draft.id}
                src={form.card_image_url}
                alt={`Náhled karty hry ${index + 1}`}
              />
            </div>
          </details>

          {formErrors.length > 0 ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <ul className="space-y-1">
                {formErrors.map((error, errorIndex) => (
                  <li key={`${errorIndex}-${error}`}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <DraftToolbar
            loading={false}
            count={drafts.length}
            index={index}
            gameOrder={draft.game_order}
            saving={saving}
            onPrevious={() => {
              setIndex((current) => Math.max(0, current - 1));
              setFormErrors([]);
              setNotice(null);
            }}
            onNext={() => {
              setIndex((current) => Math.min(drafts.length - 1, current + 1));
              setFormErrors([]);
              setNotice(null);
            }}
            onApprove={() => void approve()}
          />
        </form>
      ) : null}
    </main>
  );
}

function DraftToolbar({
  loading,
  count,
  index,
  gameOrder,
  saving,
  onPrevious,
  onNext,
  onApprove,
}: {
  loading: boolean;
  count: number;
  index: number;
  gameOrder: number | null;
  saving: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onApprove: () => void;
}) {
  const hasDraft = gameOrder !== null;

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
          Přepis historických her
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {loading
            ? "Načítám hry…"
            : count === 0
              ? "Žádné hry ke schválení"
              : `Hra ${index + 1} z ${count}`}
        </h1>
        {hasDraft ? (
          <p className="mt-1 text-xs text-zinc-500">Karta {gameOrder} na skenu</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasDraft || index === 0 || saving}
          tabIndex={skipTab}
          className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Předchozí
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasDraft || index >= count - 1 || saving}
          tabIndex={skipTab}
          className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Další
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={!hasDraft || saving}
          tabIndex={skipTab}
          className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Ukládám…" : "Schválit a uložit do databáze"}
        </button>
      </div>
    </section>
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

async function postCatalog(url: string, body: { name: string }) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload: {
    error?: string;
    player?: PlayerOption;
    role?: CodeLabel;
  };
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

function sortByName<T>(items: T[], label: (item: T) => string) {
  return [...items].sort((left, right) => label(left).localeCompare(label(right), "cs"));
}

function SectionBlock({
  title,
  src,
  box,
  alt,
  children,
}: {
  title: string;
  src: string | null;
  box: CropBox;
  alt: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-5">
      <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">
        {title}
      </h2>
      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">{children}</div>
        <div className="w-3/4 lg:w-full">
          <SubCropImage src={src} box={box} alt={alt} />
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-zinc-300">{label}</span>
      {children}
    </label>
  );
}

function roleLabels(roles: CodeLabel[]): CodeLabel[] {
  return roles.map((role) => ({
    code: role.code,
    name_cs: role.code.toUpperCase(),
  }));
}

function sortWithPriority(options: CodeLabel[] = [], priorityOrder: string[] = []): CodeLabel[] {
  if (!options || options.length === 0) return [];
  const priorityItems: CodeLabel[] = [];

  priorityOrder.forEach((p) => {
    const found = options.find(
      (o) => o.name_cs.toLowerCase() === p.toLowerCase() || o.code.toLowerCase() === p.toLowerCase(),
    );
    if (found && !priorityItems.some((i) => i.code === found.code)) {
      priorityItems.push(found);
    }
  });

  const otherItems = options.filter(
    (o) => !priorityItems.some((i) => i.code === o.code),
  );

  return [...priorityItems, ...otherItems];
}

function withCurrentOption(options: CodeLabel[], current: string | null) {
  if (!current || options.some((option) => option.code === current)) return options;
  return [...options, { code: current, name_cs: current }];
}

function orderCatalog(options: CodeLabel[], priority: string[]) {
  if (priority.length === 0) return options;
  const rank = new Map(priority.map((name, index) => [foldCode(name), index]));
  return [...options].sort((left, right) => {
    const leftRank =
      rank.get(foldCode(left.name_cs)) ?? rank.get(foldCode(left.code)) ?? priority.length;
    const rightRank =
      rank.get(foldCode(right.name_cs)) ?? rank.get(foldCode(right.code)) ?? priority.length;
    return leftRank - rightRank;
  });
}

function CodeSelect({
  label,
  value,
  options,
  onChange,
  optional = false,
  placeholder,
  swatch,
  priority = [],
  disabled = false,
}: {
  label: string;
  value: string | null;
  options: CodeLabel[];
  onChange: (value: string | null) => void;
  optional?: boolean;
  placeholder?: string;
  swatch?: string;
  priority?: string[];
  disabled?: boolean;
}) {
  const selected = value ?? "";
  const ordered = orderCatalog(withCurrentOption(options, selected || null), priority);
  const emptyLabel = optional ? "Neurčeno" : placeholder ?? "Vyberte";
  const emptyFirst = selected === "" || priority.length === 0;
  const control =
    options.length === 0 ? (
      <input
        value={selected}
        disabled={disabled}
        placeholder={emptyLabel}
        onChange={(event) => onChange(event.target.value.trim() || null)}
        className={fieldClassName}
      />
    ) : (
      <select
        value={selected}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className={fieldClassName}
      >
        {emptyFirst ? <option value="">{emptyLabel}</option> : null}
        {ordered.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name_cs}
          </option>
        ))}
        {emptyFirst ? null : <option value="">{emptyLabel}</option>}
      </select>
    );

  return (
    <div className="space-y-1">
      <span className="flex items-center gap-2 text-xs font-medium text-zinc-300">
        {swatch ? <span className={`h-2.5 w-2.5 rounded-full ${swatch}`} /> : null}
        {label}
      </span>
      {control}
    </div>
  );
}

function PlayerSelect({
  label = "Hráč",
  value,
  players,
  onChange,
}: {
  label?: string;
  value: string | null;
  players: PlayerOption[];
  onChange: (value: string | null) => void;
}) {
  const options =
    value && !players.some((player) => player.id === value)
      ? [{ id: value, name: "Neznámý hráč" }, ...players]
      : players;

  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-zinc-300">{label}</span>
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
    </div>
  );
}

function QuickCreate({
  label,
  placeholder,
  onCreate,
}: {
  label: string;
  placeholder: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      await onCreate(trimmed);
      setName("");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Uložení se nezdařilo.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        tabIndex={skipTab}
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center rounded-full border border-emerald-400/30 px-3 text-xs font-medium text-emerald-300 transition hover:border-emerald-400/60 hover:bg-emerald-500/10"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="basis-full space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          autoFocus
          placeholder={placeholder}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          className={`${fieldClassName} min-w-48 flex-1`}
        />
        <button
          type="button"
          tabIndex={skipTab}
          disabled={pending || name.trim().length === 0}
          onClick={() => void submit()}
          className="inline-flex h-9 items-center rounded-full bg-emerald-500 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Přidat"}
        </button>
        <button
          type="button"
          tabIndex={skipTab}
          onClick={() => {
            setOpen(false);
            setError(null);
            setName("");
          }}
          className="inline-flex h-9 items-center rounded-full border border-white/10 px-4 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
        >
          Zrušit
        </button>
      </div>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

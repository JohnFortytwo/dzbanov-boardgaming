"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { foldCode } from "@/lib/pandemic/drafts";
import {
  DEFAULT_RECENT_GAME_LIMIT,
  DEFAULT_STATS_RANGE,
  RECENT_GAME_OPTIONS,
  STATS_RANGE_OPTIONS,
  buildHighlights,
  buildPandemicStats,
  buildTimeline,
  filterStatsSource,
  listNotedGames,
  statsRangeLimit,
  summarizeCrews,
  summarizePlayers,
  summarizeRoles,
  windowSource,
  type ChangeRow,
  type ChangeSideRow,
  type CountRow,
  type DiseaseRow,
  type PandemicStats,
  type PlayerRow,
  type RecentGameLimit,
  type RoleLens,
  type RoleRow,
  type StatsGameFilter,
  type StatsRangeId,
  type StatsSource,
  type TimelineBucket,
} from "@/lib/pandemic/stats";
import { BackupDownload } from "./backup-download";
import { StatsTimelineChart } from "./stats-chart";
import { VoidLatestGame } from "./void-latest-game";

const numberFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
const integerFormat = new Intl.NumberFormat("cs-CZ");
const savedFormat = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "–";
  return `${numberFormat.format(value)}\u00a0%`;
}

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

function rangeDescription(rangeId: StatsRangeId, inRange: number, total: number) {
  if (rangeId === "all") {
    return `Ostatní tabulky počítají celou historii, ${integerFormat.format(total)} platných partií. Úvodní karty se nemění.`;
  }
  const limit = Number(rangeId);
  if (total < limit) {
    return `Ostatní tabulky berou posledních ${integerFormat.format(limit)} odehraných her. V databázi je jich ${integerFormat.format(total)}, takže jde o celou historii.`;
  }
  return `Ostatní tabulky počítají posledních ${integerFormat.format(inRange)} odehraných her podle data partie. Když se datum shoduje, rozhoduje čas uložení. Úvodní karty zůstávají za celou historii.`;
}

const EMPTY_FILTER: StatsGameFilter = { mode: null, difficulty: null, playerCount: null };

const ROLE_LENS_NOTE: Record<RoleLens, string> = {
  any: "Role se počítá, když se ve hře objevila na startu nebo v jakékoli změně.",
  entire: "Jen hry, kde role byla ve startovní sestavě a nikdo z ní neodešel ani na ni nepřišel.",
  from: "Jen hry, ve kterých někdo z téhle role odešel. Úspěšnost je výsledek těch partií.",
  to: "Jen hry, ve kterých někdo na tuhle roli přišel. Úspěšnost je výsledek těch partií.",
};

export function StatsDashboard({ source }: { source: StatsSource }) {
  const [recentLimit, setRecentLimit] = useState<RecentGameLimit>(DEFAULT_RECENT_GAME_LIMIT);
  const [rangeId, setRangeId] = useState<StatsRangeId>(DEFAULT_STATS_RANGE);
  const [roleLens, setRoleLens] = useState<RoleLens>("any");
  const [roleFilter, setRoleFilter] = useState<StatsGameFilter>(EMPTY_FILTER);
  const [playerFilter, setPlayerFilter] = useState<StatsGameFilter>(EMPTY_FILTER);
  const [crewFilter, setCrewFilter] = useState<StatsGameFilter>(EMPTY_FILTER);
  const [timelineFilter, setTimelineFilter] = useState<StatsGameFilter>(EMPTY_FILTER);
  const [roleSort, setRoleSort] = useState<SortState>({ key: "winRate", direction: "desc" });
  const [playerSort, setPlayerSort] = useState<SortState>({ key: "games", direction: "desc" });
  const [changeView, setChangeView] = useState<"pairs" | "from" | "to">("pairs");
  const [changeSort, setChangeSort] = useState<SortState>({ key: "count", direction: "desc" });
  const [showAllChanges, setShowAllChanges] = useState(false);
  const [crewSize, setCrewSize] = useState<2 | 3 | 4>(2);
  const [showAllCrews, setShowAllCrews] = useState(false);
  const [timelineBucket, setTimelineBucket] = useState<TimelineBucket>("month");
  const [timelineMetric, setTimelineMetric] = useState<"games" | "rate">("games");
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [noteOrder, setNoteOrder] = useState<string[] | null>(null);

  const headline = useMemo(() => buildPandemicStats(source), [source]);
  const windowed = useMemo(() => windowSource(source, statsRangeLimit(rangeId)), [source, rangeId]);
  const stats = useMemo(() => buildPandemicStats(windowed, { recentLimit: 0 }), [windowed]);
  const playerCountChoices = useMemo(() => seatCounts(windowed), [windowed]);
  const roleRows = useMemo(
    () => orderRoles(summarizeRoles(filterStatsSource(windowed, roleFilter), roleLens), roleSort),
    [windowed, roleFilter, roleLens, roleSort],
  );
  const playerRows = useMemo(
    () => orderPlayers(summarizePlayers(filterStatsSource(windowed, playerFilter)), playerSort),
    [windowed, playerFilter, playerSort],
  );
  const crews = useMemo(
    () => summarizeCrews(filterStatsSource(windowed, crewFilter), crewSize),
    [windowed, crewFilter, crewSize],
  );
  const timeline = useMemo(
    () => buildTimeline(filterStatsSource(windowed, timelineFilter), timelineBucket),
    [windowed, timelineFilter, timelineBucket],
  );
  const highlights = useMemo(() => buildHighlights(windowed), [windowed]);
  const notedGames = useMemo(() => listNotedGames(windowed), [windowed]);
  useEffect(() => {
    setNoteOrder(shuffleIds(notedGames.map((game) => game.id)));
    setShowAllNotes(false);
  }, [notedGames]);
  const orderedNotes = useMemo(() => {
    if (!noteOrder) return [];
    const byId = new Map(notedGames.map((game) => [game.id, game]));
    return noteOrder.flatMap((id) => {
      const game = byId.get(id);
      return game ? [game] : [];
    });
  }, [noteOrder, notedGames]);
  const visibleNotes = showAllNotes ? orderedNotes : orderedNotes.slice(0, 10);
  const latest = headline.recentGames[0] ?? null;
  const visibleRecent = headline.recentGames.slice(0, recentLimit);
  const frequentCrews = crews.filter((crew) => crew.games >= 2);
  const visibleCrews = showAllCrews ? crews : frequentCrews.slice(0, 12);
  const gaps = [
    headline.missing.result > 0 ? `${headline.missing.result} bez výsledku` : null,
    headline.missing.mode > 0 ? `${headline.missing.mode} bez módu` : null,
    headline.missing.difficulty > 0 ? `${headline.missing.difficulty} bez obtížnosti` : null,
    headline.missing.players > 0 ? `${headline.missing.players} bez hráčů` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 sm:py-10">
      <Link
        href="/pandemic"
        className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
      >
        Zpět na Pandemic
      </Link>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.28em] text-emerald-400/85">
        Pandemic
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Statistiky</h1>
        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-sm text-zinc-500">
            {headline.firstPlayedAt && headline.lastPlayedAt
              ? `${formatDay(headline.firstPlayedAt)} – ${formatDay(headline.lastPlayedAt)}`
              : "Zatím bez dat"}
          </p>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <VoidLatestGame enabled={headline.games > 0} />
            <BackupDownload />
          </div>
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
        Přehled platných partií z databáze. Čísla nahoře jsou za celou historii a
        načítají se při každém otevření, takže sem hned spadne i naposledy uložená
        hra. Tabulky pod posledními partiemi mají vlastní rozsah. Stáhnout zálohu
        uloží všechny partie, včetně neplatných. Smazat poslední partii vyřadí
        naposledy uloženou hru ze statistik.
      </p>

      {headline.games === 0 ? (
        <article className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 text-sm leading-6 text-zinc-400">
          V databázi zatím není žádná platná partie.
        </article>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Odehraných her" value={integerFormat.format(headline.games)} />
            <SummaryCard
              label="Výhry"
              value={formatPercent(headline.winRate)}
              detail={`${integerFormat.format(headline.wins)} z ${integerFormat.format(headline.games)}`}
            />
            <SummaryCard
              label="Hráčů na partii"
              value={
                headline.averagePlayers === null
                  ? "–"
                  : new Intl.NumberFormat("cs-CZ", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(headline.averagePlayers)
              }
              detail={`${integerFormat.format(headline.seats)} obsazení`}
            />
            <SummaryCard
              label="Naposledy uloženo"
              value={latest ? formatDay(latest.playedAt) : "–"}
              detail={latest ? `${latest.result} · ${formatSaved(latest.savedAt)}` : "Žádná hra"}
            />
          </section>

          {gaps.length > 0 ? (
            <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              Ke kontrole přepisu: {gaps.join(", ")}.
            </p>
          ) : null}

          <Section
            title="Naposledy uložené partie"
            note={
              visibleRecent.length < recentLimit
                ? `Uložených partií je ${integerFormat.format(visibleRecent.length)}, takže jsou tu všechny. Řazeno podle času zápisu, ne podle data na kartě.`
                : `Posledních ${integerFormat.format(recentLimit)} platných partií podle času zápisu, ne podle data na kartě.`
            }
            toolbar={
              <ChoicePills
                name="recent-games"
                legend="Zobrazit"
                value={recentLimit}
                options={RECENT_GAME_OPTIONS.map((limit) => ({
                  value: limit,
                  label: `${limit} her`,
                }))}
                onChange={setRecentLimit}
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <Th>Uloženo</Th>
                    <Th>Datum hry</Th>
                    <Th>Výsledek</Th>
                    <Th>Mód</Th>
                    <Th>Obtížnost</Th>
                    <Th>Sestava</Th>
                    <Th>Zapsal</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {visibleRecent.map((game) => (
                    <tr key={game.id}>
                      <Td>{formatSaved(game.savedAt)}</Td>
                      <Td>{formatDay(game.playedAt)}</Td>
                      <Td>{game.result}</Td>
                      <Td>{game.mode}</Td>
                      <Td>{game.difficulty}</Td>
                      <Td>
                        <p>{game.players.map((player) => `${player.name} (${player.role})`).join(", ") || "–"}</p>
                        {game.changes.length > 0 ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            {game.changes
                              .map((change) => `${change.name}: ${change.from} → ${change.to}`)
                              .join("; ")}
                          </p>
                        ) : null}
                        {game.diseases.length > 0 ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            {game.diseases.map((disease) => `${disease.label} ${disease.state}`).join(" · ")}
                            {game.strain ? ` · Kmen ${game.strain}` : ""}
                          </p>
                        ) : game.strain ? (
                          <p className="mt-1 text-xs text-zinc-500">Kmen {game.strain}</p>
                        ) : null}
                        {game.note ? (
                          <p className="mt-1 max-w-md whitespace-pre-wrap text-xs text-zinc-400">{game.note}</p>
                        ) : null}
                      </Td>
                      <Td>
                        <span className="break-all">{game.recordedBy ?? "–"}</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] sm:p-6">
            <ChoicePills
              name="stats-range"
              legend="Rozsah ostatních tabulek"
              tone="heading"
              value={rangeId}
              options={STATS_RANGE_OPTIONS.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              onChange={setRangeId}
            />
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
              {rangeDescription(rangeId, stats.games, headline.games)}
            </p>
          </section>

          <Section
            title="Módy a obtížnosti"
            note="V buňce je počet her a jeho podíl na řádku. U součtu řádku je podíl ze všech her v tabulce. Nula znamená, že tahle dvojice ve zvoleném rozsahu není."
          >
            <Matrix stats={stats} />
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Úspěšnost podle módu">
              <BreakdownTable rows={stats.modes} label="Mód" />
            </Section>
            <Section title="Jak partie končí">
              <BreakdownTable
                rows={stats.results}
                label="Výsledek"
                showWins={false}
                showWinRate={false}
              />
            </Section>
          </div>

          <Section
            title="Oblíbené kombinace"
            note="Jen legendární klasika, velmi náročný zhoubný kmen a velmi náročná mutace. Podíl je ze všech her ve zvoleném rozsahu."
          >
            <BreakdownTable rows={stats.favorites} label="Kombinace" keepEmpty />
          </Section>

          <Section
            title="Role"
            note={`${ROLE_LENS_NOTE[roleLens]} Aktivní role zůstávají nad těmi, které už se nehrají, a řazení platí v každé skupině zvlášť.`}
          >
            <div className="flex flex-col gap-4">
              <ChoicePills
                name="role-lens"
                legend="Které hry počítat"
                value={roleLens}
                options={[
                  { value: "entire", label: "Celá hra" },
                  { value: "any", label: "Včetně změn" },
                  { value: "from", label: "Jen z role" },
                  { value: "to", label: "Jen na roli" },
                ]}
                onChange={setRoleLens}
              />
              <GameFilters
                source={windowed}
                playerCounts={playerCountChoices}
                value={roleFilter}
                onChange={setRoleFilter}
              />
              <RoleTable rows={roleRows} sort={roleSort} onSort={setRoleSort} />
            </div>
          </Section>

          <Section
            title="Hráči"
            note="Úspěšnost je podíl výher v partiích zvoleného rozsahu a filtrů, kterých se hráč zúčastnil. Nejčastější start je role, se kterou do těch her nejčastěji nastupoval."
          >
            <div className="flex flex-col gap-4">
              <GameFilters
                source={windowed}
                playerCounts={playerCountChoices}
                value={playerFilter}
                onChange={setPlayerFilter}
              />
              <PlayerTable rows={playerRows} sort={playerSort} onSort={setPlayerSort} />
            </div>
          </Section>

          <Section
            title="Podle počtu hráčů"
            note="Úspěšnost partií podle toho, kolik hráčů u stolu sedělo."
          >
            <BreakdownTable rows={stats.playerCounts} label="Počet hráčů" />
          </Section>

          <Section
            title="Nejčastější sestavy"
            note="Sestava je sada jmen. Pořadí u stolu nerozhoduje. Výchozí pohled ukazuje sestavy, které spolu hrály aspoň dvakrát."
          >
            <div className="flex flex-col gap-4">
              <ChoicePills
                name="crew-size"
                legend="Velikost stolu"
                value={crewSize}
                options={[
                  { value: 2, label: "Dvojice" },
                  { value: 3, label: "Trojice" },
                  { value: 4, label: "Čtveřice" },
                ]}
                onChange={(size) => {
                  setCrewSize(size);
                  setShowAllCrews(false);
                }}
              />
              <GameFilters
                source={windowed}
                playerCounts={[]}
                value={crewFilter}
                onChange={setCrewFilter}
                hidePlayerCount
              />
              <CrewTable rows={visibleCrews} />
              {crews.length > visibleCrews.length ? (
                <button
                  type="button"
                  onClick={() => setShowAllCrews(true)}
                  className="self-start rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
                >
                  Zobrazit všech {integerFormat.format(crews.length)} sestav
                </button>
              ) : showAllCrews && frequentCrews.length < crews.length ? (
                <button
                  type="button"
                  onClick={() => setShowAllCrews(false)}
                  className="self-start rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
                >
                  Jen sestavy s aspoň dvěma hrami
                </button>
              ) : null}
            </div>
          </Section>

          <Section
            title="Stavy nemocí"
            note="Fialová se počítá jen z her, kde je její stav vyplněný. Ostatní barvy z partií ve zvoleném rozsahu, které mají záznam."
          >
            <DiseaseTable rows={stats.diseases} />
            {stats.strainColors.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-zinc-300">Barva zhoubného kmene</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Vyplněno u {integerFormat.format(stats.strainGames)}{" "}
                  {stats.strainGames === 1 ? "hry" : "her"}.
                </p>
                <div className="mt-3">
                  <BreakdownTable rows={stats.strainColors} label="Barva" />
                </div>
              </div>
            ) : null}
          </Section>

          <Section
            title="Změny rolí"
            note={`${integerFormat.format(stats.gamesWithRoleChange)} her má aspoň jednu změnu, celkem ${integerFormat.format(stats.roleChanges)} přechodů. Beze změny ${integerFormat.format(stats.roleChangeDepth.none)}, jedna změna ${integerFormat.format(stats.roleChangeDepth.one)}, dvě a víc ${integerFormat.format(stats.roleChangeDepth.twoOrMore)}. Úspěšnost je podíl výher v partiích, kde k dané změně došlo.`}
          >
            <div className="flex flex-col gap-4">
              <ChoicePills
                name="change-view"
                legend="Pohled"
                value={changeView}
                options={[
                  { value: "pairs", label: "Přechody" },
                  { value: "from", label: "Z role" },
                  { value: "to", label: "Na roli" },
                ]}
                onChange={(view) => {
                  setChangeView(view);
                  setChangeSort({ key: "count", direction: "desc" });
                  setShowAllChanges(false);
                }}
              />
              <p className="text-sm leading-6 text-zinc-500">
                {changeView === "from"
                  ? "Součet odchodů z role, bez ohledu na to, kam hráč přešel."
                  : changeView === "to"
                    ? "Součet příchodů na roli, bez ohledu na to, odkud hráč přišel."
                    : "Každý řádek je jeden konkrétní přechod z role na roli."}
              </p>
              <ChangeTable
                stats={stats}
                view={changeView}
                sort={changeSort}
                showAll={showAllChanges}
                onSort={setChangeSort}
              />
              {changeView === "pairs" && stats.roleChangePairs.length > 15 ? (
                <button
                  type="button"
                  onClick={() => setShowAllChanges((current) => !current)}
                  className="self-start rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
                >
                  {showAllChanges
                    ? "Jen 15 přechodů"
                    : `Zobrazit všech ${integerFormat.format(stats.roleChangePairs.length)} přechodů`}
                </button>
              ) : null}
            </div>
          </Section>

          <Section
            title="Historie partií"
            note="Sloupce jsou počty her podle data partie. Prázdné měsíce mezi první a poslední hrou v grafu zůstávají, ať je vidět, kdy se nehrálo."
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <ChoicePills
                  name="timeline-bucket"
                  legend="Krok"
                  value={timelineBucket}
                  options={[
                    { value: "month", label: "Měsíce" },
                    { value: "year", label: "Roky" },
                  ]}
                  onChange={setTimelineBucket}
                />
                <ChoicePills
                  name="timeline-metric"
                  legend="Výška sloupce"
                  value={timelineMetric}
                  options={[
                    { value: "games", label: "Počet her" },
                    { value: "rate", label: "Úspěšnost" },
                  ]}
                  onChange={setTimelineMetric}
                />
              </div>
              <GameFilters
                source={windowed}
                playerCounts={playerCountChoices}
                value={timelineFilter}
                onChange={setTimelineFilter}
              />
              <StatsTimelineChart
                points={timeline.points}
                undated={timeline.undated}
                metric={timelineMetric}
              />
            </div>
          </Section>

          <Section
            title="Zajímavosti"
            note="Vybrané rekordy ze stejného rozsahu jako tabulky nad nimi."
          >
            {highlights.length === 0 ? (
              <p className="text-sm text-zinc-500">V tomhle rozsahu ještě není z čeho skládat rekordy.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {highlights.map((highlight) => (
                  <SummaryCard
                    key={highlight.id}
                    label={highlight.label}
                    value={highlight.value}
                    detail={highlight.detail}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Poznámky"
            note={notesSectionNote(notedGames.length)}
          >
            {notedGames.length === 0 ? (
              <p className="text-sm text-zinc-500">Až u nějaké hry poznámka bude, objeví se tady.</p>
            ) : noteOrder === null ? (
              <p className="text-sm text-zinc-500">Vybírám náhodné poznámky…</p>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleNotes.map((game) => (
                  <article
                    key={game.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-400/80">
                      {formatDay(game.playedAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-100">{game.note}</p>
                    {game.summary ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{game.summary}</p>
                    ) : null}
                  </article>
                ))}
                {notedGames.length > 10 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllNotes((current) => !current)}
                    className="self-start rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
                  >
                    {showAllNotes
                      ? "Jen náhodných 10"
                      : `Zobrazit ${noteCountPhrase(notedGames.length, true)}`}
                  </button>
                ) : null}
              </div>
            )}
          </Section>
        </div>
      )}
    </main>
  );
}

function notesSectionNote(count: number) {
  if (count === 0) return "Ve zvoleném rozsahu není žádná partie s vyplněnou poznámkou.";
  if (count === 1) {
    return "Ve zvoleném rozsahu je jen jedna poznámka. Při načtení stránky se nic nemění, není z čeho losovat.";
  }
  if (count <= 10) {
    return `Ve zvoleném rozsahu je ${noteCountPhrase(count)}, takže jsou tu všechny. Pořadí je náhodné a při načtení stránky se mění.`;
  }
  return `Náhodných 10 z ${integerFormat.format(count)} partií ve zvoleném rozsahu, které mají vyplněnou poznámku. Pořadí se při načtení stránky mění.`;
}

function noteCountPhrase(count: number, all = false) {
  if (count === 1) return all ? "jedinou poznámku" : "1 poznámka";
  if (count >= 2 && count <= 4) {
    return all ? `všechny ${integerFormat.format(count)} poznámky` : `${integerFormat.format(count)} poznámky`;
  }
  return all
    ? `všech ${integerFormat.format(count)} poznámek`
    : `${integerFormat.format(count)} poznámek`;
}

function shuffleIds(ids: string[]) {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swap] ?? current;
    next[swap] = current;
  }
  return next;
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-400/85">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-zinc-500">{detail}</p> : null}
    </article>
  );
}

function ChoicePills<T extends string | number>({
  name,
  legend,
  value,
  options,
  onChange,
  tone = "label",
}: {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  tone?: "label" | "heading";
}) {
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <fieldset>
        <legend
          className={
            tone === "heading"
              ? "text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85"
              : "text-xs font-medium uppercase tracking-[0.18em] text-zinc-500"
          }
        >
          {legend}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => {
            const checked = option.value === value;
            return (
              <label
                key={String(option.value)}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-400/70 ${
                  checked
                    ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  value={String(option.value)}
                  checked={checked}
                  onChange={() => onChange(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>
    </form>
  );
}

function Section({
  title,
  note,
  toolbar,
  children,
}: {
  title: string;
  note?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">{title}</h2>
          {note ? <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{note}</p> : null}
        </div>
        {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Matrix({ stats }: { stats: PandemicStats }) {
  const { modes, difficulties, counts } = stats.modeDifficulty;
  const columnTotals = difficulties.map((_, index) =>
    counts.reduce((sum, row) => sum + (row[index] ?? 0), 0),
  );
  const grand = columnTotals.reduce((sum, value) => sum + value, 0);

  if (modes.length === 0 || difficulties.length === 0) {
    return <p className="text-sm text-zinc-500">Módy nebo obtížnosti v datech chybí.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>Mód</Th>
            {difficulties.map((difficulty) => (
              <Th key={difficulty.key} align="right">
                {difficulty.label}
              </Th>
            ))}
            <Th align="right">Celkem</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {modes.map((mode, rowIndex) => {
            const row = counts[rowIndex] ?? [];
            const total = row.reduce((sum, value) => sum + value, 0);
            return (
              <tr key={mode.key}>
                <Td>{mode.label}</Td>
                {row.map((value, columnIndex) => (
                  <Td key={difficulties[columnIndex]?.key ?? columnIndex} align="right" muted={value === 0}>
                    <CountShare count={value} whole={total} />
                  </Td>
                ))}
                <Td align="right">
                  <CountShare count={total} whole={grand} />
                </Td>
              </tr>
            );
          })}
          <tr>
            <Td>Celkem</Td>
            {columnTotals.map((value, index) => (
              <Td key={difficulties[index]?.key ?? index} align="right">
                <CountShare count={value} whole={grand} />
              </Td>
            ))}
            <Td align="right">
              <CountShare count={grand} whole={grand} />
            </Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BreakdownTable({
  rows,
  label,
  showWins = true,
  showWinRate = true,
  keepEmpty = false,
}: {
  rows: CountRow[];
  label: string;
  showWins?: boolean;
  showWinRate?: boolean;
  keepEmpty?: boolean;
}) {
  const visible = keepEmpty ? rows : rows.filter((row) => row.games > 0);
  if (visible.length === 0) {
    return <p className="text-sm text-zinc-500">Zatím nic k zobrazení.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>{label}</Th>
            <Th align="right">Her</Th>
            <Th align="right">Podíl</Th>
            {showWins ? <Th align="right">Výher</Th> : null}
            {showWinRate ? <Th align="right">Úspěšnost</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {visible.map((row) => (
            <tr key={row.key}>
              <Td>{row.label}</Td>
              <Td align="right">{integerFormat.format(row.games)}</Td>
              <Td align="right">{formatPercent(row.share)}</Td>
              {showWins ? <Td align="right">{integerFormat.format(row.wins)}</Td> : null}
              {showWinRate ? <Td align="right">{formatPercent(row.winRate)}</Td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleTable({
  rows,
  sort,
  onSort,
}: {
  rows: RoleRow[];
  sort: SortState;
  onSort: (sort: SortState) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">V tomhle filtru zatím žádná role.</p>;
  }
  const splitAt = rows.findIndex((row) => row.retired);
  const active = splitAt === -1 ? rows : rows.slice(0, splitAt);
  const retired = splitAt === -1 ? [] : rows.slice(splitAt);
  const columns: { key: string; label: string; align?: "left" | "right"; numeric?: boolean }[] = [
    { key: "label", label: "Role", numeric: false },
    { key: "games", label: "Her", align: "right" },
    { key: "share", label: "Podíl her", align: "right" },
    { key: "starts", label: "Startů", align: "right" },
    { key: "arrivals", label: "Příchodů", align: "right" },
    { key: "departures", label: "Odchodů", align: "right" },
    { key: "winRate", label: "Úspěšnost", align: "right" },
  ];

  function renderRow(row: RoleRow) {
    return (
      <tr key={row.key}>
        <Td>{row.label}</Td>
        <Td align="right">{integerFormat.format(row.games)}</Td>
        <Td align="right">{formatPercent(row.share)}</Td>
        <Td align="right">{integerFormat.format(row.starts)}</Td>
        <Td align="right">{integerFormat.format(row.arrivals)}</Td>
        <Td align="right">{integerFormat.format(row.departures)}</Td>
        <Td align="right">{formatPercent(row.winRate)}</Td>
      </tr>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            {columns.map((column) => (
              <SortHeader
                key={column.key}
                label={column.label}
                sortKey={column.key}
                sort={sort}
                onSort={onSort}
                align={column.align}
                numeric={column.numeric}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {active.map(renderRow)}
          {retired.length > 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                Už se nehraje
              </td>
            </tr>
          ) : null}
          {retired.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}

function PlayerTable({
  rows,
  sort,
  onSort,
}: {
  rows: PlayerRow[];
  sort: SortState;
  onSort: (sort: SortState) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">V tomhle filtru zatím žádný hráč.</p>;
  }
  const columns: { key: string; label: string; align?: "left" | "right"; numeric?: boolean }[] = [
    { key: "label", label: "Hráč", numeric: false },
    { key: "games", label: "Her", align: "right" },
    { key: "wins", label: "Výher", align: "right" },
    { key: "winRate", label: "Úspěšnost", align: "right" },
    { key: "topRole", label: "Nejčastější start", numeric: false },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            {columns.map((column) => (
              <SortHeader
                key={column.key}
                label={column.label}
                sortKey={column.key}
                sort={sort}
                onSort={onSort}
                align={column.align}
                numeric={column.numeric}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((player) => (
            <tr key={player.key}>
              <Td>{player.label}</Td>
              <Td align="right">{integerFormat.format(player.games)}</Td>
              <Td align="right">{integerFormat.format(player.wins)}</Td>
              <Td align="right">{formatPercent(player.winRate)}</Td>
              <Td>{player.topRole ?? "–"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CrewTable({ rows }: { rows: { key: string; label: string; games: number; wins: number; winRate: number | null }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">V tomhle filtru zatím žádná sestava s aspoň dvěma hrami.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>Sestava</Th>
            <Th align="right">Her</Th>
            <Th align="right">Výher</Th>
            <Th align="right">Úspěšnost</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => (
            <tr key={row.key}>
              <Td>{row.label}</Td>
              <Td align="right">{integerFormat.format(row.games)}</Td>
              <Td align="right">{integerFormat.format(row.wins)}</Td>
              <Td align="right">{formatPercent(row.winRate)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiseaseTable({ rows }: { rows: DiseaseRow[] }) {
  const states = rows[0]?.states ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>Nemoc</Th>
            {states.map((state) => (
              <Th key={state.key} align="right">
                {state.label}
              </Th>
            ))}
            <Th align="right">Her se záznamem</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => (
            <tr key={row.key}>
              <Td>{row.label}</Td>
              {row.states.map((state) => (
                <Td key={state.key} align="right">
                  {integerFormat.format(state.count)}
                  <span className="ml-2 text-xs text-zinc-500">{formatPercent(state.share)}</span>
                </Td>
              ))}
              <Td align="right">{integerFormat.format(row.total)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeTable({
  stats,
  view,
  sort,
  showAll,
  onSort,
}: {
  stats: PandemicStats;
  view: "pairs" | "from" | "to";
  sort: SortState;
  showAll: boolean;
  onSort: (sort: SortState) => void;
}) {
  if (view === "pairs") {
    const rows = orderChanges(stats.roleChangePairs, sort);
    const visible = showAll ? rows : rows.slice(0, 15);
    if (visible.length === 0) return <p className="text-sm text-zinc-500">Zatím žádná změna role.</p>;
    return (
      <ChangeGrid
        rows={visible}
        sort={sort}
        onSort={onSort}
        columns={[
          { key: "from", label: "Z role", numeric: false },
          { key: "to", label: "Na roli", numeric: false },
          { key: "count", label: "Počet", align: "right" },
          { key: "share", label: "Podíl změn", align: "right" },
          { key: "games", label: "Her", align: "right" },
          { key: "winRate", label: "Úspěšnost", align: "right" },
        ]}
        render={(row: ChangeRow) => (
          <>
            <Td>{row.from}</Td>
            <Td>{row.to}</Td>
            <Td align="right">{integerFormat.format(row.count)}</Td>
            <Td align="right">{formatPercent(row.share)}</Td>
            <Td align="right">{integerFormat.format(row.games)}</Td>
            <Td align="right">{formatPercent(row.winRate)}</Td>
          </>
        )}
      />
    );
  }

  const sideRows = orderChanges(view === "from" ? stats.roleChangeFrom : stats.roleChangeTo, sort);
  if (sideRows.length === 0) return <p className="text-sm text-zinc-500">Zatím žádná změna role.</p>;
  return (
    <ChangeGrid
      rows={sideRows}
      sort={sort}
      onSort={onSort}
      columns={[
        { key: "label", label: view === "from" ? "Z role" : "Na roli", numeric: false },
        { key: "count", label: view === "from" ? "Odchodů" : "Příchodů", align: "right" },
        { key: "share", label: "Podíl změn", align: "right" },
        { key: "games", label: "Her", align: "right" },
        { key: "winRate", label: "Úspěšnost", align: "right" },
      ]}
      render={(row: ChangeSideRow) => (
        <>
          <Td>{row.label}</Td>
          <Td align="right">{integerFormat.format(row.count)}</Td>
          <Td align="right">{formatPercent(row.share)}</Td>
          <Td align="right">{integerFormat.format(row.games)}</Td>
          <Td align="right">{formatPercent(row.winRate)}</Td>
        </>
      )}
    />
  );
}

function ChangeGrid<T extends { key: string }>({
  rows,
  columns,
  sort,
  onSort,
  render,
}: {
  rows: T[];
  columns: { key: string; label: string; align?: "left" | "right"; numeric?: boolean }[];
  sort: SortState;
  onSort: (sort: SortState) => void;
  render: (row: T) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            {columns.map((column) => (
              <SortHeader
                key={column.key}
                label={column.label}
                sortKey={column.key}
                sort={sort}
                onSort={onSort}
                align={column.align}
                numeric={column.numeric}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => (
            <tr key={row.key}>{render(row)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  muted = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2.5 align-top ${align === "right" ? "text-right tabular-nums whitespace-nowrap" : "text-left"} ${
        muted ? "text-zinc-600" : "text-zinc-200"
      }`}
    >
      {children}
    </td>
  );
}

type SortState = { key: string; direction: "asc" | "desc" };

const DIFFICULTY_RANK = ["jednoducha", "stredne narocna", "velmi narocna", "legendarni"];
const MODE_RANK = ["klasika", "zhoubny kmen", "mutace", "worldwide m.", "laborator", "bioterorista", "combo"];

function seatCounts(source: StatsSource) {
  const counts = new Map<string, number>();
  for (const seat of source.seats) counts.set(seat.game_id, (counts.get(seat.game_id) ?? 0) + 1);
  return [...new Set(counts.values())].filter((count) => count > 0).sort((left, right) => left - right);
}

function playerCountOption(count: number) {
  if (count === 1) return "1 hráč";
  if (count >= 2 && count <= 4) return `${count} hráči`;
  return `${count} hráčů`;
}

function toggleSort(current: SortState, key: string, numeric: boolean): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: numeric ? "desc" : "asc" };
}

function compareValues(
  left: string | number | null,
  right: string | number | null,
  direction: SortState["direction"],
) {
  const leftMissing = left === null || left === "";
  const rightMissing = right === null || right === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  const result =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), "cs");
  return direction === "asc" ? result : -result;
}

function roleValue(row: RoleRow, key: string): string | number | null {
  if (key === "label") return row.label;
  if (key === "games") return row.games;
  if (key === "share") return row.share;
  if (key === "starts") return row.starts;
  if (key === "arrivals") return row.arrivals;
  if (key === "departures") return row.departures;
  if (key === "winRate") return row.winRate;
  return null;
}

function orderRoles(rows: RoleRow[], sort: SortState) {
  const visible = rows.filter(
    (row) => row.games > 0 || row.starts > 0 || row.arrivals > 0 || row.departures > 0,
  );
  const compare = (left: RoleRow, right: RoleRow) =>
    compareValues(roleValue(left, sort.key), roleValue(right, sort.key), sort.direction) ||
    left.label.localeCompare(right.label, "cs");
  return [
    ...visible.filter((row) => !row.retired).sort(compare),
    ...visible.filter((row) => row.retired).sort(compare),
  ];
}

function orderPlayers(rows: PlayerRow[], sort: SortState) {
  const compare = (left: PlayerRow, right: PlayerRow) =>
    compareValues(
      sort.key === "label"
        ? left.label
        : sort.key === "topRole"
          ? left.topRole
          : sort.key === "wins"
            ? left.wins
            : sort.key === "winRate"
              ? left.winRate
              : left.games,
      sort.key === "label"
        ? right.label
        : sort.key === "topRole"
          ? right.topRole
          : sort.key === "wins"
            ? right.wins
            : sort.key === "winRate"
              ? right.winRate
              : right.games,
      sort.direction,
    ) || left.label.localeCompare(right.label, "cs");
  return [...rows].sort(compare);
}

function orderChanges<T extends ChangeRow | ChangeSideRow>(rows: T[], sort: SortState) {
  return [...rows].sort((left, right) => {
    const leftValue = changeValue(left, sort.key);
    const rightValue = changeValue(right, sort.key);
    return compareValues(leftValue, rightValue, sort.direction);
  });
}

function changeValue(row: ChangeRow | ChangeSideRow, key: string): string | number | null {
  if (key === "from" && "from" in row) return row.from;
  if (key === "to" && "to" in row) return row.to;
  if (key === "label" && "label" in row) return row.label;
  if (key === "count") return row.count;
  if (key === "games") return row.games;
  if (key === "share") return row.share;
  if (key === "winRate") return row.winRate;
  return null;
}

function CountShare({ count, whole }: { count: number; whole: number }) {
  return (
    <>
      {integerFormat.format(count)}
      {whole > 0 ? (
        <span className="ml-2 text-xs text-zinc-500">{formatPercent((count / whole) * 100)}</span>
      ) : null}
    </>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  numeric = true,
}: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (sort: SortState) => void;
  align?: "left" | "right";
  numeric?: boolean;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(toggleSort(sort, sortKey, numeric))}
        className={`inline-flex items-center gap-1 uppercase tracking-wider ${
          align === "right" ? "w-full justify-end" : ""
        }`}
      >
        {label}
        <span aria-hidden="true" className={active ? "text-emerald-300" : "text-zinc-600"}>
          {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function GameFilters({
  source,
  playerCounts,
  value,
  onChange,
  hidePlayerCount = false,
}: {
  source: StatsSource;
  playerCounts: number[];
  value: StatsGameFilter;
  onChange: (value: StatsGameFilter) => void;
  hidePlayerCount?: boolean;
}) {
  const modes = catalogOptions(
    source.modes,
    source.games.map((game) => game.game_mode_code),
    MODE_RANK,
  );
  const difficulties = catalogOptions(
    source.difficulties,
    source.games.map((game) => game.difficulty_code),
    DIFFICULTY_RANK,
  );
  const active = Boolean(value.mode || value.difficulty || value.playerCount);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Mód"
        value={value.mode ?? ""}
        onChange={(mode) => onChange({ ...value, mode: mode || null })}
        options={[{ value: "", label: "Všechny módy" }, ...modes.map((mode) => ({ value: mode.code, label: mode.name }))]}
      />
      <FilterSelect
        label="Obtížnost"
        value={value.difficulty ?? ""}
        onChange={(difficulty) => onChange({ ...value, difficulty: difficulty || null })}
        options={[
          { value: "", label: "Všechny obtížnosti" },
          ...difficulties.map((difficulty) => ({ value: difficulty.code, label: difficulty.name })),
        ]}
      />
      {hidePlayerCount ? null : (
        <FilterSelect
          label="Počet hráčů"
          value={value.playerCount == null ? "" : String(value.playerCount)}
          onChange={(count) => onChange({ ...value, playerCount: count ? Number(count) : null })}
          options={[
            { value: "", label: "Libovolně" },
            ...playerCounts.map((count) => ({ value: String(count), label: playerCountOption(count) })),
          ]}
        />
      )}
      {active ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTER)}
          className="h-9 rounded-full border border-white/10 px-3 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white"
        >
          Zrušit filtry
        </button>
      ) : null}
    </div>
  );
}

function catalogOptions(
  catalog: { code: string; name_cs: string }[],
  values: (string | null)[],
  order: string[],
) {
  const byFold = new Map<string, { code: string; name: string }>();
  for (const row of catalog) {
    const code = row.code.trim();
    if (!code) continue;
    const folded = foldCode(code);
    if (!byFold.has(folded)) byFold.set(folded, { code, name: row.name_cs.trim() || code });
  }
  for (const value of values) {
    const code = value?.trim();
    if (!code) continue;
    const folded = foldCode(code);
    if (byFold.has(folded)) continue;
    byFold.set(folded, { code, name: code });
  }
  return [...byFold.values()].sort(
    (left, right) => rankOf(left.code, order) - rankOf(right.code, order) || left.name.localeCompare(right.name, "cs"),
  );
}

function rankOf(code: string, order: string[]) {
  const folded = foldCode(code);
  const index = order.findIndex((item) => folded === item || folded.startsWith(item));
  return index === -1 ? order.length : index;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  function placeMenu() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > spaceBelow;
    setMenuStyle(
      openUp
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
        : { top: rect.bottom + 4, left: rect.left, width: rect.width },
    );
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onMove() {
      placeMenu();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col gap-1 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500"
    >
      <span>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        ref={buttonRef}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          placeMenu();
          setOpen(true);
        }}
        className="flex h-9 min-w-40 items-center justify-between gap-3 rounded-full border border-white/10 bg-zinc-950 px-3 text-left text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none focus:border-emerald-400/60"
      >
        <span className="truncate">{selected?.label}</span>
        <span aria-hidden="true" className="text-[10px] text-zinc-400">
          ▾
        </span>
      </button>
      {open && menuStyle ? (
        <ul
          role="listbox"
          aria-label={label}
          style={{
            position: "fixed",
            top: menuStyle.top,
            bottom: menuStyle.bottom,
            left: menuStyle.left,
            width: Math.max(menuStyle.width, 160),
            zIndex: 50,
          }}
          className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-zinc-950 py-1 shadow-2xl"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value || "all"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm font-normal normal-case tracking-normal ${
                    active ? "bg-sky-600 text-white" : "text-zinc-100 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

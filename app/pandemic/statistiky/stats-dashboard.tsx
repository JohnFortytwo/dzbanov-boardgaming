import type { ReactNode } from "react";
import Link from "next/link";
import type { CountRow, DiseaseRow, PandemicStats, RoleRow } from "@/lib/pandemic/stats";

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
  return `${numberFormat.format(value)} %`;
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

export function StatsDashboard({ stats }: { stats: PandemicStats }) {
  const latest = stats.recentGames[0] ?? null;
  const gaps = [
    stats.missing.result > 0 ? `${stats.missing.result} bez výsledku` : null,
    stats.missing.mode > 0 ? `${stats.missing.mode} bez módu` : null,
    stats.missing.difficulty > 0 ? `${stats.missing.difficulty} bez obtížnosti` : null,
    stats.missing.players > 0 ? `${stats.missing.players} bez hráčů` : null,
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
        <p className="text-sm text-zinc-500">
          {stats.firstPlayedAt && stats.lastPlayedAt
            ? `${formatDay(stats.firstPlayedAt)} – ${formatDay(stats.lastPlayedAt)}`
            : "Zatím bez dat"}
        </p>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
        Přehled schválených partií z databáze. Čísla se načítají při každém otevření,
        takže sem hned spadne i naposledy uložená hra.
      </p>

      {stats.games === 0 ? (
        <article className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 text-sm leading-6 text-zinc-400">
          V databázi zatím není žádná schválená partie.
        </article>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Odehraných her" value={integerFormat.format(stats.games)} />
            <SummaryCard
              label="Výhry"
              value={formatPercent(stats.winRate)}
              detail={`${integerFormat.format(stats.wins)} z ${integerFormat.format(stats.games)}`}
            />
            <SummaryCard
              label="Hráčů na partii"
              value={
                stats.averagePlayers === null
                  ? "–"
                  : new Intl.NumberFormat("cs-CZ", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(stats.averagePlayers)
              }
              detail={`${integerFormat.format(stats.seats)} obsazení`}
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
            note="Seřazeno podle času zápisu do databáze, ne podle data na kartě."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <Th>Uloženo</Th>
                    <Th>Datum hry</Th>
                    <Th>Výsledek</Th>
                    <Th>Mód</Th>
                    <Th>Obtížnost</Th>
                    <Th>Sestava</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {stats.recentGames.map((game) => (
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
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Módy a obtížnosti"
            note="Počet partií v každé kombinaci. Nula znamená, že tahle dvojice v datech zatím není."
          >
            <Matrix stats={stats} />
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Úspěšnost podle módu">
              <BreakdownTable rows={stats.modes} label="Mód" />
            </Section>
            <Section title="Úspěšnost podle obtížnosti">
              <BreakdownTable rows={stats.difficulties} label="Obtížnost" />
            </Section>
          </div>

          <Section title="Jak partie končí">
            <BreakdownTable rows={stats.results} label="Výsledek" />
          </Section>

          <Section
            title="Role"
            note="Podíl her, ve kterých se role objevila na startu nebo v některé změně. Medik ve 30 % her znamená, že medika někdo hrál ve třech partiích z deseti."
          >
            <RoleTable rows={stats.roles} />
          </Section>

          <Section
            title="Hráči"
            note="Úspěšnost je podíl výher v partiích, kterých se hráč zúčastnil."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <Th>Hráč</Th>
                    <Th align="right">Her</Th>
                    <Th align="right">Výher</Th>
                    <Th align="right">Úspěšnost</Th>
                    <Th>Nejčastější start</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {stats.players.map((player) => (
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
          </Section>

          <Section
            title="Stavy nemocí"
            note="Fialová se počítá jen z her, kde je její stav vyplněný. Ostatní barvy ze všech partií, které mají záznam."
          >
            <DiseaseTable rows={stats.diseases} />
            {stats.strainColors.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-zinc-300">Barva zhoubného kmene</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Vyplněno u {integerFormat.format(stats.strainGames)} her.
                </p>
                <div className="mt-3">
                  <BreakdownTable rows={stats.strainColors} label="Barva" />
                </div>
              </div>
            ) : null}
          </Section>

          <Section
            title="Změny rolí"
            note={`${integerFormat.format(stats.gamesWithRoleChange)} her má aspoň jednu změnu, celkem ${integerFormat.format(stats.roleChanges)} přechodů. Beze změny ${integerFormat.format(stats.roleChangeDepth.none)}, jedna změna ${integerFormat.format(stats.roleChangeDepth.one)}, dvě a víc ${integerFormat.format(stats.roleChangeDepth.twoOrMore)}.`}
          >
            <ChangeTable stats={stats} />
          </Section>
        </div>
      )}
    </main>
  );
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

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] sm:p-6">
      <h2 className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/85">{title}</h2>
      {note ? <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Matrix({ stats }: { stats: PandemicStats }) {
  const { modes, difficulties, counts } = stats.modeDifficulty;
  const columnTotals = difficulties.map((_, index) =>
    counts.reduce((sum, row) => sum + (row[index] ?? 0), 0),
  );

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
                    {integerFormat.format(value)}
                  </Td>
                ))}
                <Td align="right">{integerFormat.format(total)}</Td>
              </tr>
            );
          })}
          <tr>
            <Td>Celkem</Td>
            {columnTotals.map((value, index) => (
              <Td key={difficulties[index]?.key ?? index} align="right">
                {integerFormat.format(value)}
              </Td>
            ))}
            <Td align="right">{integerFormat.format(columnTotals.reduce((sum, value) => sum + value, 0))}</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BreakdownTable({ rows, label }: { rows: CountRow[]; label: string }) {
  const visible = rows.filter((row) => row.games > 0);
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
            <Th align="right">Výher</Th>
            <Th align="right">Úspěšnost</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {visible.map((row) => (
            <tr key={row.key}>
              <Td>{row.label}</Td>
              <Td align="right">{integerFormat.format(row.games)}</Td>
              <Td align="right">{formatPercent(row.share)}</Td>
              <Td align="right">{integerFormat.format(row.wins)}</Td>
              <Td align="right">{formatPercent(row.winRate)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleTable({ rows }: { rows: RoleRow[] }) {
  const visible = rows.filter((row) => row.games > 0 || row.starts > 0 || row.arrivals > 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>Role</Th>
            <Th align="right">Her</Th>
            <Th align="right">Podíl her</Th>
            <Th align="right">Startů</Th>
            <Th align="right">Příchodů změnou</Th>
            <Th align="right">Úspěšnost</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {visible.map((row) => (
            <tr key={row.key}>
              <Td>
                {row.label}
                {row.label !== row.key ? (
                  <span className="ml-2 text-xs text-zinc-500">{row.key.toUpperCase()}</span>
                ) : null}
              </Td>
              <Td align="right">{integerFormat.format(row.games)}</Td>
              <Td align="right">{formatPercent(row.share)}</Td>
              <Td align="right">{integerFormat.format(row.starts)}</Td>
              <Td align="right">{integerFormat.format(row.arrivals)}</Td>
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

function ChangeTable({ stats }: { stats: PandemicStats }) {
  const rows = stats.roleChangePairs.slice(0, 15);
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">Zatím žádná změna role.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>Z role</Th>
            <Th>Na roli</Th>
            <Th align="right">Počet</Th>
            <Th align="right">Podíl změn</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => (
            <tr key={`${row.from}-${row.to}`}>
              <Td>{row.from}</Td>
              <Td>{row.to}</Td>
              <Td align="right">{integerFormat.format(row.count)}</Td>
              <Td align="right">{formatPercent(row.share)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.roleChangePairs.length > rows.length ? (
        <p className="mt-3 text-xs text-zinc-500">
          Zobrazeno 15 nejčastějších přechodů z {integerFormat.format(stats.roleChangePairs.length)}.
        </p>
      ) : null}
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
      className={`px-3 py-2.5 align-top ${align === "right" ? "text-right tabular-nums" : "text-left"} ${
        muted ? "text-zinc-600" : "text-zinc-200"
      }`}
    >
      {children}
    </td>
  );
}

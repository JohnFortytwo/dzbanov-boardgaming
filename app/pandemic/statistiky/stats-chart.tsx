"use client";

import { useState } from "react";
import type { TimelinePoint } from "@/lib/pandemic/stats";

const numberFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });

function shortLabel(point: TimelinePoint, crowded: boolean) {
  if (!crowded) return point.label;
  if (point.key.length === 4) return point.key;
  return `${point.key.slice(5)}/${point.key.slice(2, 4)}`;
}

export function StatsTimelineChart({
  points,
  undated,
  metric,
}: {
  points: TimelinePoint[];
  undated: number;
  metric: "games" | "rate";
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = points.find((point) => point.key === activeKey) ?? points[points.length - 1] ?? null;

  if (points.length === 0) {
    return <p className="text-sm text-zinc-500">Ve zvoleném rozsahu není partie s datem hry.</p>;
  }

  const max = metric === "rate" ? 100 : Math.max(1, ...points.map((point) => point.games));
  const crowded = points.length > 18;
  const barWidth = points.length > 60 ? 12 : points.length > 30 ? 16 : 26;
  const gap = points.length > 60 ? 4 : 8;
  const chartHeight = 180;
  const width = points.length * (barWidth + gap);
  const labelEvery = points.length > 48 ? 6 : points.length > 24 ? 3 : 1;

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <svg
          role="img"
          aria-label="Počty odehraných her v čase"
          viewBox={`0 0 ${width} ${chartHeight + 28}`}
          className="h-56 min-w-full"
          style={{ width: Math.max(width, 520) }}
          onMouseLeave={() => setActiveKey(null)}
        >
          {[0.25, 0.5, 0.75, 1].map((step) => {
            const y = chartHeight - chartHeight * step;
            const label = metric === "rate" ? `${step * 100}` : numberFormat.format(Math.round(max * step));
            return (
              <g key={step}>
                <line x1={0} x2={width} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
                <text x={0} y={y - 2} fill="#71717a" fontSize={10}>
                  {label}
                </text>
              </g>
            );
          })}
          {points.map((point, index) => {
            const x = index * (barWidth + gap);
            const selected = point.key === active?.key;
            const winHeight =
              metric === "rate"
                ? ((point.winRate ?? 0) / max) * chartHeight
                : (point.wins / max) * chartHeight;
            const otherHeight =
              metric === "rate" ? 0 : ((point.games - point.wins) / max) * chartHeight;
            const showLabel = index % labelEvery === 0 || index === points.length - 1;
            return (
              <g key={point.key} onMouseEnter={() => setActiveKey(point.key)}>
                <rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={chartHeight}
                  fill="transparent"
                />
                {otherHeight > 0 ? (
                  <rect
                    x={x}
                    y={chartHeight - winHeight - otherHeight}
                    width={barWidth}
                    height={otherHeight}
                    rx={3}
                    fill={selected ? "#a1a1aa" : "#52525b"}
                  />
                ) : null}
                {winHeight > 0 ? (
                  <rect
                    x={x}
                    y={chartHeight - winHeight}
                    width={barWidth}
                    height={winHeight}
                    rx={3}
                    fill={selected ? "#6ee7b7" : "#34d399"}
                  />
                ) : null}
                {showLabel ? (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 16}
                    textAnchor="middle"
                    fill="#a1a1aa"
                    fontSize={10}
                  >
                    {shortLabel(point, crowded)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
        <p>
          {active ? (
            <>
              <span className="text-zinc-100">{active.label}</span>
              {" · "}
              {numberFormat.format(active.games)} her
              {" · "}
              {numberFormat.format(active.wins)} výher
              {" · "}
              {active.winRate === null ? "bez úspěšnosti" : `${numberFormat.format(active.winRate)} %`}
            </>
          ) : (
            "Najeď na sloupec."
          )}
        </p>
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.14em] text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            {metric === "rate" ? "Úspěšnost" : "Výhry"}
          </span>
          {metric === "games" ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
              Ostatní
            </span>
          ) : null}
        </div>
      </div>
      {undated > 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          {numberFormat.format(undated)} {undated === 1 ? "hra nemá" : undated < 5 ? "hry nemají" : "her nemá"}{" "}
          datum partie, v grafu proto není.
        </p>
      ) : null}
    </div>
  );
}

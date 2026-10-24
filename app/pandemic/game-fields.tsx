"use client";

import { useState, type ReactNode } from "react";
import { foldCode, type CodeLabel, type PlayerOption } from "@/lib/pandemic/drafts";

export const fieldClassName =
  "scheme-dark h-9 w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-[13px] text-white outline-none ring-emerald-400/40 transition focus:border-emerald-400/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

export const diseaseFields = [
  { key: "yellow_disease", label: "Žlutá", dot: "bg-yellow-400" },
  { key: "red_disease", label: "Červená", dot: "bg-red-500" },
  { key: "blue_disease", label: "Modrá", dot: "bg-sky-500" },
  { key: "black_disease", label: "Černá", dot: "bg-zinc-100" },
  { key: "purple_disease", label: "Fialová", dot: "bg-purple-500" },
] as const;

export function roleOptionLabels(roles: CodeLabel[]): CodeLabel[] {
  return roles.map((role) => ({
    code: role.code,
    name_cs: role.code.toUpperCase(),
  }));
}

function withCurrentOption(options: CodeLabel[], current: string | null) {
  if (!current || options.some((option) => option.code === current)) return options;
  return [...options, { code: current, name_cs: current }];
}

function orderCatalog(options: CodeLabel[], priority: string[]) {
  if (priority.length === 0) return options;
  const rank = new Map(priority.map((name, index) => [foldCode(name), index]));
  return [...options].sort((left, right) => {
    const leftRank = rank.get(foldCode(left.name_cs)) ?? rank.get(foldCode(left.code)) ?? priority.length;
    const rightRank =
      rank.get(foldCode(right.name_cs)) ?? rank.get(foldCode(right.code)) ?? priority.length;
    return leftRank - rightRank;
  });
}

export function sortWithPriority(options: CodeLabel[] = [], priorityOrder: string[] = []): CodeLabel[] {
  if (options.length === 0) return [];
  const priorityItems: CodeLabel[] = [];

  priorityOrder.forEach((priority) => {
    const found = options.find(
      (option) =>
        option.name_cs.toLowerCase() === priority.toLowerCase() ||
        option.code.toLowerCase() === priority.toLowerCase(),
    );
    if (found && !priorityItems.some((item) => item.code === found.code)) {
      priorityItems.push(found);
    }
  });

  const otherItems = options.filter((option) => !priorityItems.some((item) => item.code === option.code));
  return [...priorityItems, ...otherItems];
}

export function GameField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-zinc-300">{label}</span>
      {children}
    </label>
  );
}

export function GameCodeSelect({
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
  const emptyLabel = optional ? "Neurčeno" : (placeholder ?? "Vyberte");
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

export function GamePlayerSelect({
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

export function QuickCreate({
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
          disabled={pending || name.trim().length === 0}
          onClick={() => void submit()}
          className="inline-flex h-9 items-center rounded-full bg-emerald-500 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Přidat"}
        </button>
        <button
          type="button"
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

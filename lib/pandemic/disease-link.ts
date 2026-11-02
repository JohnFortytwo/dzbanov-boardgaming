import {
  foldCode,
  modeAllowsPurple,
  modeAllowsVirulentStrain,
  type CodeLabel,
  type DraftData,
} from "@/lib/pandemic/drafts";

export const DISEASE_FIELDS = [
  "yellow_disease",
  "red_disease",
  "blue_disease",
  "black_disease",
  "purple_disease",
] as const;

export type DiseaseField = (typeof DISEASE_FIELDS)[number];

/** Hodnota pole před automatickým doplněním. `null` znamená, že bylo prázdné. */
export type DiseaseAutoFill = Partial<Record<DiseaseField, string | null>>;

const PILL_ORDER = ["none", "cured", "eradicated"] as const;

const STATE_ALIASES: Record<(typeof PILL_ORDER)[number], string[]> = {
  none: ["nic", "none"],
  cured: ["vynalezeno", "vyleceno", "cured"],
  eradicated: ["vymyceno", "eradicated"],
};

export type DiseasePill = {
  code: string;
  label: string;
  kind: (typeof PILL_ORDER)[number];
};

export const DISEASES_FILLED_NOTICE = "Nemoci doplněny jako vynalezené.";
export const RESULT_WIN_NOTICE = "Výsledek nastaven na výhru.";

type StateKind = DiseasePill["kind"] | "empty" | "other";

function findOption(options: CodeLabel[], aliases: string[]): CodeLabel | null {
  return (
    options.find((option) => {
      const code = foldCode(option.code);
      const name = foldCode(option.name_cs);
      return aliases.some((alias) => code === alias || name === alias);
    }) ?? null
  );
}

export function diseaseStatePills(states: CodeLabel[]): DiseasePill[] {
  const pills: DiseasePill[] = [];
  for (const kind of PILL_ORDER) {
    const match = findOption(states, STATE_ALIASES[kind]);
    if (match) pills.push({ code: match.code, label: match.name_cs, kind });
  }
  return pills;
}

export function winResultCode(results: CodeLabel[]): string | null {
  return findOption(results, ["vyhra"])?.code ?? null;
}

export function isWinResult(code: string | null, results: CodeLabel[]): boolean {
  if (!code) return false;
  const win = winResultCode(results);
  if (win && code === win) return true;
  return foldCode(code) === "vyhra";
}

function classify(value: string | null, pills: DiseasePill[]): StateKind {
  if (!value) return "empty";
  const pill = pills.find((item) => item.code === value);
  if (pill) return pill.kind;
  const folded = foldCode(value);
  for (const kind of PILL_ORDER) {
    if (STATE_ALIASES[kind].some((alias) => alias === folded)) return kind;
  }
  return "other";
}

function activeFields(mode: string | null): DiseaseField[] {
  const fields: DiseaseField[] = ["yellow_disease", "red_disease", "blue_disease", "black_disease"];
  if (modeAllowsPurple(mode)) fields.push("purple_disease");
  return fields;
}

function allCuredOrEradicated(form: DraftData, pills: DiseasePill[]) {
  const fields = activeFields(form.game_mode_code);
  return fields.every((key) => {
    const kind = classify(form[key], pills);
    return kind === "cured" || kind === "eradicated";
  });
}

export function applyDiseaseResultLink(input: {
  previous: DraftData;
  next: DraftData;
  auto: DiseaseAutoFill;
  diseaseStates: CodeLabel[];
  gameResults: CodeLabel[];
}): { form: DraftData; auto: DiseaseAutoFill; notice: string | null } {
  const pills = diseaseStatePills(input.diseaseStates);
  const cured = pills.find((pill) => pill.kind === "cured")?.code ?? null;
  const form: DraftData = {
    ...input.next,
    purple_disease: modeAllowsPurple(input.next.game_mode_code) ? input.next.purple_disease : null,
    virulent_strain_color: modeAllowsVirulentStrain(input.next.game_mode_code)
      ? input.next.virulent_strain_color
      : null,
  };
  const auto: DiseaseAutoFill = { ...input.auto };
  if (!modeAllowsPurple(form.game_mode_code)) delete auto.purple_disease;

  for (const key of DISEASE_FIELDS) {
    if (key in auto && form[key] !== input.previous[key]) delete auto[key];
  }

  const wasWin = isWinResult(input.previous.result_code, input.gameResults);
  const nowWin = isWinResult(form.result_code, input.gameResults);
  const diseasesChanged = DISEASE_FIELDS.some((key) => form[key] !== input.previous[key]);
  const purpleTurnedOn =
    modeAllowsPurple(form.game_mode_code) && !modeAllowsPurple(input.previous.game_mode_code);

  if (wasWin && !nowWin) {
    for (const key of DISEASE_FIELDS) {
      if (!(key in auto)) continue;
      form[key] = auto[key] ?? null;
      delete auto[key];
    }
    if (!modeAllowsPurple(form.game_mode_code)) form.purple_disease = null;
    return { form, auto, notice: null };
  }

  let filled = false;
  if (nowWin && cured && (!wasWin || purpleTurnedOn)) {
    const fields = wasWin ? (["purple_disease"] as const) : activeFields(form.game_mode_code);
    for (const key of fields) {
      if (key === "purple_disease" && !modeAllowsPurple(form.game_mode_code)) continue;
      const kind = classify(form[key], pills);
      if (kind !== "empty" && kind !== "none") continue;
      if (!(key in auto)) auto[key] = form[key];
      if (form[key] !== cured) {
        form[key] = cured;
        filled = true;
      }
    }
  }

  const win = winResultCode(input.gameResults);
  const resultSet = Boolean(diseasesChanged && !form.result_code && win && allCuredOrEradicated(form, pills));
  if (resultSet && win) form.result_code = win;

  return {
    form,
    auto,
    notice: filled ? DISEASES_FILLED_NOTICE : resultSet ? RESULT_WIN_NOTICE : null,
  };
}

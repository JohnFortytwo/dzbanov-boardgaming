import { foldCode, type CodeLabel } from "@/lib/pandemic/drafts";

export const DISEASE_STATE_ORDER = ["vynalezeno", "vymyceno", "nic"];

export function sortDiseaseStates(options: CodeLabel[]): CodeLabel[] {
  const rank = new Map(DISEASE_STATE_ORDER.map((code, index) => [code, index]));
  return [...options].sort((left, right) => {
    const leftRank =
      rank.get(foldCode(left.code)) ?? rank.get(foldCode(left.name_cs)) ?? DISEASE_STATE_ORDER.length;
    const rightRank =
      rank.get(foldCode(right.code)) ?? rank.get(foldCode(right.name_cs)) ?? DISEASE_STATE_ORDER.length;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.name_cs.localeCompare(right.name_cs, "cs");
  });
}

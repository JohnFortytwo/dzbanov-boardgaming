"use server";

import { revalidatePath } from "next/cache";
import { grantBadge } from "@/lib/badges-server";
import { parseTermsChoice, type TermsChoice } from "@/lib/terms";
import { createClient } from "@/lib/supabase/server";

export type TermsDecisionResult =
  | { ok: true; choice: TermsChoice; granted: boolean; earnedAt: string | null }
  | { ok: false; error: string };

export async function saveTermsChoice(choice: TermsChoice): Promise<TermsDecisionResult> {
  if (choice !== "accepted" && choice !== "declined") {
    return { ok: false, error: "Rozhodnutí se nepodařilo uložit." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? "";

  if (!data.user || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return { ok: false, error: "Pro uložení rozhodnutí se musíš přihlásit." };
  }

  const current = parseTermsChoice(
    (data.user.user_metadata as { terms_choice?: unknown } | null)?.terms_choice,
  );

  if (current === "accepted" || current === choice) {
    return { ok: true, choice: current, granted: false, earnedAt: null };
  }

  let granted = false;
  let earnedAt: string | null = null;

  if (choice === "accepted") {
    const badge = await grantBadge(supabase, userId, "terms_accepted");
    if (!badge.ok) return { ok: false, error: badge.error };
    granted = badge.granted;
    earnedAt = badge.earnedAt;
  }

  const { error } = await supabase.auth.updateUser({
    data: { terms_choice: choice },
  });

  if (error) {
    console.error("Volbu podmínek se nepodařilo uložit.", error.message);
    return { ok: false, error: "Rozhodnutí se nepodařilo uložit." };
  }

  revalidatePath("/", "layout");
  return { ok: true, choice, granted, earnedAt };
}

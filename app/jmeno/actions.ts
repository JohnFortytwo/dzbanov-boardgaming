"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  missingNicknameColumnMessage,
  nicknameColumnMissing,
  nicknameError,
  normalizeNickname,
} from "@/lib/nickname";

export type NicknameState = { error: string } | { success: string } | null;

export async function updateNickname(
  _prev: NicknameState,
  formData: FormData,
): Promise<NicknameState> {
  const nickname = normalizeNickname(String(formData.get("nickname") ?? ""));
  const invalid = nicknameError(nickname);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";

  if (!data?.claims || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return { error: "Pro změnu jména se musíte přihlásit." };
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ nickname })
    .eq("id", userId)
    .select("id");

  if (error?.code === "23505") {
    return { error: "Tohle jméno už používá jiný účet." };
  }

  if (error?.code === "23514") {
    return { error: "Jméno může obsahovat jen písmena, číslice, mezeru a podtržítko." };
  }

  if (error && nicknameColumnMissing(error)) {
    return { error: missingNicknameColumnMessage };
  }

  if (error) {
    console.error("Jméno se nepodařilo změnit.", error.message);
    return { error: "Jméno se nepodařilo změnit." };
  }

  if (!updated?.length) {
    return { error: "Profil účtu chybí. V databázi je potřeba spustit skript pro přezdívky." };
  }

  revalidatePath("/", "layout");
  return { success: "Jméno bylo změněno." };
}

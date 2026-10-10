"use server";

import { createClient } from "@/lib/supabase/server";

export type PasswordState = { error: string } | { success: string } | null;

export async function updatePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || password !== confirm) {
    return { error: "Hesla se neshodují." };
  }

  if (password.length < 8) {
    return { error: "Heslo musí mít alespoň 8 znaků." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return { error: "Pro změnu hesla se musíte přihlásit." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Heslo se nepodařilo změnit." };
  }

  return { success: "Heslo bylo změněno." };
}

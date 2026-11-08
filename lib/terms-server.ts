import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTermsChoice, type TermsChoice } from "@/lib/terms";

export async function loadTermsChoice(supabase: SupabaseClient): Promise<TermsChoice | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const metadata = data.user.user_metadata as { terms_choice?: unknown } | null;
  return parseTermsChoice(metadata?.terms_choice);
}

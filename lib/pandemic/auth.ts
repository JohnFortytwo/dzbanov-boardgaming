import { createClient } from "@/lib/supabase/server";

export async function requirePandemicUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";

  if (!data?.claims || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return {
      supabase,
      userId: "",
      response: Response.json({ error: "Nejste přihlášeni." }, { status: 401 }),
    };
  }

  return { supabase, userId, response: null };
}

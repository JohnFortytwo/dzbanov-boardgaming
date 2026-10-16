// app/api/pandemic/players/route.ts
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();

  if (!authData?.claims) {
    return Response.json({ error: "Nejste přihlášeni." }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Neplatná data." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "Jméno hráče je povinné." }, { status: 400 });
  }

  // Zápis nového hráče do tabulky players
  const { data, error } = await supabaseAdmin
    .from("players")
    .insert({ name })
    .select("id, name")
    .single();

  if (error) {
    return Response.json({ error: `Chyba při ukládání: ${error.message}` }, { status: 400 });
  }

  return Response.json({ player: data });
}
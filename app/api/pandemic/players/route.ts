import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { foldCode } from "@/lib/pandemic/drafts";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type PlayerRow = { id: string; name: string; is_active: boolean | null };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();

  if (!authData?.claims) {
    return Response.json({ error: "Nejste přihlášeni." }, { status: 401 });
  }

  let body: { name?: string; catalog?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Neplatná data." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "Jméno hráče je povinné." }, { status: 400 });
  }

  const catalog = body.catalog !== false;
  const folded = foldCode(name);
  const { data: existing, error: listError } = await supabaseAdmin
    .from("players")
    .select("id, name, is_active");

  if (listError) {
    return Response.json({ error: `Chyba při ukládání: ${listError.message}` }, { status: 400 });
  }

  const match = (existing ?? []).find(
    (player): player is PlayerRow =>
      typeof player.id === "string" &&
      typeof player.name === "string" &&
      foldCode(player.name) === folded,
  );

  if (match) {
    if (catalog && match.is_active === false) {
      const { error: updateError } = await supabaseAdmin
        .from("players")
        .update({ is_active: true })
        .eq("id", match.id);
      if (updateError) {
        return Response.json({ error: `Chyba při ukládání: ${updateError.message}` }, { status: 400 });
      }
    }
    return Response.json({ player: { id: match.id, name: match.name } });
  }

  const { data, error } = await supabaseAdmin
    .from("players")
    .insert({ name, is_active: catalog })
    .select("id, name")
    .single();

  if (error || !data?.id || !data.name) {
    return Response.json(
      { error: `Chyba při ukládání: ${error?.message ?? "Neznámá chyba."}` },
      { status: 400 },
    );
  }

  return Response.json({ player: { id: data.id, name: data.name } });
}

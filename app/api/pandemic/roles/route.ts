import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { roleCodeFromName } from "@/lib/pandemic/drafts";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    return Response.json({ error: "Název role je povinný." }, { status: 400 });
  }

  const code = roleCodeFromName(name);
  const { data: existing } = await supabaseAdmin
    .from("roles")
    .select("code, name_cs")
    .eq("code", code)
    .maybeSingle();

  if (existing?.code) {
    return Response.json({
      role: {
        code: existing.code,
        name_cs: typeof existing.name_cs === "string" && existing.name_cs.trim()
          ? existing.name_cs
          : name,
      },
    });
  }

  const { data, error } = await supabaseAdmin
    .from("roles")
    .insert({ code, name_cs: name })
    .select("code, name_cs")
    .single();

  if (error || !data?.code) {
    return Response.json(
      { error: `Roli se nepodařilo uložit. ${error?.message ?? "Neznámá chyba."}` },
      { status: 400 },
    );
  }

  return Response.json({
    role: {
      code: data.code,
      name_cs: typeof data.name_cs === "string" && data.name_cs.trim() ? data.name_cs : name,
    },
  });
}

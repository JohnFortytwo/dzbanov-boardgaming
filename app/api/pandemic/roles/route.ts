import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { hiddenRoleCode, roleCodeFromName } from "@/lib/pandemic/drafts";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type RoleRow = { code: string; name_cs: string | null };

function rolePayload(row: RoleRow, fallbackName: string) {
  return {
    code: row.code,
    name_cs: typeof row.name_cs === "string" && row.name_cs.trim() ? row.name_cs.trim() : fallbackName,
  };
}

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
    return Response.json({ error: "Název role je povinný." }, { status: 400 });
  }

  const catalog = body.catalog !== false;
  const listedCode = roleCodeFromName(name);
  const onceCode = hiddenRoleCode(name);
  const { data: existing, error: listError } = await supabaseAdmin
    .from("roles")
    .select("code, name_cs")
    .in("code", [listedCode, onceCode]);

  if (listError) {
    return Response.json({ error: `Roli se nepodařilo uložit. ${listError.message}` }, { status: 400 });
  }

  const rows = (existing ?? []).filter(
    (row): row is RoleRow => typeof row.code === "string" && row.code.length > 0,
  );
  const listed = rows.find((row) => row.code === listedCode);
  const once = rows.find((row) => row.code === onceCode);

  if (listed) {
    return Response.json({ role: rolePayload(listed, name) });
  }
  if (!catalog && once) {
    return Response.json({ role: rolePayload(once, name) });
  }

  const code = catalog ? listedCode : onceCode;
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
    role: rolePayload({ code: data.code, name_cs: typeof data.name_cs === "string" ? data.name_cs : name }, name),
  });
}

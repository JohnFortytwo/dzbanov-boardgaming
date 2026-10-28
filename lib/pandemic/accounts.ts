import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function remember(labels: Map<string, string>, id: unknown, label: unknown) {
  if (typeof id !== "string" || typeof label !== "string") return;
  const userId = id.trim();
  const name = label.trim();
  if (!userId || !name || name.includes("@")) return;
  labels.set(userId, name);
}

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

async function loadFromSession(labels: Map<string, string>): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("account_labels");
    if (error) return error.message;
    if (!Array.isArray(data)) return "Funkce account_labels nevrátila seznam.";

    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const record = row as { id?: unknown; label?: unknown };
      remember(labels, record.id, record.label);
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Popisky účtů se nepodařilo načíst.";
  }
}

async function loadFromAdmin(labels: Map<string, string>): Promise<string | null> {
  const admin = serviceRoleClient();
  if (!admin) return "Chybí service role pro čtení účtů.";

  try {
    for (let from = 0; from < 5000; from += 1000) {
      const { data, error } = await admin
        .from("profiles")
        .select("id, nickname")
        .range(from, from + 999);
      if (error) return error.message;
      if (!data) return "Seznam přezdívek je prázdný.";

      for (const row of data) {
        remember(labels, row.id, row.nickname);
      }

      if (data.length < 1000) break;
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Seznam účtů se nepodařilo načíst.";
  }
}

export async function loadAccountLabels(): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const sessionError = await loadFromSession(labels);
  if (!sessionError && labels.size > 0) return labels;

  labels.clear();
  const adminError = await loadFromAdmin(labels);
  if (adminError && labels.size === 0) {
    console.error(
      "Popisky účtů se nepodařilo načíst.",
      [sessionError, adminError].filter(Boolean).join(" "),
    );
  }
  return labels;
}

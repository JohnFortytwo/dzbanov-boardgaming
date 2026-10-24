import { supabaseAdmin } from "@/lib/supabase/admin";

export async function loadAccountLabels(): Promise<Map<string, string>> {
  const labels = new Map<string, string>();

  try {
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error || !data?.users) break;

      for (const user of data.users) {
        const email = user.email?.trim();
        if (user.id && email) labels.set(user.id, email);
      }

      if (data.users.length < 200) break;
    }
  } catch {
    return labels;
  }

  return labels;
}

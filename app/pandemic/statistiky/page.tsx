import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPandemicStats } from "@/lib/pandemic/load-stats";
import { StatsDashboard } from "./stats-dashboard";

export const metadata = {
  title: "Statistiky | Pandemic",
};

export default async function StatistikyPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  try {
    const source = await loadPandemicStats();
    return <StatsDashboard source={source} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Statistiky se nepodařilo načíst.";
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
        <Link
          href="/pandemic"
          className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
        >
          Zpět na Pandemic
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white">Statistiky</h1>
        <p className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          {message}
        </p>
      </main>
    );
  }
}

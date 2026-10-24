import Link from "next/link";
import { connection } from "next/server";
import { loadPandemicCatalogs } from "@/lib/pandemic/catalogs";
import { NewGameForm } from "./new-game-form";

export const metadata = {
  title: "Nová hra | Pandemic",
};

export default async function NovaHraPage() {
  await connection();

  let catalogs;
  try {
    catalogs = await loadPandemicCatalogs();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Formulář se nepodařilo načíst.";
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
        <Link
          href="/pandemic"
          className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
        >
          Zpět na Pandemic
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white">Nová hra</h1>
        <p className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          {message}
        </p>
      </main>
    );
  }

  return <NewGameForm catalogs={catalogs} />;
}

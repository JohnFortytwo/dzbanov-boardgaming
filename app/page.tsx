import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <BoardgamingHome />
    </Suspense>
  );
}

function HomeFallback() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 text-sm text-zinc-400">
      Načítání…
    </div>
  );
}

async function BoardgamingHome() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "";

  return (
    <div className="relative isolate flex min-h-full flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.2),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(56,189,248,0.12),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_at_center,black_38%,transparent_78%)]" />
      </div>

      <div className="absolute right-6 top-6 z-10 flex items-center gap-4">
        <div className="text-right">
          {email ? (
            <p className="max-w-48 truncate text-xs font-medium text-zinc-300">
              {email}
            </p>
          ) : null}
          <Link
            href="/password"
            className="text-xs text-emerald-400/90 transition hover:text-emerald-300"
          >
            Změnit heslo
          </Link>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            Odhlásit se
          </button>
        </form>
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-20">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.28em] text-emerald-400/85">
          Herní ekosystém
        </p>
        <h1 className="text-center text-4xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl">
          Džbánov Boardgaming
        </h1>
        <p className="mt-6 max-w-2xl text-center text-lg leading-8 text-zinc-400 sm:text-xl">
          Ekosystém pro evidenci, analýzu a digitalizaci herních výsledků
        </p>

        <section className="mt-16 w-full max-w-xl">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-10">
            <div className="mb-6 flex items-center justify-between gap-4">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-300">
                Modul
              </span>
              <span className="text-xs text-zinc-500">Připravujeme</span>
            </div>

            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Pandemic
            </h2>
            <p className="mt-3 text-base leading-7 text-zinc-400">
              Evidence partií, analýza výsledků a digitalizace herního postupu
              proti šířícím se nákazám.
            </p>

            <button
              type="button"
              disabled
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 opacity-70"
            >
              Vstoupit do Pandemicu
            </button>
          </article>
        </section>
      </main>
    </div>
  );
}

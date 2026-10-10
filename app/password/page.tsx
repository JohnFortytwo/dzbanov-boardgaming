import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default function PasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 text-sm text-zinc-400">
          Načítání…
        </div>
      }
    >
      <PasswordContent />
    </Suspense>
  );
}

async function PasswordContent() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  return (
    <div className="relative isolate flex min-h-full flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.2),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(56,189,248,0.12),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_at_center,black_38%,transparent_78%)]" />
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white">
          Změna hesla
        </h1>
        <p className="mt-3 text-center text-sm text-zinc-400">
          Zadejte nové heslo k účtu.
        </p>

        <section className="mt-10 w-full">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-10">
            <PasswordForm />
            <p className="mt-6 text-center text-sm text-zinc-500">
              <Link href="/" className="text-emerald-400 hover:text-emerald-300">
                Zpět na hlavní stránku
              </Link>
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

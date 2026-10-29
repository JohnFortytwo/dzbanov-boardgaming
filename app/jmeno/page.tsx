import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { missingNicknameColumnMessage, nicknameColumnMissing } from "@/lib/nickname";
import { NicknameForm } from "./nickname-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Uživatelské jméno | Džbánov Boardgaming",
};

export default function NicknamePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 text-sm text-zinc-400">
          Načítání…
        </div>
      }
    >
      <NicknameContent />
    </Suspense>
  );
}

async function NicknameContent() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const userId = typeof data.claims.sub === "string" ? data.claims.sub : "";
  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  const profile = /^[0-9a-f-]{36}$/i.test(userId)
    ? await supabase.from("profiles").select("nickname").eq("id", userId).maybeSingle()
    : { data: null, error: null };
  const nickname =
    profile.data && typeof profile.data.nickname === "string" ? profile.data.nickname : "";
  const schemaMissing = Boolean(profile.error && nicknameColumnMissing(profile.error));

  return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white">
          Uživatelské jméno
        </h1>
        <p className="mt-3 text-center text-sm text-zinc-400">
          Jméno, pod kterým vás uvidí ostatní. Přihlášení zůstává přes e-mail.
        </p>

        <section className="mt-10 w-full">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-10">
            <div className="mb-6 rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Přihlašovací e-mail
              </p>
              <p className="mt-1 break-all text-sm text-zinc-200">{email || "—"}</p>
            </div>
            {schemaMissing ? (
              <p className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {missingNicknameColumnMessage}
              </p>
            ) : null}
            <NicknameForm nickname={nickname} />
            <p className="mt-6 text-center text-sm text-zinc-500">
              <Link href="/" className="text-emerald-400 hover:text-emerald-300">
                Zpět na hlavní stránku
              </Link>
            </p>
          </article>
        </section>
      </main>
  );
}

import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/app/components/site-header";
import { loadOwnNickname } from "@/lib/profile";
import { loadTermsChoice } from "@/lib/terms-server";
import { createClient } from "@/lib/supabase/server";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-950 text-sm text-zinc-400">
          Načítání…
        </div>
      }
    >
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: ReactNode }) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const userId = typeof data.claims.sub === "string" ? data.claims.sub : "";
  const [nickname, termsChoice] = await Promise.all([
    loadOwnNickname(supabase, userId),
    loadTermsChoice(supabase),
  ]);

  return (
    <div className="relative isolate flex min-h-full flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.2),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(56,189,248,0.12),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_at_center,black_38%,transparent_78%)]" />
      </div>

      <SiteHeader nickname={nickname} termsChoice={termsChoice} />

      {children}
    </div>
  );
}

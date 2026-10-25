"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ResetAchievementsButton } from "@/app/components/ResetAchievementsButton";
import {
  BADGES,
  badgeById,
  earnedBadgeIds,
  formatEarnedAt,
  isDungeonMaster,
  type EarnedBadges,
} from "@/lib/badges";
import { grantAllBadges, loadUserBadges, subscribeBadges } from "@/lib/badges-client";
import { createClient } from "@/lib/supabase/client";

export function BadgeBoard() {
  const [owned, setOwned] = useState<EarnedBadges | null>(null);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadUserBadges().then((loaded) => {
      if (!cancelled) setOwned(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setIsMaster(isDungeonMaster(data.user?.id ?? ""));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeBadges((update) => {
      if (update.type === "reset") {
        setOwned({});
        return;
      }

      if (update.type === "sync") {
        setOwned(update.earned);
        return;
      }

      setOwned((current) => {
        const earned = current ?? {};
        if (earned[update.id]) return earned;
        return { ...earned, [update.id]: update.earnedAt };
      });
    });
  }, []);

  const earned = owned ? BADGES.filter((badge) => owned[badge.id]) : [];

  return (
    <div className="mt-10">
      {owned === null ? (
        <p className="text-sm text-zinc-400">Načítám odznaky…</p>
      ) : earned.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8">
          <p className="text-base leading-7 text-zinc-300">
            Zatím žádný odznak. Zapiš partii, zajdi do Dračího doupěte, nebo se
            zastav u donate brány.
          </p>
          <p className="mt-3 text-sm text-zinc-500">Ve hře je {BADGES.length} odznaků.</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-amber-200/90">
            Získáno {earned.length} z {BADGES.length}
          </p>
          <ul className="mt-6 space-y-4">
            {earned.map((badge) => (
              <li key={badge.id}>
                <EarnedBadge id={badge.id} earnedAt={owned?.[badge.id] ?? ""} />
              </li>
            ))}
          </ul>
        </>
      )}

      {isMaster || (owned && earnedBadgeIds(owned).length > 0) ? (
        <div className="mt-10 space-y-8 border-t border-white/10 pt-6">
          {isMaster ? <GrantAllBadgesButton /> : null}
          {owned && earnedBadgeIds(owned).length > 0 ? <ResetAchievementsButton /> : null}
        </div>
      ) : null}
    </div>
  );
}

function GrantAllBadgesButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function grant() {
    setPending(true);
    setError(null);
    setDone(false);
    const result = await grantAllBadges();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void grant()}
        disabled={pending}
        className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-100 transition hover:border-amber-200/70 hover:bg-amber-400/20 disabled:opacity-60"
      >
        {pending ? "Přidávám…" : "Přidat všechny odznaky"}
      </button>
      <p className="max-w-md text-xs leading-5 text-zinc-500">
        Pán jeskyně. Nasadí celou sadu, ať jde vyzkoušet, jak se odznaky zobrazují.
      </p>
      {done ? <p className="text-xs text-emerald-300">Všechny odznaky jsou na účtu.</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function EarnedBadge({ id, earnedAt }: { id: keyof EarnedBadges; earnedAt: string }) {
  const badge = badgeById(id);
  const when = formatEarnedAt(earnedAt);

  return (
    <article className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:p-6">
      <Image
        src={badge.src}
        alt=""
        width={160}
        height={160}
        className="size-36 shrink-0 rounded-full object-cover sm:size-40"
      />
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-white">{badge.title}</h2>
        <p className="mt-2 text-base leading-7 text-zinc-300">{badge.description}</p>
        {when ? <p className="mt-3 text-sm text-zinc-500">Získáno {when}</p> : null}
      </div>
    </article>
  );
}

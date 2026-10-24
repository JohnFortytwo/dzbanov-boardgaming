"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HEADER_BADGE_LIMIT, sampleBadges, type BadgeId } from "@/lib/badges";
import { loadUserBadges, subscribeBadges } from "@/lib/badges-client";

export function SignedInUser({ email }: { email: string }) {
  const [owned, setOwned] = useState<BadgeId[]>([]);
  const [featured, setFeatured] = useState<BadgeId | null>(null);

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
    return subscribeBadges((update) => {
      if (update.type === "reset") {
        setOwned([]);
        setFeatured(null);
        return;
      }

      if (update.type === "sync") {
        setFeatured(null);
        setOwned(update.ids);
        return;
      }

      setFeatured(update.id);
      setOwned((current) => (current.includes(update.id) ? current : [...current, update.id]));
    });
  }, []);

  const visible = useMemo(
    () => sampleBadges(owned, HEADER_BADGE_LIMIT, featured),
    [owned, featured],
  );

  return (
    <div className="flex items-center justify-end gap-2">
      {email ? (
        <p className="max-w-48 truncate text-xs font-medium text-zinc-300">{email}</p>
      ) : null}
      {visible.map((badge) => (
        <Link
          key={badge.id}
          href="/odznaky"
          title={badge.title}
          aria-label={badge.title}
          className="group relative inline-flex rounded-full"
        >
          <Image
            src={badge.src}
            alt=""
            width={64}
            height={64}
            className="size-16 rounded-full object-cover"
          />
          <span
            role="tooltip"
            className="pointer-events-none absolute top-full right-0 z-30 mt-2 hidden whitespace-nowrap rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-100 shadow-lg group-hover:block group-focus-within:block"
          >
            {badge.title}
          </span>
        </Link>
      ))}
    </div>
  );
}

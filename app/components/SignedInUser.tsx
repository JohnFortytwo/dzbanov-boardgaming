"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  loadUserAchievements,
  subscribeAchievement,
  type AchievementFlag,
  type UserAchievements,
} from "@/lib/achievements";

const BADGES: {
  flag: AchievementFlag;
  src: string;
  label: string;
}[] = [
  {
    flag: "has_achievement_42",
    src: "/Images/42_black.png",
    label: "Poslušný ovčan jeskyně (42)",
  },
  {
    flag: "has_achievement_ano",
    src: "/Images/ANO..png",
    label: "Bude líp! (Koblihový renegát)",
  },
];

export function SignedInUser({ email }: { email: string }) {
  const [achievements, setAchievements] = useState<UserAchievements>({
    has_achievement_42: false,
    has_achievement_ano: false,
  });

  useEffect(() => {
    let cancelled = false;

    void loadUserAchievements().then((loaded) => {
      if (!cancelled) setAchievements(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeAchievement((flag) => {
      setAchievements((current) => ({ ...current, [flag]: true }));
    });
  }, []);

  const visible = BADGES.filter((badge) => achievements[badge.flag]);

  return (
    <div className="flex items-center justify-end gap-1.5">
      {email ? (
        <p className="max-w-48 truncate text-xs font-medium text-zinc-300">
          {email}
        </p>
      ) : null}
      {visible.map((badge) => (
        <span key={badge.flag} className="group relative inline-flex">
          <Image
            src={badge.src}
            alt={badge.label}
            title={badge.label}
            width={20}
            height={20}
            className="h-5 w-5 rounded-full object-cover"
          />
          <span
            role="tooltip"
            className="pointer-events-none absolute top-full right-0 z-30 mt-2 hidden whitespace-nowrap rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-100 shadow-lg group-hover:block group-focus-within:block"
          >
            {badge.label}
          </span>
        </span>
      ))}
    </div>
  );
}

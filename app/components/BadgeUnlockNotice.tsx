"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { badgeById, type BadgeId } from "@/lib/badges";
import { subscribeBadges } from "@/lib/badges-client";

export function BadgeUnlockNotice() {
  const [queue, setQueue] = useState<BadgeId[]>([]);
  const current = queue[0] ? badgeById(queue[0]) : null;

  useEffect(() => {
    return subscribeBadges((update) => {
      if (update.type !== "grant") return;
      setQueue((items) => (items.includes(update.id) ? items : [...items, update.id]));
    });
  }, []);

  useEffect(() => {
    if (!current) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setQueue((items) => items.slice(1));
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current]);

  if (!current) return null;

  function dismiss() {
    setQueue((items) => items.slice(1));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={dismiss} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-unlock-title"
        className="relative z-10 w-full max-w-sm rounded-3xl border border-amber-300/30 bg-zinc-950 p-6 text-center shadow-[0_24px_80px_-24px_rgba(251,191,36,0.45)]"
      >
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/90">
          Nový odznak
        </p>
        <Image
          src={current.src}
          alt=""
          width={176}
          height={176}
          className="mx-auto mt-5 size-40 rounded-full object-cover sm:size-44"
        />
        <h2 id="badge-unlock-title" className="mt-5 text-2xl font-semibold text-white">
          {current.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-300">{current.description}</p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
        >
          Beru
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { resetUserAchievements } from "@/lib/achievements";

export function ResetAchievementsButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  async function confirmReset() {
    setPending(true);
    setError(null);

    const result = await resetUserAchievements();
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="inline-flex items-center rounded-full border border-red-400/30 bg-transparent px-4 py-2 text-xs font-medium text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200"
        >
          Očistit hříchy (Resetovat achievementy)
        </button>
        {error && !open ? (
          <p className="absolute right-0 top-full mt-1 w-max max-w-64 text-xs text-red-300">
            {error}
          </p>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => {
              if (!pending) setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-achievements-title"
            className="relative z-10 w-full max-w-sm rounded-3xl border border-red-400/30 bg-zinc-950 p-6 text-left shadow-[0_24px_80px_-24px_rgba(248,113,113,0.45)]"
          >
            <h2
              id="reset-achievements-title"
              className="text-lg font-semibold text-white"
            >
              Očistit hříchy
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Opravdu chceš smazat své dosavadní odznaky?
            </p>
            {error ? (
              <p className="mt-3 text-sm text-red-300">{error}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white disabled:opacity-60"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => void confirmReset()}
                disabled={pending}
                className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
              >
                {pending ? "Mažu…" : "Smazat odznaky"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

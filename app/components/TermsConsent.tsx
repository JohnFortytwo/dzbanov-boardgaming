"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveTermsChoice } from "@/app/terms/actions";
import { announceBadge } from "@/lib/badges-client";
import { TERMS_BODY, TERMS_TITLE, type TermsChoice } from "@/lib/terms";

const linkClass =
  "inline-flex items-center rounded-full border border-amber-400/30 bg-transparent px-4 py-2 text-xs font-medium text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-100";

function TermsDocument({ text }: { text: string }) {
  const blocks = text.split("\n\n");

  return (
    <div className="space-y-4 font-serif">
      {blocks.map((block, index) => {
        const breakAt = block.indexOf("\n");
        const heading = breakAt === -1 ? "" : block.slice(0, breakAt);
        if (!heading.startsWith("Článek ")) {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {block}
            </p>
          );
        }

        return (
          <p key={heading}>
            <strong className="font-bold">{heading}</strong>
            <br />
            {block.slice(breakAt + 1)}
          </p>
        );
      })}
    </div>
  );
}

export function TermsConsent({ initialChoice }: { initialChoice: TermsChoice | null }) {
  const [choice, setChoice] = useState(initialChoice);
  const [mode, setMode] = useState<"closed" | "gate" | "review">(
    initialChoice === null ? "gate" : "closed",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<TermsChoice | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialChoice === null) return;
    setChoice(initialChoice);
    setMode((current) => (current === "gate" ? "closed" : current));
  }, [initialChoice]);

  useEffect(() => {
    if (mode === "closed") return;

    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (mode === "review") setMode("closed");
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mode]);

  function decide(next: TermsChoice) {
    setError(null);
    setPendingChoice(next);
    startTransition(async () => {
      const result = await saveTermsChoice(next);
      setPendingChoice(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setChoice(result.choice);
      setMode("closed");
      if (result.granted && result.earnedAt) {
        announceBadge("terms_accepted", result.earnedAt);
      }
    });
  }

  function open() {
    setError(null);
    setMode(choice === null ? "gate" : "review");
  }

  const forced = mode === "gate";
  const kicker = forced ? "Než půjdeš dál" : choice === "accepted" ? "Už přijato" : "Zatím odmítnuto";
  const note = forced
    ? "Dokud si nevybereš, okno zůstane."
    : choice === "accepted"
      ? "Přijato. Tenhle text už je jen ke čtení."
      : "Odmítnuto. Podmínky jsi poslal do prdele a vývojáře hned za nimi.";

  return (
    <>
      <button type="button" onClick={open} className={linkClass}>
        Podmínky
      </button>

      {mode !== "closed" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => {
              if (!forced) setMode("closed");
            }}
          />
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
            className="relative z-10 flex max-h-[min(92vh,46rem)] w-full max-w-2xl min-h-0 flex-col overflow-hidden rounded-3xl border border-amber-200/25 bg-zinc-950 text-zinc-100 shadow-[0_24px_80px_-24px_rgba(251,191,36,0.35)] outline-none"
          >
            <div className="shrink-0 px-6 pt-6 sm:px-8 sm:pt-8">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/90">{kicker}</p>
              <h2 id="terms-title" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {TERMS_TITLE}
              </h2>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 sm:px-8">
              <article className="rounded-2xl border border-stone-400/30 bg-[#f6f1e7] px-5 py-4 text-[15px] leading-7 text-stone-900 shadow-inner">
                <TermsDocument text={TERMS_BODY} />
              </article>
            </div>

            <div className="shrink-0 px-6 pt-4 pb-6 sm:px-8 sm:pb-8">
              <p className="text-sm leading-6 text-zinc-400">{note}</p>
              {error ? (
                <p className="mt-2 text-sm text-red-300" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                {forced ? null : (
                  <button
                    type="button"
                    onClick={() => setMode("closed")}
                    disabled={isPending}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white disabled:opacity-60"
                  >
                    Zavřít
                  </button>
                )}
                {choice === null ? (
                  <button
                    type="button"
                    onClick={() => decide("declined")}
                    disabled={isPending}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-center text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white disabled:opacity-60"
                  >
                    {pendingChoice === "declined" ? "Zapisuji…" : "Strčte si ty pravidla do prdele!"}
                  </button>
                ) : null}
                {choice !== "accepted" ? (
                  <button
                    type="button"
                    onClick={() => decide("accepted")}
                    disabled={isPending}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {pendingChoice === "accepted" ? "Zapisuji…" : "Přijímám podmínky"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

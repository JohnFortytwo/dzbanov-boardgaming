"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { TermsConsent, type TermsConsentHandle } from "@/app/components/TermsConsent";
import { UserManual, type UserManualHandle } from "@/app/components/UserManual";
import { SignedInUser } from "@/app/components/SignedInUser";
import { logout } from "@/app/login/actions";
import { foldCode } from "@/lib/pandemic/drafts";
import type { TermsChoice } from "@/lib/terms";

const menuItemClass =
  "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-zinc-200 outline-none transition hover:bg-white/10 focus-visible:bg-white/10";

function isGart(nickname: string) {
  return foldCode(nickname) === "gart";
}

export function AccountBar({
  nickname,
  termsChoice,
}: {
  nickname: string;
  termsChoice: TermsChoice | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<TermsConsentHandle>(null);
  const manualRef = useRef<UserManualHandle>(null);
  const menuId = useId();
  const showManual = isGart(nickname);
  const label = nickname.trim() || "Účet";
  const initial = label.slice(0, 1).toLocaleUpperCase("cs");

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="flex flex-col items-end gap-2">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 py-1 pr-2.5 pl-1 text-sm font-medium text-emerald-50 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.95)] transition hover:border-emerald-300/70 hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-sm font-semibold text-zinc-950">
            {initial}
          </span>
          <span className="max-w-28 truncate sm:max-w-48">{label}</span>
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`size-4 shrink-0 text-emerald-200/80 transition ${open ? "rotate-180" : ""}`}
          >
            <path
              fill="currentColor"
              d="M5.2 7.4a.75.75 0 0 1 1.06.04L10 11.3l3.74-3.86a.75.75 0 1 1 1.08 1.04l-4.28 4.42a.75.75 0 0 1-1.08 0L5.16 8.48a.75.75 0 0 1 .04-1.08Z"
            />
          </svg>
        </button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-white/10 bg-zinc-950/95 p-1 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl"
          >
            <Link href="/jmeno" role="menuitem" className={menuItemClass} onClick={() => setOpen(false)}>
              Změnit jméno
            </Link>
            <Link href="/password" role="menuitem" className={menuItemClass} onClick={() => setOpen(false)}>
              Změnit heslo
            </Link>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                termsRef.current?.open();
              }}
            >
              Podmínky
            </button>
            {showManual ? (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass}
                onClick={() => {
                  setOpen(false);
                  manualRef.current?.open();
                }}
              >
                Návod
              </button>
            ) : null}
            <div className="my-1 border-t border-white/10" />
            <form action={logout}>
              <button type="submit" role="menuitem" className={menuItemClass}>
                Odhlásit se
              </button>
            </form>
          </div>
        ) : null}
      </div>
      <SignedInUser />
      <TermsConsent ref={termsRef} initialChoice={termsChoice} showButton={false} />
      {showManual ? <UserManual ref={manualRef} showButton={false} /> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

const INGEST_COMMAND = "python scripts/ingest_pdf.py";

const DEPLOY_COMMANDS = `git status
git add .
git commit -m "TEXT ZMĚNY"
git push origin main`;

const DEV_COMMAND = "npm run dev";

export function UserManual() {
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<{
    id: string;
    status: "copied" | "error";
  } | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function copy(id: string, command: string) {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);

    try {
      await navigator.clipboard.writeText(command);
      setCopyState({ id, status: "copied" });
    } catch {
      setCopyState({ id, status: "error" });
    }

    copyTimer.current = window.setTimeout(() => {
      setCopyState((current) => (current?.id === id ? null : current));
    }, 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full border border-sky-400/30 bg-transparent px-4 py-2 text-xs font-medium text-sky-300 transition hover:border-sky-400/60 hover:bg-sky-500/10 hover:text-sky-200"
      >
        Návod
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-manual-title"
            className="relative z-10 max-h-[min(90vh,52rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-sky-400/30 bg-zinc-950 p-6 text-zinc-100 shadow-[0_24px_80px_-24px_rgba(56,189,248,0.45)] sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-sky-300/90">
                  Provoz a úpravy webu
                </p>
                <h2
                  id="user-manual-title"
                  className="mt-2 text-2xl font-semibold tracking-tight text-white"
                >
                  Návod
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-white"
              >
                Zavřít
              </button>
            </div>

            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-semibold text-white">Nové skeny</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  PDF dej do složky{" "}
                  <code className="font-mono text-sky-200">scan_upload</code> v
                  kořeni projektu. V PowerShellu, taky z kořene, spusť příkaz
                  níž. Skript vezme nejvýš 3 PDF a hotové přesune do{" "}
                  <code className="font-mono text-sky-200">scan_used</code>.
                </p>
                <CommandBlock
                  id="ingest"
                  command={INGEST_COMMAND}
                  copyState={copyState}
                  onCopy={copy}
                />
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white">
                  Změna na produkci
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Ve složce projektu spusť příkazy v tomto pořadí. Do uvozovek
                  doplň, co se změnilo.
                </p>
                <CommandBlock
                  id="deploy"
                  command={DEPLOY_COMMANDS}
                  copyState={copyState}
                  onCopy={copy}
                />
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white">Cursor</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Lokální náhled webu.
                </p>
                <CommandBlock
                  id="dev"
                  command={DEV_COMMAND}
                  copyState={copyState}
                  onCopy={copy}
                />
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-300">
                  <li>Úpravy popisuj česky a řekni, kdy se má commitovat.</li>
                  <li>
                    Soubor{" "}
                    <code className="font-mono text-sky-200">.env</code> se
                    necommituje.
                  </li>
                  <li>Jednu úpravu dodělej a ověř, než začne další.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CommandBlock({
  id,
  command,
  copyState,
  onCopy,
}: {
  id: string;
  command: string;
  copyState: { id: string; status: "copied" | "error" } | null;
  onCopy: (id: string, command: string) => void;
}) {
  const status = copyState?.id === id ? copyState.status : null;
  const label =
    status === "copied"
      ? "Zkopírováno"
      : status === "error"
        ? "Nepovedlo se"
        : "Kopírovat";

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-end border-b border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={() => void onCopy(id, command)}
          className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
        >
          {label}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-sm leading-6 text-emerald-200">
        <code>{command}</code>
      </pre>
    </div>
  );
}

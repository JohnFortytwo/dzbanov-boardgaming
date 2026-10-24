"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { badgeById, type BadgeId } from "@/lib/badges";
import { grantOwnBadge } from "@/lib/badges-client";

type Step = "1" | "2a" | "finale-a" | "finale-b";

const FINALE_FLAGS: Partial<Record<Step, BadgeId>> = {
  "finale-a": "dd_resist",
  "finale-b": "dd_ano",
};

export function DraciDoupeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("1");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "owned" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const grantToken = useRef(0);

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

  function choose(next: Step) {
    setStep(next);
    const flag = FINALE_FLAGS[next];
    if (!flag) return;

    const token = grantToken.current + 1;
    grantToken.current = token;
    setSaveStatus("saving");
    setSaveError(null);

    void grantOwnBadge(flag).then((result) => {
      if (token !== grantToken.current) return;
      if (!result.ok) {
        setSaveStatus("error");
        setSaveError(result.error);
        return;
      }
      setSaveStatus(result.granted ? "saved" : "owned");
    });
  }

  function enterDungeon() {
    grantToken.current += 1;
    setStep("1");
    setSaveStatus("idle");
    setSaveError(null);
    setOpen(true);
  }

  return (
    <>
      <article className="flex h-full flex-col rounded-3xl border border-orange-400/25 bg-white/5 p-8 shadow-[0_24px_80px_-32px_rgba(249,115,22,0.55)] backdrop-blur-xl sm:p-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="rounded-full border border-orange-400/40 bg-orange-500/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-orange-300">
            Varování
          </span>
          <span className="text-xs text-orange-300/80">Na vlastní nebezpečí</span>
        </div>

        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Dračí doupě
        </h2>
        <p className="mt-3 flex-1 text-base leading-7 text-zinc-400">
          Pán jeskyně říká: „Neklikej na tenhle modul. Vážně. Nic dobrého tebe
          ani tvou herní skupinu tam nečeká.“
        </p>

        <button
          type="button"
          onClick={enterDungeon}
          className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-500 px-6 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-orange-400"
        >
          NEKLIKAT! Vstoupit do Dračího doupěte
        </button>
      </article>

      {open ? (
        <DungeonDialog
          step={step}
          saveStatus={saveStatus}
          saveError={saveError}
          onStep={choose}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function DungeonDialog({
  step,
  saveStatus,
  saveError,
  onStep,
  onClose,
}: {
  step: Step;
  saveStatus: "idle" | "saving" | "saved" | "owned" | "error";
  saveError: string | null;
  onStep: (step: Step) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="draci-doupe-title"
        className="relative z-10 max-h-[min(90vh,52rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-orange-400/30 bg-zinc-950 p-6 text-zinc-100 shadow-[0_24px_80px_-24px_rgba(249,115,22,0.55)] sm:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-orange-300/90">
              Varování
            </p>
            <h2
              id="draci-doupe-title"
              className="mt-2 text-2xl font-semibold tracking-tight text-white"
            >
              Dračí doupě
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-white"
          >
            Zavřít
          </button>
        </div>

        {step === "1" ? (
          <StoryStep
            text="Ty jsi fakt kliknul?! I když jsem tě výslovně varoval? Tvá neposlušnost narušila rovnováhu Džbánova! Mám dobrou náladu, takže ti dávám jedinou šanci se omluvit a pokojně odejít."
            choices={[
              {
                label:
                  "Omlouvám se, Pane jeskyně. Už to nikdy neudělám.",
                onSelect: () => onStep("2a"),
              },
              {
                label: "Kašlu na tě, staříku! Chci svůj loot!",
                onSelect: () => onStep("finale-b"),
                dangerous: true,
              },
            ]}
          />
        ) : null}

        {step === "2a" ? (
          <StoryStep
            text="Slušné vychování se v dnešní době vidí málokdy. Tvá pokora mě obměkčila. Opravdu jsi schopen uznat svou chybu?"
            choices={[
              {
                label: "Ano, skláním se před tvou moudrostí.",
                onSelect: () => onStep("finale-a"),
              },
              {
                label:
                  "Vlastně ne, jen jsem zvědavý, co se stane, když zmáčknu tohle...",
                onSelect: () => onStep("finale-b"),
                dangerous: true,
              },
            ]}
          />
        ) : null}

        {step === "finale-a" ? (
          <Finale
            text="Ukázal jsi pravé srdce poctivého deskovkáře! Získáváš odznak Poslušný ovčan."
            saveStatus={saveStatus}
            saveError={saveError}
          >
            <Image
              src={badgeById("dd_resist").src}
              alt={badgeById("dd_resist").title}
              width={1024}
              height={1024}
              className="mx-auto size-64 rounded-full object-cover"
            />
          </Finale>
        ) : null}

        {step === "finale-b" ? (
          <Finale
            text="Za tvou neposlušnost se ti zobrazuje toto. Vítej v éře, kdy bude líp!"
            saveStatus={saveStatus}
            saveError={saveError}
          >
            <Image
              src={badgeById("dd_ano").src}
              alt={badgeById("dd_ano").title}
              width={1024}
              height={1024}
              className="mx-auto size-64 rounded-full object-cover"
            />
          </Finale>
        ) : null}
      </div>
    </div>
  );
}

function StoryStep({
  text,
  choices,
}: {
  text: string;
  choices: { label: string; onSelect: () => void; dangerous?: boolean }[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-orange-300">Pán jeskyně</p>
      <p className="mt-3 text-base leading-7 text-zinc-200">„{text}“</p>
      <div className="mt-8 space-y-3">
        {choices.map((choice) => (
          <button
            key={choice.label}
            type="button"
            onClick={choice.onSelect}
            className={
              choice.dangerous
                ? "w-full rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-left text-sm leading-6 text-orange-100 transition hover:border-orange-300/60 hover:bg-orange-500/20"
                : "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm leading-6 text-zinc-100 transition hover:border-emerald-400/40 hover:bg-emerald-400/10"
            }
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Finale({
  text,
  saveStatus,
  saveError,
  children,
}: {
  text: string;
  saveStatus: "idle" | "saving" | "saved" | "owned" | "error";
  saveError: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-base leading-7 text-zinc-100">{text}</p>
      <div className="mt-6">{children}</div>
      <p className="mt-4 text-sm text-zinc-500" aria-live="polite">
        {saveStatus === "saving" ? "Zapisuji odznak…" : null}
        {saveStatus === "saved" ? "Odznak je uložený na tvém účtu." : null}
        {saveStatus === "owned" ? "Tenhle odznak už máš." : null}
        {saveStatus === "error" ? saveError : null}
      </p>
    </div>
  );
}

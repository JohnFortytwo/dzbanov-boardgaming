"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { badgeById, type BadgeId } from "@/lib/badges";
import { grantOwnBadge } from "@/lib/badges-client";

type Step = "offer" | "babis" | "beer" | "beer-yes" | "beer-no" | "ransom" | "kobliha";

const FINALE_FLAGS: Partial<Record<Step, BadgeId>> = {
  "beer-yes": "donate_beer",
  kobliha: "donate_kobliha",
};

export function DonateModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("offer");
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
    if (!flag) {
      setSaveStatus("idle");
      setSaveError(null);
      return;
    }

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

  function openGate() {
    grantToken.current += 1;
    setStep("offer");
    setSaveStatus("idle");
    setSaveError(null);
    setOpen(true);
  }

  return (
    <>
      <article className="flex h-full flex-col rounded-3xl border border-[#d6e4f5] bg-white p-8 text-slate-700 shadow-[0_24px_80px_-28px_rgba(0,48,135,0.65)] sm:p-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="rounded-full bg-[#003087] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            Modul
          </span>
          <span className="text-xs font-semibold tracking-wide text-[#009cde]">Secure checkout</span>
        </div>

        <p className="text-sm font-black italic tracking-tight text-[#003087]">DžbánPay</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-[#003087]">DONATE</h2>
        <p className="mt-3 flex-1 text-base leading-7 text-slate-600">
          Gart vypotil litry krve, aby tenhle web vzniknul. Brána je otevřená.
          Svědomí už méně.
        </p>

        <button
          type="button"
          onClick={openGate}
          className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-[#ffc439] text-lg font-black tracking-wide text-[#003087] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.18)] transition hover:bg-[#ffb400]"
        >
          Donate
        </button>
        <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
          Bez transakčních poplatků. S následky.
        </p>
      </article>

      {open ? (
        <DonateDialog
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

function DonateDialog({
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
      <div className="absolute inset-0 bg-[#001833]/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-title"
        className="relative z-10 max-h-[min(90vh,52rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white text-slate-700 shadow-[0_24px_80px_-24px_rgba(0,48,135,0.55)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 sm:px-8">
          <p className="text-lg font-black italic tracking-tight text-[#003087]">DžbánPay</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          >
            Zrušit platbu
          </button>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8">
          {step === "offer" ? (
            <Story
              kicker="Čeká se na plátce"
              title="Jak se mu odvděčíš?"
              text="Gart vypotil litry krve, aby tenhle web vzniknul. Brána umí přijmout jen to, co se vejde do ruky."
            >
              <div className="space-y-3">
                <Choice onClick={() => onStep("babis")} tone="ghost">
                  Ať si naprdí!
                </Choice>
                <Choice onClick={() => onStep("beer")} tone="gold" icon="/Images/PIVO.jpg" iconAlt="">
                  Koupím mu pivo
                </Choice>
                <Choice onClick={() => onStep("ransom")} tone="navy">
                  Pošlu mu donate 42 000 Kč
                </Choice>
                <Choice onClick={() => onStep("kobliha")} tone="gold" icon="/Images/KOBLIHA.jpg" iconAlt="">
                  Dám mu koblihu
                </Choice>
              </div>
            </Story>
          ) : null}

          {step === "babis" ? (
            <Story
              kicker="Platba zamítnuta slovy"
              title="Přesně. Ať to zaplatí Babiš."
              text="Gart si utře čelo, stát si utře ruce a brána zapíše nulu. Odznak za statečnou nevděčnost nechodí."
            >
              <Choice onClick={() => onStep("offer")} tone="gold">
                Zpátky k vině
              </Choice>
            </Story>
          ) : null}

          {step === "beer" ? (
            <Story
              kicker="Ověření slibu"
              title="Jedno točené. Myslíš to vážně?"
              text="Pěna ještě nestojí na stole. Džbánov poslouchá, jestli je to slib, nebo jen klik."
            >
              <div className="space-y-3">
                <Choice onClick={() => onStep("beer-yes")} tone="gold">
                  Ano, slibuju.
                </Choice>
                <Choice onClick={() => onStep("beer-no")} tone="ghost">
                  Ne. Jen jsem zkoušel tlačítko.
                </Choice>
              </div>
            </Story>
          ) : null}

          {step === "beer-yes" ? (
            <Finale
              kicker="Zaplaceno slibem"
              title="Tvůj slib je svatý pod dohledem Džbánova."
              text="Až Gart zvedne půllitr, bude vědět, že to neprošlo branou. Prošlo to tebou."
              badge="donate_beer"
              saveStatus={saveStatus}
              saveError={saveError}
              onAgain={() => onStep("offer")}
            />
          ) : null}

          {step === "beer-no" ? (
            <Story
              kicker="Slib propadl"
              title="Pěna opadla dřív než odhodlání."
              text="Džbánov slevy na rozmyšlených pivech nevede. Tohle se nepočítá."
            >
              <Choice onClick={() => onStep("offer")} tone="gold">
                Zpátky k otázce
              </Choice>
            </Story>
          ) : null}

          {step === "ransom" ? (
            <Story
              kicker="Transakce zamítnuta"
              title="Tohle není charita. Tohle je výkupné."
              text="Brána se na 42 000 Kč podívala, zdvořile omdlela a vzkazuje: tudy projde pivo, nebo kobliha. Koruny v tomhle objemu ne."
            >
              <Receipt />
              <div className="mt-6">
                <Choice onClick={() => onStep("offer")} tone="gold">
                  Zpátky k rozumným částkám
                </Choice>
              </div>
            </Story>
          ) : null}

          {step === "kobliha" ? (
            <Finale
              kicker="Zboží přijato"
              title="Kobliha putuje přes stůl."
              text="Žádné CVV, žádný poplatek. Cukr, marmeláda a Gart, který ji bere oběma rukama. Džbánov to počítá."
              badge="donate_kobliha"
              saveStatus={saveStatus}
              saveError={saveError}
              onAgain={() => onStep("offer")}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Story({
  kicker,
  title,
  text,
  children,
}: {
  kicker: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#009cde]">{kicker}</p>
      <h2 id="donate-title" className="mt-2 text-2xl font-black tracking-tight text-[#003087]">
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-slate-600">{text}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Finale({
  kicker,
  title,
  text,
  badge,
  saveStatus,
  saveError,
  onAgain,
}: {
  kicker: string;
  title: string;
  text: string;
  badge: BadgeId;
  saveStatus: "idle" | "saving" | "saved" | "owned" | "error";
  saveError: string | null;
  onAgain: () => void;
}) {
  const earned = badgeById(badge);

  return (
    <Story kicker={kicker} title={title} text={text}>
      <Image
        src={earned.src}
        alt={earned.title}
        width={256}
        height={256}
        className="mx-auto size-52 rounded-full object-cover sm:size-64"
      />
      <p className="mt-4 text-center text-sm text-slate-500" aria-live="polite">
        {saveStatus === "saving" ? "Zapisuji odznak…" : null}
        {saveStatus === "saved" ? "Odznak je uložený na tvém účtu." : null}
        {saveStatus === "owned" ? "Tenhle odznak už máš." : null}
        {saveStatus === "error" ? saveError : null}
      </p>
      <div className="mt-6">
        <Choice onClick={onAgain} tone="gold">
          Ještě něco přihodit
        </Choice>
      </div>
    </Story>
  );
}

function Receipt() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 font-mono text-xs text-slate-600">
      <div className="flex justify-between gap-4">
        <span>Částka</span>
        <span>42 000 Kč</span>
      </div>
      <div className="mt-2 flex justify-between gap-4">
        <span>Stav</span>
        <span className="font-bold text-red-600">ZAMÍTNUTO</span>
      </div>
      <div className="mt-2 flex justify-between gap-4">
        <span>Důvod</span>
        <span>Limit reality</span>
      </div>
    </div>
  );
}

function Choice({
  onClick,
  tone,
  icon,
  iconAlt,
  children,
}: {
  onClick: () => void;
  tone: "gold" | "navy" | "ghost";
  icon?: string;
  iconAlt?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "gold"
      ? "border-[#ffc439] bg-[#ffc439] text-[#003087] hover:bg-[#ffb400]"
      : tone === "navy"
        ? "border-[#003087] bg-[#003087] text-white hover:bg-[#00256b]"
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold leading-6 transition ${toneClass}`}
    >
      {icon ? (
        <Image src={icon} alt={iconAlt ?? ""} width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

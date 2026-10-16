import Link from "next/link";

export const metadata = {
  title: "Pandemic | Džbánov Boardgaming",
};

const tiles = [
  {
    href: "/pandemic/nova-hra",
    title: "Nová hra",
    description: "Formulář pro živé zadání odehrané hry.",
    status: "Rozpracováno",
    action: "Otevřít formulář",
    ready: false,
  },
  {
    href: "/pandemic/statistiky",
    title: "Statistiky",
    description:
      "Grafy a přehledy výher, úspěšnosti hráčů a obtížností.",
    status: "Rozpracováno",
    action: "Otevřít statistiky",
    ready: false,
  },
  {
    href: "/pandemic/prepis",
    title: "Přepis historických her",
    description: "Verifikační rozhraní pro schvalování A4 skenů.",
    status: "K ověření",
    action: "Otevřít přepis",
    ready: true,
  },
] as const;

export default function PandemicPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-12 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-emerald-400/85">
        Modul
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Pandemic
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
        Evidence partií, analýza výsledků a přepis historických záznamů ze
        skenů.
      </p>

      <section className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className={`group flex h-full flex-col rounded-3xl border bg-white/5 p-8 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl transition hover:bg-white/10 ${
              tile.ready
                ? "border-emerald-400/40 hover:border-emerald-300/70"
                : "border-white/10 hover:border-emerald-400/30"
            }`}
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-300">
                Sekce
              </span>
              <span className="text-xs text-zinc-500">{tile.status}</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              {tile.title}
            </h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">
              {tile.description}
            </p>
            <span className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 transition group-hover:bg-emerald-400">
              {tile.action}
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}

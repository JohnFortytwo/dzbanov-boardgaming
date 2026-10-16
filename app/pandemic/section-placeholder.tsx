import Link from "next/link";

export function SectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <Link
        href="/pandemic"
        className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
      >
        Zpět na Pandemic
      </Link>
      <p className="mt-8 text-xs font-medium uppercase tracking-[0.28em] text-emerald-400/85">
        Pandemic
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      <article className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur-xl sm:p-10">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
          Rozpracováno
        </span>
        <p className="mt-6 text-base leading-7 text-zinc-400">{description}</p>
      </article>
    </main>
  );
}

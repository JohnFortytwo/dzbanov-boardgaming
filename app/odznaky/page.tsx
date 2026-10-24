import { BadgeBoard } from "./badge-board";

export const metadata = {
  title: "Odznaky | Džbánov Boardgaming",
};

export default function OdznakyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-amber-300/85">
        Modul
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Odznaky
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
        Úspěchy i selhání. Tady jsou odznaky, které už máš.
      </p>
      <BadgeBoard />
    </main>
  );
}

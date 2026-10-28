import Link from "next/link";
import { UserManual } from "@/app/components/UserManual";
import { logout } from "@/app/login/actions";

const accountLinkClass =
  "inline-flex items-center rounded-full border border-emerald-400/30 bg-transparent px-4 py-2 text-xs font-medium text-emerald-300 transition hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-200";

export function AccountLinks() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <UserManual />
      <Link href="/jmeno" className={accountLinkClass}>
        Změnit jméno
      </Link>
      <Link href="/password" className={accountLinkClass}>
        Změnit heslo
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
        >
          Odhlásit se
        </button>
      </form>
    </div>
  );
}

import Link from "next/link";
import { AccountBar } from "@/app/components/account-bar";
import { BrandLogo } from "@/app/components/brand-logo";
import type { TermsChoice } from "@/lib/terms";

export function SiteHeader({
  nickname,
  termsChoice,
  showLogo = true,
}: {
  nickname: string;
  termsChoice: TermsChoice | null;
  showLogo?: boolean;
}) {
  return (
    <header className="relative z-20 flex flex-wrap items-start gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
      {showLogo ? (
        <Link href="/" className="inline-flex shrink-0 rounded-md transition hover:opacity-80">
          <BrandLogo variant="header" />
        </Link>
      ) : null}
      <div className="ml-auto">
        <AccountBar nickname={nickname} termsChoice={termsChoice} />
      </div>
    </header>
  );
}

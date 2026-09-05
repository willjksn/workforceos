import Link from "next/link";

import { BrandMark } from "@/components/branding/brand-mark";

import { AuthControls } from "./auth-controls";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <BrandMark showTagline />
        <AuthControls />
      </div>
      <div>
        <p className="eyebrow">Internal operating system</p>
        <h1 className="page-title mt-3">People. Workforce. Opportunity.</h1>
        <p className="mt-4 max-w-xl text-[16px] leading-7 text-muted-foreground">
          WorkforceOS is the operating system behind PierOne Partners. PostgreSQL remains the system of
          record. Agents draft; people approve.
        </p>
      </div>
      <div className="flex gap-3">
        <Link className="rounded-[6px] bg-navy px-5 py-2.5 text-sm text-white" href="/sign-in">
          Sign in
        </Link>
        <Link className="rounded-[6px] border border-navy px-5 py-2.5 text-sm text-navy" href="/app">
          Open app
        </Link>
      </div>
    </main>
  );
}

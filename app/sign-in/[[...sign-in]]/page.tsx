import { SignIn } from "@clerk/nextjs";

import { BrandMark } from "@/components/branding/brand-mark";

export default function SignInPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (!configured) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <BrandMark showTagline />
        <h1 className="page-title mt-8">Sign in is not configured</h1>
        <p className="mt-4 text-muted-foreground">
          Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> in{" "}
          <code>.env.local</code>, then keep Clerk invite-only.
        </p>
      </main>
    );
  }

  return (
    <main className="grid min-h-full bg-background lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-navy px-8 py-10 text-white lg:px-14 lg:py-14">
        <BrandMark tone="onNavy" showTagline />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#b7d0d8]">PierOne Partners</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight lg:text-5xl">
            People. Workforce. Opportunity.
          </h1>
          <p className="mt-5 max-w-md text-[15px] text-white/75">
            The operating system behind PierOne Partners.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.16em] text-white/50">WorkforceOS · Internal</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <SignIn fallbackRedirectUrl="/app" forceRedirectUrl="/app" />
      </section>
    </main>
  );
}

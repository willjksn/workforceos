import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (!configured) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Sign in is not configured</h1>
        <p className="mt-4 text-zinc-600">
          Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
          <code>CLERK_SECRET_KEY</code> in <code>.env.local</code>, then disable
          public sign-ups in the Clerk Dashboard so WorkforceOS stays invite-only.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-full items-center justify-center py-16">
      <SignIn />
    </main>
  );
}

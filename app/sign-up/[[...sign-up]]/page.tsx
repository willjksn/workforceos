import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (!configured) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Invitations only</h1>
        <p className="mt-4 text-zinc-600">
          WorkforceOS does not allow public registration. Configure Clerk and
          issue invitations from the Dashboard.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-full items-center justify-center py-16">
      <SignUp />
    </main>
  );
}

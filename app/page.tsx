import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Internal operating system</p>
      <h1 className="text-4xl font-semibold tracking-tight">WorkforceOS</h1>
      <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        Foundation phase for CRM, Talent Network, recruiting, military talent,
        workforce development, legal, finance, and internal AI operations.
      </p>
      <div className="flex gap-3">
        <Link
          className="rounded-full bg-foreground px-5 py-3 text-background"
          href="/sign-in"
        >
          Sign in
        </Link>
        <Link className="rounded-full border px-5 py-3" href="/app">
          Open app
        </Link>
      </div>
    </main>
  );
}

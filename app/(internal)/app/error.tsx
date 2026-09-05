"use client";

export default function AppError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-4 text-zinc-600">{error.message}</p>
    </main>
  );
}

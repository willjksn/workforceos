"use client";

export default function ErrorPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground md:py-24">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-4xl text-navy">Something went wrong</h1>
        <p className="mt-4 text-muted">
          Please try again. If you were submitting a form, nothing was recorded unless you received a confirmation.
        </p>
      </div>
    </main>
  );
}

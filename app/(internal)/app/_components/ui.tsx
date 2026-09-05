import Link from "next/link";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="mt-2 text-sm text-zinc-600">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function SearchForm({
  action,
  q,
  placeholder,
}: {
  action: string;
  q?: string;
  placeholder: string;
}) {
  return (
    <form action={action} className="mt-6 flex gap-2">
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
      />
      <button className="rounded border px-4 py-2 text-sm" type="submit">
        Search
      </button>
    </form>
  );
}

export function Field({
  label,
  name,
  children,
}: {
  label: string;
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm" htmlFor={name}>
      <span className="font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClassName =
  "w-full rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

export function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-full bg-foreground px-4 py-2 text-sm text-background" type="submit">
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-sm text-zinc-600">{children}</p>;
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="underline" href={href}>
      {children}
    </Link>
  );
}

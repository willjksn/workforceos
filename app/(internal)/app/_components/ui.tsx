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

export function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function formatLabel(value?: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

export function PhasePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title={title} description={description} />
      <p className="mt-6 text-sm text-zinc-600">Not yet implemented in this phase.</p>
    </main>
  );
}

export function MetricCard({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number | string;
}) {
  return (
    <Link href={href} className="rounded border p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </Link>
  );
}

export function TabNav({
  items,
  activeId,
}: {
  items: Array<{ id: string; href: string; label: string }>;
  activeId: string;
}) {
  return (
    <nav className="mt-6 flex flex-wrap gap-3 border-b pb-2 text-sm">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={item.id === activeId ? "font-semibold" : "text-zinc-600"}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

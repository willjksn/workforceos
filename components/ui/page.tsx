import { buttonClassName } from "./button";
import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  metadata,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  metadata?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title mt-2">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">{description}</p> : null}
        {metadata ? <div className="mt-3 text-sm text-muted-foreground">{metadata}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function PageShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={`app-main mx-auto w-full px-5 py-8 sm:px-8 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
      {children}
    </main>
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
      <span className="font-medium text-navy">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClassName =
  "w-full rounded-[6px] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

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
    <form action={action} className="mt-6 flex flex-wrap gap-2">
      <input name="q" defaultValue={q} placeholder={placeholder} className={`${inputClassName} max-w-md`} />
      <button className={buttonClassName("secondary")} type="submit">
        Search
      </button>
    </form>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-[8px] border border-dashed border-border bg-surface px-5 py-8">
      {title ? <p className="font-medium text-navy">{title}</p> : null}
      <p className={`text-sm text-muted-foreground ${title ? "mt-2" : ""}`}>{children}</p>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={href}>
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
    <PageShell>
      <PageHeader title={title} description={description} />
      <EmptyState title="Not yet implemented in this phase.">
        This module is reserved. Existing records remain in PostgreSQL until the operating workflow is built.
      </EmptyState>
    </PageShell>
  );
}

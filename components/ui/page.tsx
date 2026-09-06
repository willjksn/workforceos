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
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title mt-2">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-[15px] leading-6 text-muted-foreground">{description}</p> : null}
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
    <main className={`app-main mx-auto w-full px-5 py-8 sm:px-8 lg:px-10 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
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
  className = "mt-6",
  queryName = "q",
  submitLabel = "Search",
  children,
}: {
  action: string;
  q?: string;
  placeholder: string;
  className?: string;
  queryName?: string;
  submitLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action={action} className={`flex min-w-[16rem] flex-1 flex-wrap gap-2 ${className}`}>
      <input name={queryName} defaultValue={q} placeholder={placeholder} className={`${inputClassName} max-w-md`} />
      {children}
      <button className={buttonClassName("secondary")} type="submit">
        {submitLabel}
      </button>
    </form>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-[8px] border border-dashed border-border bg-card px-5 py-10 text-center shadow-[var(--shadow-sm)]">
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

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center justify-between gap-3">{children}</div>;
}

export function DataTable({
  columns,
  children,
  className = "mt-6",
}: {
  columns: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-[8px] border border-card-border bg-card shadow-[var(--shadow-card)] ${className}`}>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function CreatePanel({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      className="group mt-8 overflow-hidden rounded-[8px] border border-card-border bg-card shadow-[var(--shadow-sm)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-medium text-navy [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal group-open:hidden">Add</span>
        <span className="hidden text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground group-open:inline">
          Close
        </span>
      </summary>
      <div className="border-t border-border px-5 py-5">
        {description ? <p className="mb-4 text-sm text-muted-foreground">{description}</p> : null}
        {children}
      </div>
    </details>
  );
}

export function RecordList({
  children,
  className = "mt-4",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={`divide-y divide-border overflow-hidden rounded-[8px] border border-card-border bg-card shadow-[var(--shadow-sm)] ${className}`}>
      {children}
    </ul>
  );
}

export function RecordRow({
  href,
  title,
  meta,
  trailing,
}: {
  href?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const body = (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="font-medium text-navy">{title}</p>
        {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="block hover:bg-surface-muted">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
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
        This module is reserved. Existing records remain in WorkforceOS until this workflow is built.
      </EmptyState>
    </PageShell>
  );
}

import Link from "next/link";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`rounded-[8px] border border-card-border bg-card shadow-[var(--shadow-sm)] ${padded ? "p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function MetricCard({
  href,
  label,
  value,
  hint,
}: {
  href?: string;
  label: string;
  value: number | string;
  hint?: string;
}) {
  const inner = (
    <>
      <span className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full bg-teal" aria-hidden />
      <p className="eyebrow">{label}</p>
      <p className="mt-2 break-words font-serif text-[28px] font-semibold leading-none text-navy sm:text-[34px]">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-5 text-muted-foreground">{hint}</p> : null}
    </>
  );
  const className =
    "relative block overflow-hidden rounded-[8px] border border-card-border bg-card py-4 pl-5 pr-5 shadow-[var(--shadow-sm)]";
  if (href) {
    return (
      <Link href={href} className={`${className} transition-colors hover:border-teal`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "navy" | "teal" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-muted text-muted-foreground",
    navy: "bg-[#e7eef3] text-navy",
    teal: "bg-[#dce8ec] text-[#3d6473]",
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    danger: "bg-danger-bg text-danger",
  };
  return (
    <span className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ScoreBadge({ score, band }: { score?: number | null; band?: string | null }) {
  if (score == null && !band) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-baseline gap-2 rounded-[6px] bg-[#e7eef1] px-2.5 py-1 text-navy">
      {score != null ? <span className="font-serif text-2xl font-semibold leading-none">{score}</span> : null}
      {band ? <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-teal">{band.replaceAll("_", " ")}</span> : null}
    </span>
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
    <nav className="mt-6 flex flex-wrap gap-5 border-b border-border text-sm">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`-mb-px border-b-2 pb-2 ${
              active ? "border-navy font-medium text-navy" : "border-transparent text-muted-foreground hover:text-navy"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ProfileSnapshot({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <Card>
      <p className="eyebrow">Profile snapshot</p>
      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold text-navy">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">Completeness measures recorded fields, not candidate quality.</p>
    </Card>
  );
}

export function ActivityTimeline({
  items,
}: {
  items: Array<{ id: string; title: string; meta: string }>;
}) {
  if (items.length === 0) {
    return <EmptyTimeline />;
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="border-l border-border pl-4">
          <p className="text-sm font-medium text-navy">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.meta}</p>
        </li>
      ))}
    </ol>
  );
}

function EmptyTimeline() {
  return <p className="text-sm text-muted-foreground">No activity recorded.</p>;
}

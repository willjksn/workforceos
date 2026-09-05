import Link from "next/link";

const ITEMS = [
  ["/app/military/translator", "Translator"],
  ["/app/military/occupations", "Occupations"],
  ["/app/military/crosswalk", "Crosswalk"],
  ["/app/military/reverse", "Reverse search"],
  ["/app/military/installations", "Installations"],
  ["/app/military/installation-mapping", "Installation mapping"],
  ["/app/military/candidates", "Candidates"],
  ["/app/military/bridge-training", "Bridge training"],
  ["/app/military/review", "Review"],
  ["/app/military/analytics", "Analytics"],
] as const;

export function MilitarySubnav({ active }: { active: string }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-3 border-b border-border pb-3 text-sm">
      {ITEMS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={active === href ? "font-medium text-navy" : "text-muted-foreground hover:text-navy"}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

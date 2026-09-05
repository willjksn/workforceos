import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/military/translator", label: "Translator" },
  { href: "/app/military/occupations", label: "Occupations" },
  { href: "/app/military/crosswalk", label: "Crosswalk" },
  { href: "/app/military/reverse", label: "Reverse search" },
  { href: "/app/military/installations", label: "Installations" },
  { href: "/app/military/installation-mapping", label: "Installation mapping" },
  { href: "/app/military/candidates", label: "Candidates" },
  { href: "/app/military/bridge-training", label: "Bridge training" },
  { href: "/app/military/review", label: "Review" },
  { href: "/app/military/analytics", label: "Analytics" },
] as const;

export function MilitarySubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

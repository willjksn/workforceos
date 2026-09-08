import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/military", label: "Overview" },
  { href: "/app/military/candidates", label: "Transitioning Talent" },
  { href: "/app/military/opportunities", label: "Employer Opportunities" },
  { href: "/app/military/skillbridge", label: "Pathway operations" },
  { href: "/app/military/translator", label: "Skills Translator" },
  { href: "/app/military/occupations", label: "Occupation Library" },
  { href: "/app/military/installation-mapping", label: "Installation Mapping" },
  { href: "/app/military/bridge-training", label: "Bridge Training" },
  { href: "/app/military/analytics", label: "Analytics" },
  { href: "/app/military/crosswalk", label: "Crosswalk" },
  { href: "/app/military/reverse", label: "Reverse search" },
  { href: "/app/military/installations", label: "Installations" },
  { href: "/app/military/review", label: "Review" },
] as const;

export function MilitarySubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

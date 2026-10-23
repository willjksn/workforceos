import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/military", label: "Overview" },
  { href: "/app/talent?channel=military", label: "Talent Network" },
  { href: "/app/military/candidates", label: "Transition Profiles" },
  { href: "/app/military/translator", label: "Capability Translation" },
  { href: "/app/military/review", label: "Mapping Review" },
  { href: "/app/workforce/military-supply", label: "Military Supply" },
] as const;

export function MilitarySubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

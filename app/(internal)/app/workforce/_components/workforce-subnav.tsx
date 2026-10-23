import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/workforce", label: "Overview" },
  { href: "/app/workforce/roles", label: "Roles" },
  { href: "/app/workforce/assessments", label: "Assessments" },
  { href: "/app/workforce/military-supply", label: "Military Supply" },
] as const;

export function WorkforceSubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

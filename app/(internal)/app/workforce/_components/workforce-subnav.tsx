import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/workforce", label: "Overview" },
  { href: "/app/workforce/assessments", label: "Assessments" },
  { href: "/app/workforce/roles", label: "Roles" },
  { href: "/app/workforce/skills", label: "Skills" },
  { href: "/app/workforce/forecasts", label: "Forecasts" },
  { href: "/app/workforce/gaps", label: "Gaps" },
  { href: "/app/workforce/supply", label: "Supply" },
  { href: "/app/workforce/pipelines", label: "Pipelines" },
  { href: "/app/workforce/career-pathways", label: "Pathways" },
  { href: "/app/workforce/training-programs", label: "Training" },
  { href: "/app/workforce/education-partners", label: "Partners" },
  { href: "/app/workforce/apprenticeships", label: "Apprenticeships" },
  { href: "/app/workforce/military-supply", label: "Military" },
  { href: "/app/workforce/scenarios", label: "Scenarios" },
  { href: "/app/workforce/analytics", label: "Analytics" },
] as const;

export function WorkforceSubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

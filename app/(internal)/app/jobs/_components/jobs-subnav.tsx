import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/jobs", label: "Jobs" },
  { href: "/app/recruiting/requisitions", label: "Headcount requests" },
  { href: "/app/search-projects", label: "Internal searches" },
] as const;

export function JobsSubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

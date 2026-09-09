import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/jobs", label: "Jobs" },
  { href: "/app/jobs?view=headcount", label: "Headcount requests" },
  { href: "/app/jobs?view=searches", label: "Internal searches" },
] as const;

export function JobsSubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

export function jobsViewHref(view?: string) {
  if (view === "headcount") return "/app/jobs?view=headcount";
  if (view === "searches") return "/app/jobs?view=searches";
  return "/app/jobs";
}

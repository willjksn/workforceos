import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/ai-operations", label: "Command Center" },
  { href: "/app/ai-operations/review", label: "Review Queue" },
  { href: "/app/ai-operations/runs", label: "Runs" },
  { href: "/app/ai-operations/outputs", label: "Outputs" },
  { href: "/app/ai-operations/automation", label: "Automation" },
  { href: "/app/ai-operations/permissions", label: "Permissions" },
  { href: "/app/ai-operations/prompts", label: "Prompts" },
  { href: "/app/ai-operations/costs", label: "Costs" },
  { href: "/app/ai-operations/failures", label: "Failures" },
  { href: "/app/ai-operations/knowledge", label: "Knowledge" },
] as const;

export function AiSubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

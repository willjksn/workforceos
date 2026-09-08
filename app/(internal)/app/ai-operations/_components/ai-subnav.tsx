import { TabNav } from "@/components/ui/display";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/rbac/permissions";

const ITEMS: Array<{ href: string; label: string; permission: Permission }> = [
  { href: "/app/ai-operations", label: "AI administration", permission: "agents.manage" },
  { href: "/app/ai-operations/review", label: "Review Queue", permission: "agents.read" },
  { href: "/app/ai-operations/runs", label: "Runs", permission: "agents.manage" },
  { href: "/app/ai-operations/outputs", label: "Outputs", permission: "agents.manage" },
  { href: "/app/ai-operations/automation", label: "Automation", permission: "automations.read" },
  { href: "/app/ai-operations/permissions", label: "Permissions", permission: "agents.manage" },
  { href: "/app/ai-operations/prompts", label: "Prompts", permission: "agents.manage" },
  { href: "/app/ai-operations/costs", label: "Costs", permission: "agents.manage" },
  { href: "/app/ai-operations/failures", label: "Failures", permission: "agents.manage" },
  { href: "/app/ai-operations/knowledge", label: "Knowledge", permission: "knowledge.read" },
];

export async function AiSubnav({ active }: { active: string }) {
  const principal = await getCurrentPrincipal();
  const items = ITEMS.filter((item) => principal && can(principal, item.permission)).map((item) => ({
    id: item.href,
    href: item.href,
    label: item.label,
  }));
  if (items.length === 0) return null;
  return <TabNav activeId={active} items={items} />;
}

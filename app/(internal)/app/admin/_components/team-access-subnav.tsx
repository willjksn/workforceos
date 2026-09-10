import { TabNav } from "@/components/ui/display";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/rbac/permissions";

const ITEMS: Array<{ href: string; label: string; permission: Permission }> = [
  { href: "/app/admin/users", label: "People", permission: "admin.users" },
  { href: "/app/admin/roles", label: "Access bundles", permission: "admin.roles" },
  { href: "/app/admin/access-review", label: "Access review", permission: "admin.users" },
];

export async function TeamAccessSubnav({ active }: { active: string }) {
  const principal = await getCurrentPrincipal();
  const items = ITEMS.filter((item) => principal && can(principal, item.permission)).map((item) => ({
    id: item.href,
    href: item.href,
    label: item.label,
  }));
  if (items.length === 0) return null;
  return <TabNav activeId={active} items={items} />;
}

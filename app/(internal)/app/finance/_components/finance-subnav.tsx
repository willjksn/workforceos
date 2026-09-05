import { TabNav } from "@/components/ui/display";

const ITEMS = [
  { href: "/app/finance", label: "Overview" },
  { href: "/app/finance/schedules", label: "Billing Schedules" },
  { href: "/app/finance/revenue", label: "Revenue Events" },
  { href: "/app/finance/invoices", label: "Invoices" },
  { href: "/app/finance/payments", label: "Payments" },
  { href: "/app/finance/ar", label: "Accounts Receivable" },
  { href: "/app/finance/economics", label: "Engagement Economics" },
] as const;

export function FinanceSubnav({ active }: { active: string }) {
  return (
    <TabNav
      activeId={active}
      items={ITEMS.map((item) => ({ id: item.href, href: item.href, label: item.label }))}
    />
  );
}

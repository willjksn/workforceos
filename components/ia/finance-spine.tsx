import Link from "next/link";

import { FINANCE_SPINE } from "@/lib/ia/concepts";

export function FinanceSpine({ activeHref }: { activeHref?: string }) {
  return (
    <ol className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
      {FINANCE_SPINE.map((step, index) => {
        const active = activeHref === step.href;
        return (
          <li key={step.href} className="flex items-center gap-1">
            {index > 0 ? <span className="text-muted-foreground">→</span> : null}
            <Link
              className={active ? "font-medium text-navy" : "text-teal hover:underline"}
              href={step.href}
            >
              {step.label}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

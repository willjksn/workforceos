"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavGroup = {
  label: string;
  items: Array<{ href: string; label: string }>;
};

function isActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  if (href === "/app/talent") {
    return pathname === "/app/talent" || /^\/app\/talent\/[0-9a-f-]{36}/i.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5 text-sm">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {group.label}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded px-2 py-1.5 ${
                      active ? "bg-zinc-100 font-medium dark:bg-zinc-800" : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function MobileAppNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const items = groups.flatMap((group) => group.items);
  return (
    <nav className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm md:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={isActive(item.href, pathname) ? "font-semibold underline" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

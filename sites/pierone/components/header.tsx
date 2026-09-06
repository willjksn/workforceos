"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { PRIMARY_NAV, SOLUTIONS_NAV } from "@/lib/content";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const menuId = useId();
  const solutionsId = useId();

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSolutionsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white">
      <div className="mx-auto flex h-[84px] max-w-6xl items-center justify-between gap-8 px-6">
        <Link href="/" aria-label="PierOne Partners home" className="shrink-0">
          <Logo variant="horizontal" />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-[13px] font-medium text-navy xl:flex">
          {PRIMARY_NAV.map((item) =>
            "hasMenu" in item && item.hasMenu ? (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setSolutionsOpen(true)}
                onMouseLeave={() => setSolutionsOpen(false)}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 whitespace-nowrap hover:text-teal"
                  aria-expanded={solutionsOpen}
                  aria-haspopup="true"
                  aria-controls={solutionsId}
                  onClick={() => setSolutionsOpen((open) => !open)}
                >
                  {item.label}
                  <span aria-hidden="true" className="text-[10px]">
                    ▾
                  </span>
                </button>
                {solutionsOpen ? (
                  <div
                    id={solutionsId}
                    className="absolute left-0 top-full z-50 w-[22rem] border border-border bg-white py-2 shadow-[0_8px_24px_rgba(14,45,74,0.08)]"
                  >
                    {SOLUTIONS_NAV.map((entry) => (
                      <Link
                        key={entry.href}
                        href={entry.href}
                        className="block px-4 py-2.5 text-[13px] leading-5 text-muted hover:bg-background hover:text-navy"
                        onClick={() => setSolutionsOpen(false)}
                      >
                        {entry.label}
                      </Link>
                    ))}
                    <Link
                      href="/what-we-do"
                      className="mt-1 block border-t border-border px-4 py-2.5 text-[13px] text-navy"
                      onClick={() => setSolutionsOpen(false)}
                    >
                      View all solutions
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-teal">
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="hidden rounded-[6px] bg-navy px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-teal sm:inline-flex"
          >
            Work With PierOne
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-border text-navy xl:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <span className="text-lg leading-none" aria-hidden="true">
                ×
              </span>
            ) : (
              <span className="flex flex-col gap-1.5" aria-hidden="true">
                <span className="block h-px w-4 bg-navy" />
                <span className="block h-px w-4 bg-navy" />
                <span className="block h-px w-4 bg-navy" />
              </span>
            )}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div id={menuId} className="border-t border-border bg-white xl:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-6xl space-y-1 px-6 py-5">
            {PRIMARY_NAV.map((item) =>
              "hasMenu" in item && item.hasMenu ? (
                <div key={item.href} className="py-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-teal">{item.label}</div>
                  <div className="mt-2 space-y-1">
                    {SOLUTIONS_NAV.map((entry) => (
                      <Link
                        key={entry.href}
                        href={entry.href}
                        className="block py-2 text-sm text-navy"
                        onClick={() => setMenuOpen(false)}
                      >
                        {entry.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block py-2.5 text-sm text-navy"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ),
            )}
            <Link
              href="/contact"
              className="mt-3 inline-flex rounded-[6px] bg-navy px-4 py-2.5 text-sm font-medium text-white"
              onClick={() => setMenuOpen(false)}
            >
              Work With PierOne
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

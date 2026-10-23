"use client";

import { useId, useState } from "react";

import { BrandImage } from "@/components/media/brand-image";
import type { INDUSTRY_TILES } from "@/lib/images";

type Tile = (typeof INDUSTRY_TILES)[number];

export function IndustryGrid({
  tiles,
  summaries,
}: {
  tiles: readonly Tile[];
  summaries: Record<string, string>;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="mt-8 grid gap-5 md:grid-cols-2">
      {tiles.map((tile) => {
        const isOpen = open === tile.name;
        const panelId = `${baseId}-${tile.name.replace(/\s+/g, "-")}`;
        return (
          <li key={tile.name} className="overflow-hidden rounded-[6px] border border-border bg-white">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : tile.name)}
              className="w-full text-left"
            >
              <BrandImage image={tile.image} overlay radius={false} sizes="(min-width: 768px) 40vw, 100vw" />
              <span className="flex items-center justify-between gap-4 px-5 py-4">
                <span className={tile.emphasis === "primary" ? "font-serif text-xl text-navy" : "text-navy"}>
                  {tile.name}
                </span>
                <span className="text-sm text-teal" aria-hidden="true">
                  {isOpen ? "Close" : "Read"}
                </span>
              </span>
            </button>
            {isOpen ? (
              <p id={panelId} className="border-t border-border px-5 pb-5 pt-4 text-[15px] leading-7 text-muted">
                {summaries[tile.name]}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

import Link from "next/link";

import { getAcademyArticle } from "@/lib/academy/catalog";
import { academyArticleHref } from "@/lib/academy/types";

export function AcademyHelp({
  articleSlug,
  className = "",
}: {
  articleSlug: string;
  className?: string;
}) {
  const article = getAcademyArticle(articleSlug);
  if (!article) return null;

  return (
    <details className={`relative ${className}`}>
      <summary className="cursor-pointer list-none rounded-[6px] border border-border bg-surface px-3 py-1.5 text-sm font-medium text-navy hover:border-teal">
        ? Help
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-[8px] border border-card-border bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal">Academy</p>
        <p className="mt-2 text-sm font-medium text-navy">{article.title}</p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{article.summary}</p>
        <Link
          className="mt-3 inline-block text-sm font-medium text-teal underline decoration-border underline-offset-4 hover:decoration-teal"
          href={academyArticleHref(article.slug)}
        >
          Open Full Guide
        </Link>
      </div>
    </details>
  );
}

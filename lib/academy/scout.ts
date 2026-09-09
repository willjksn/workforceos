import { searchAcademyArticles } from "./catalog";
import { academyArticleHref } from "./types";

export function academyScoutCards(query: string) {
  return searchAcademyArticles(query).map((article) => ({
    type: "knowledge" as const,
    id: article.slug,
    title: article.title,
    href: academyArticleHref(article.slug),
    meta: `Academy · ${article.section.replaceAll("-", " ")}`,
    fields: { source: article.sources[0] ?? "Academy" },
  }));
}

export function academyHrefPattern() {
  return /^\/app\/academy\/[a-z0-9-]+$/;
}

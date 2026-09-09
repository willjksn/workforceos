import Link from "next/link";

import { OPERATING_CONCEPTS } from "@/lib/ia/concepts";
import { academyArticleHref } from "@/lib/academy/types";

type ConceptKey = keyof typeof OPERATING_CONCEPTS;

export function ConceptNote({
  concept,
  className = "mt-3",
}: {
  concept: ConceptKey;
  className?: string;
}) {
  const item = OPERATING_CONCEPTS[concept];
  return (
    <p className={`${className} text-sm text-muted-foreground`}>
      <span className="font-medium text-navy">{item.title}. </span>
      {item.body}{" "}
      <Link className="font-medium text-teal hover:underline" href={academyArticleHref(item.academySlug)}>
        Academy
      </Link>
    </p>
  );
}

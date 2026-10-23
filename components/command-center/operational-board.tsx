import type { OperationalCommandCenter } from "@/lib/command-center/compose";

export function OperationalBoard({ board }: { board: OperationalCommandCenter }) {
  return (
    <div className="mt-8 space-y-10">
      <p className="text-sm text-muted-foreground">As of {new Date(board.generatedAt).toLocaleString()}.</p>
      {board.sections.map((section) => (
        <section key={section.id} aria-labelledby={`command-${section.id}`}>
          <h2 id={`command-${section.id}`} className="text-lg font-semibold text-navy">
            {section.title}
          </h2>
          {section.error ? (
            <p role="alert" className="mt-2 text-sm text-navy">
              Unable to load this data. {section.error}
            </p>
          ) : null}
          {section.status === "error" ? null : section.items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{section.emptyLabel}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {section.items.map((item) => (
                <li key={`${section.id}-${item.type}`}>
                  <a className="font-medium text-navy underline" href={item.href}>
                    {item.count == null ? item.title : `${item.count} ${item.title}`}
                  </a>
                  <span className="text-sm text-muted-foreground"> — {item.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

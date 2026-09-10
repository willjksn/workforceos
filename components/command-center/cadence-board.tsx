import { Card } from "@/components/ui/display";
import { EmptyState, RecordList, RecordRow, SectionHeader } from "@/components/ui/page";
import type { RhythmBoard, RhythmWidget } from "@/lib/reporting/operating-rhythms";

function WidgetCard({ widget }: { widget: RhythmWidget }) {
  return (
    <Card>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal">Live aggregate</p>
      <p className="mt-2 text-sm font-medium text-navy">{widget.question}</p>
      <p className="mt-3 font-serif text-[34px] font-semibold leading-none text-navy">{widget.value}</p>
      {widget.windowHint ? <p className="mt-2 text-xs text-muted-foreground">{widget.windowHint}</p> : null}
      <p className="mt-3">
        <a className="text-sm font-medium text-teal hover:underline" href={widget.href}>
          {widget.ctaLabel ?? "Open linked screen"}
        </a>
      </p>
      {widget.exceptions.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Needs attention</p>
          <RecordList>
            {widget.exceptions.map((item) => (
              <RecordRow key={item.id} href={item.href} title={item.title} meta={item.meta} />
            ))}
          </RecordList>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">None listed on this card. Use the linked screen for the working list.</p>
      )}
    </Card>
  );
}

export function CadenceBoard({ board }: { board: RhythmBoard }) {
  return (
    <section className="mt-8">
      <SectionHeader title={board.title} description={board.summary} />
      {board.widgets.length === 0 ? (
        <EmptyState title="No authorized widgets on this review board.">
          Access comes from PostgreSQL bundles, not job title. Recruiter Standard does not see the commercial opportunity pipeline.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {board.widgets.map((widget) => (
            <WidgetCard key={widget.id} widget={widget} />
          ))}
        </div>
      )}
    </section>
  );
}

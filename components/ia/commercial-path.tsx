import { COMMERCIAL_PATH_STEPS, currentCommercialStepIndex, type CommercialPathRecord } from "@/lib/delivery/commercial-path";

export function CommercialPath({
  path,
  className = "mt-4",
}: {
  path: CommercialPathRecord;
  className?: string;
}) {
  const current = currentCommercialStepIndex(path);
  return (
    <ol className={`${className} flex flex-wrap gap-x-1 gap-y-2 text-xs`}>
      {COMMERCIAL_PATH_STEPS.map((step, index) => {
        const reached = index <= current;
        return (
          <li key={step.id} className="flex items-center gap-1">
            {index > 0 ? <span className="text-muted-foreground">→</span> : null}
            <span className={reached ? "font-medium text-navy" : "text-muted-foreground"}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

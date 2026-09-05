import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "../_components/ui";

export default function WorkforcePlaceholderPage() {
  return (
    <PageShell>
      <PageHeader
        title="Workforce"
        description="Full workforce intelligence is Phase 5. Workforce Pipeline Assessment delivery is available through the service engine."
        actions={<ButtonLink href="/app/services/workforce-pipeline-assessment">Open Workforce Pipeline Assessment</ButtonLink>}
      />
    </PageShell>
  );
}

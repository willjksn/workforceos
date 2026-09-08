import { ActionForm } from "@/app/(internal)/app/_components/action-form";
import { Field, PrimaryButton, inputClassName } from "@/app/(internal)/app/_components/ui";
import { createPublicContentAction, updatePublicContentAction } from "@/lib/actions/public-content";
import {
  PUBLIC_CONTENT_PLACEMENTS,
  PUBLIC_CONTENT_STYLES,
  PUBLIC_CONTENT_TYPE_LABELS,
  PUBLIC_CONTENT_TYPES,
  PUBLIC_INDUSTRY_CODES,
  type PublicContentType,
} from "@/lib/public-content/types";

function dt(value?: Date | null) {
  if (!value) return "";
  const iso = new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString();
  return iso.slice(0, 16);
}

export function PublicContentForm({
  item,
  jobs,
  defaultType,
  canPublish,
}: {
  item?: {
    id: string;
    contentType: PublicContentType;
    title: string;
    body: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    linkedJobId: string | null;
    industryCode: string | null;
    placement: string;
    styleVariant: string | null;
    featureImageKey: string | null;
    priority: number;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
  };
  jobs: Array<{ jobId: string; title: string; slug: string; skillbridgeEligible: boolean }>;
  defaultType?: PublicContentType;
  canPublish: boolean;
}) {
  const action = item ? updatePublicContentAction : createPublicContentAction;
  const type = item?.contentType ?? defaultType ?? "homepage_banner";
  return (
    <ActionForm action={action} className="mt-6 grid gap-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <Field label="Type" name="contentType">
        <select name="contentType" defaultValue={type} className={inputClassName} required>
          {PUBLIC_CONTENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {PUBLIC_CONTENT_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title / headline" name="title">
        <input name="title" defaultValue={item?.title ?? ""} required maxLength={160} className={inputClassName} />
      </Field>
      <Field label="Short copy" name="body">
        <textarea name="body" defaultValue={item?.body ?? ""} rows={4} maxLength={800} className={inputClassName} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CTA label" name="ctaLabel">
          <input name="ctaLabel" defaultValue={item?.ctaLabel ?? ""} maxLength={60} className={inputClassName} />
        </Field>
        <Field label="CTA URL or path" name="ctaUrl">
          <input name="ctaUrl" defaultValue={item?.ctaUrl ?? ""} placeholder="/careers" maxLength={300} className={inputClassName} />
        </Field>
      </div>
      <Field label="Linked published job" name="linkedJobId">
        <select name="linkedJobId" defaultValue={item?.linkedJobId ?? ""} className={inputClassName}>
          <option value="">None</option>
          {jobs.map((job) => (
            <option key={job.jobId} value={job.jobId}>
              {job.title}
              {job.skillbridgeEligible ? " (SkillBridge-eligible)" : ""} — {job.slug}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Placement" name="placement">
          <select name="placement" defaultValue={item?.placement ?? "home"} className={inputClassName}>
            {PUBLIC_CONTENT_PLACEMENTS.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Style" name="styleVariant">
          <select name="styleVariant" defaultValue={item?.styleVariant ?? "navy"} className={inputClassName}>
            {PUBLIC_CONTENT_STYLES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Industry" name="industryCode">
          <select name="industryCode" defaultValue={item?.industryCode ?? ""} className={inputClassName}>
            <option value="">None</option>
            {PUBLIC_INDUSTRY_CODES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority (lower appears first)" name="priority">
          <input name="priority" type="number" min={1} max={999} defaultValue={item?.priority ?? 100} className={inputClassName} />
        </Field>
      </div>
      <Field label="Optional image path" name="featureImageKey">
        <input
          name="featureImageKey"
          defaultValue={item?.featureImageKey ?? ""}
          placeholder="/images/placeholders/industry-energy.jpg"
          className={inputClassName}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" name="startsAt">
          <input name="startsAt" type="datetime-local" defaultValue={dt(item?.startsAt)} className={inputClassName} />
        </Field>
        <Field label="Ends" name="endsAt">
          <input name="endsAt" type="datetime-local" defaultValue={dt(item?.endsAt)} className={inputClassName} />
        </Field>
      </div>
      {canPublish ? (
        <label className="flex items-center gap-2 text-sm text-navy">
          <input type="checkbox" name="isActive" defaultChecked={item?.isActive} />
          Active (eligible to appear while dates allow)
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">Activation requires public_content.publish. This will save as a draft.</p>
      )}
      <PrimaryButton>{item ? "Save" : "Create"}</PrimaryButton>
    </ActionForm>
  );
}

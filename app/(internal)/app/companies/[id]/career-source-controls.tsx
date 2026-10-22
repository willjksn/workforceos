"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  confirmCsvAction,
  confirmManualJobAction,
  createCareerSourceAction,
  previewCsvAction,
  previewManualJobAction,
  syncCareerSourceAction,
  testCareerSourceAction,
  type CareerActionState,
} from "@/lib/actions/career-sources";
import { PrimaryButton } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/page";

export function AddCareerSourceForm({ companyId }: { companyId: string }) {
  return (
    <ActionBlock action={createCareerSourceAction} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="block text-sm">
        <span className="text-muted-foreground">Name</span>
        <input className={inputClassName} name="name" required maxLength={200} />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Source type</span>
        <select className={inputClassName} name="sourceType" defaultValue="manual_url">
          <option value="manual_url">Manual URL</option>
          <option value="csv">CSV</option>
          <option value="employer_api">Greenhouse public board</option>
          <option value="public_careers_page">Public careers page</option>
          <option value="feed">Feed (manual until a later adapter)</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Careers URL or Greenhouse board URL</span>
        <input className={inputClassName} name="careersUrl" placeholder="https://boards.greenhouse.io/example" />
      </label>
      <p className="text-xs text-muted-foreground">
        Automated sync runs only for a Greenhouse public board. Other URLs are not crawled. No employer login is required.
      </p>
      <PrimaryButton>Add career source</PrimaryButton>
    </ActionBlock>
  );
}

export function CareerSourceActions({
  companyId,
  sourceId,
  sourceType,
}: {
  companyId: string;
  sourceId: string;
  sourceType: string;
}) {
  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-wrap gap-2">
        <ActionBlock action={testCareerSourceAction}>
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="careerSourceId" value={sourceId} />
          <button className="text-sm underline" type="submit">Test source</button>
        </ActionBlock>
        {sourceType === "employer_api" ? (
          <ActionBlock action={syncCareerSourceAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="careerSourceId" value={sourceId} />
            <button className="text-sm underline" type="submit">Run sync</button>
          </ActionBlock>
        ) : null}
      </div>
      {sourceType === "manual_url" || sourceType === "public_careers_page" ? <ManualImport companyId={companyId} sourceId={sourceId} /> : null}
      {sourceType === "csv" ? <CsvImport companyId={companyId} sourceId={sourceId} /> : null}
    </div>
  );
}

function ManualImport({ companyId, sourceId }: { companyId: string; sourceId: string }) {
  const [state, action] = useActionState(previewManualJobAction, {} as CareerActionState);
  const [confirmed, setConfirmed] = useState(false);
  const preview = state.preview?.sourceId === sourceId ? state.preview : null;
  useEffect(() => {
    setConfirmed(false);
  }, [preview?.sourceUrl, preview?.externalKey]);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="careerSourceId" value={sourceId} />
        <label className="block text-sm">
          <span className="text-muted-foreground">Public job URL</span>
          <input className={inputClassName} name="sourceUrl" type="url" required placeholder="https://example.com/jobs/123" />
        </label>
        <button className="text-sm underline" type="submit">Preview page</button>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state.message && !confirmed ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
      </form>
      {preview ? (
        <ActionBlock action={confirmManualJobAction} className="space-y-2 rounded-[8px] border border-card-border p-3" onSuccess={() => setConfirmed(true)}>
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="careerSourceId" value={sourceId} />
          <p className="text-xs text-muted-foreground">Confirming saves one canonical job. It does not score or contact anyone.</p>
          <label className="block text-sm">Title<input className={inputClassName} name="title" required defaultValue={preview.title} /></label>
          <label className="block text-sm">External key<input className={inputClassName} name="externalKey" required defaultValue={preview.externalKey} /></label>
          <label className="block text-sm">Source URL<input className={inputClassName} name="sourceUrl" required defaultValue={preview.sourceUrl} /></label>
          <label className="block text-sm">Location<input className={inputClassName} name="location" defaultValue={preview.location} /></label>
          <label className="block text-sm">Department<input className={inputClassName} name="department" defaultValue={preview.department} /></label>
          <label className="block text-sm">Employment type<input className={inputClassName} name="employmentType" defaultValue={preview.employmentType} /></label>
          <label className="block text-sm">Workplace<input className={inputClassName} name="workplaceType" defaultValue={preview.workplaceType} /></label>
          <label className="block text-sm">Public salary text<input className={inputClassName} name="publicSalaryText" defaultValue={preview.publicSalaryText} /></label>
          <label className="block text-sm">Description<textarea className={inputClassName} name="description" rows={5} defaultValue={preview.description} /></label>
          <PrimaryButton>Confirm job</PrimaryButton>
        </ActionBlock>
      ) : null}
    </div>
  );
}

function CsvImport({ companyId, sourceId }: { companyId: string; sourceId: string }) {
  const [state, action] = useActionState(previewCsvAction, {} as CareerActionState);
  const [confirmed, setConfirmed] = useState(false);
  const preview = state.csvPreview?.sourceId === sourceId ? state.csvPreview : null;
  useEffect(() => {
    setConfirmed(false);
  }, [preview?.csvText]);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="careerSourceId" value={sourceId} />
        <label className="block text-sm">
          <span className="text-muted-foreground">CSV</span>
          <textarea className={inputClassName} name="csvText" rows={5} required placeholder={"external_id,title,location,description,source_url,open\n"} />
        </label>
        <button className="text-sm underline" type="submit">Preview CSV</button>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state.message && !confirmed ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
      </form>
      {preview ? (
        <ActionBlock action={confirmCsvAction} className="space-y-2" onSuccess={() => setConfirmed(true)}>
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="careerSourceId" value={sourceId} />
          <input type="hidden" name="confirm" value="yes" />
          <textarea className="hidden" name="csvText" readOnly defaultValue={preview.csvText} />
          <p className="text-sm">{preview.validCount} valid rows.</p>
          <ul className="text-sm">
            {preview.sample.map((row) => (
              <li key={row.externalKey}>{row.title} · {row.externalKey}{row.closed ? " · closed" : ""}</li>
            ))}
          </ul>
          {preview.errors.length ? (
            <ul className="text-sm text-danger">
              {preview.errors.map((issue) => (
                <li key={`${issue.row}-${issue.message}`}>Row {issue.row}: {issue.message}</li>
              ))}
            </ul>
          ) : null}
          <PrimaryButton>Confirm CSV import</PrimaryButton>
        </ActionBlock>
      ) : null}
    </div>
  );
}

function ActionBlock({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (state: CareerActionState, formData: FormData) => Promise<CareerActionState>;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, {} as CareerActionState);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  useEffect(() => {
    if (state.message) onSuccessRef.current?.();
  }, [state.message]);
  return (
    <form action={formAction} className={className}>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
      {children}
    </form>
  );
}

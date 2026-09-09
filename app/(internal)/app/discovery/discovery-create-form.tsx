"use client";

import { useMemo, useState } from "react";

import { createDiscoveryAction } from "@/lib/actions/delivery";
import { ActionForm } from "../_components/action-form";
import { Field, PrimaryButton, inputClassName } from "../_components/ui";

type Question = { key: string; label: string; required?: boolean };

export function DiscoveryCreateForm({
  services,
  companies,
  opportunities,
  questionsByService,
  defaultCompanyId,
  defaultOpportunityId,
  defaultServiceCode,
  defaultTitle,
}: {
  services: Array<{ code: string; name: string }>;
  companies: Array<{ id: string; name: string }>;
  opportunities: Array<{ id: string; label: string; serviceCode?: string | null }>;
  questionsByService: Record<string, Question[]>;
  defaultCompanyId?: string;
  defaultOpportunityId?: string;
  defaultServiceCode?: string;
  defaultTitle?: string;
}) {
  const [serviceCode, setServiceCode] = useState(
    defaultServiceCode && services.some((service) => service.code === defaultServiceCode)
      ? defaultServiceCode
      : (services[0]?.code ?? ""),
  );
  const questions = useMemo(
    () => questionsByService[serviceCode] ?? [],
    [questionsByService, serviceCode],
  );

  return (
    <ActionForm action={createDiscoveryAction} className="grid gap-3 md:grid-cols-2">
      <Field label="Company" name="companyId">
        <select className={inputClassName} id="companyId" name="companyId" required defaultValue={defaultCompanyId}>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Opportunity" name="opportunityId">
        <select className={inputClassName} id="opportunityId" name="opportunityId" required defaultValue={defaultOpportunityId}>
          {opportunities.map((opportunity) => (
            <option key={opportunity.id} value={opportunity.id}>
              {opportunity.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Recommended service" name="serviceCode">
        <select
          className={inputClassName}
          id="serviceCode"
          name="serviceCode"
          required
          value={serviceCode}
          onChange={(event) => setServiceCode(event.target.value)}
        >
          {services.map((service) => (
            <option key={service.code} value={service.code}>
              {service.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title" name="title">
        <input className={inputClassName} id="title" name="title" required defaultValue={defaultTitle} />
      </Field>
      {questions.map((question) => (
        <Field key={`${serviceCode}-${question.key}`} label={question.label} name={`answer.${question.key}`}>
          <input
            className={inputClassName}
            id={`answer.${question.key}`}
            name={`answer.${question.key}`}
            required={question.required}
          />
        </Field>
      ))}
      <div className="md:col-span-2">
        <PrimaryButton>Create discovery</PrimaryButton>
      </div>
    </ActionForm>
  );
}

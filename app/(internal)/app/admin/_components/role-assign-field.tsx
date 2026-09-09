"use client";

import { startTransition, useActionState, useState } from "react";
import { ChevronDown } from "lucide-react";

type ActionState = { error?: string; ok?: boolean; roleSlug?: string };
type AccessStatus = "active" | "invited" | "disabled";

const selectClassName =
  "w-full cursor-pointer appearance-none border-0 border-b border-transparent bg-transparent py-1 pr-6 text-sm text-navy hover:border-border focus:border-navy focus-visible:outline-none disabled:cursor-wait disabled:text-muted-foreground";

function submitFormAction(
  formAction: (payload: FormData) => void,
  fields: Record<string, string>,
) {
  const payload = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    payload.set(key, value);
  }
  startTransition(() => {
    formAction(payload);
  });
}

export function RoleAssignField({
  userId,
  fullName,
  currentSlug,
  roles,
  action,
}: {
  userId: string;
  fullName: string;
  currentSlug: string;
  roles: Array<{ id: string; slug: string; name: string }>;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [optimisticSlug, setOptimisticSlug] = useState<string | null>(null);
  const committed = state.roleSlug ?? currentSlug;
  const value = pending && optimisticSlug != null
    ? optimisticSlug
    : state.error
      ? currentSlug
      : committed;

  return (
    <div className="max-w-[16rem]">
      <div className="relative">
        <select
          value={value}
          disabled={pending}
          aria-label={`Access bundle for ${fullName}`}
          className={selectClassName}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setOptimisticSlug(next);
            if (next === committed) return;
            submitFormAction(formAction, { userId, roleSlug: next });
          }}
        >
          {!value ? (
            <option value="" disabled>
              Assign an access bundle
            </option>
          ) : null}
          {roles.map((role) => (
            <option key={role.id} value={role.slug}>
              {role.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      {pending ? <p className="mt-1 text-[11px] text-muted-foreground">Saving…</p> : null}
      {state.error ? <p className="mt-1 text-[11px] text-danger">{state.error}</p> : null}
    </div>
  );
}

export function UserStatusField({
  userId,
  fullName,
  status,
  action,
}: {
  userId: string;
  fullName: string;
  status: AccessStatus;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [optimisticStatus, setOptimisticStatus] = useState<AccessStatus | null>(null);
  const value = pending && optimisticStatus
    ? optimisticStatus
    : state.error
      ? status
      : (optimisticStatus ?? status);

  return (
    <div className="max-w-[10rem]">
      <div className="relative">
        <select
          value={value}
          disabled={pending}
          aria-label={`Access for ${fullName}`}
          className={selectClassName}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (next === "archived") {
              submitFormAction(formAction, { userId, status: next });
              return;
            }
            if (next !== "active" && next !== "invited" && next !== "disabled") return;
            setOptimisticStatus(next);
            if (next === status) return;
            submitFormAction(formAction, { userId, status: next });
          }}
        >
          {status === "invited" ? <option value="invited">Invited</option> : null}
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="archived">Archived</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      {pending ? <p className="mt-1 text-[11px] text-muted-foreground">Saving…</p> : null}
      {state.error ? <p className="mt-1 text-[11px] text-danger">{state.error}</p> : null}
    </div>
  );
}

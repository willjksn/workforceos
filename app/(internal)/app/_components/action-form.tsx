"use client";

import { useActionState } from "react";

type ActionState = { error?: string; message?: string; url?: string };

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
      {state.url ? (
        <p className="text-sm text-muted-foreground">
          Public link: <a className="text-navy underline" href={state.url}>{state.url}</a>
        </p>
      ) : null}
      {children}
    </form>
  );
}

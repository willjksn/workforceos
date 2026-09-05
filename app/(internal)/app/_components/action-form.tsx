"use client";

import { useActionState } from "react";

type ActionState = { error?: string };

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
      {children}
    </form>
  );
}

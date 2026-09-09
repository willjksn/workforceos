"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: boolean };

export function PublicActionForm({
  action,
  children,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="border border-[#DCE2E7] bg-white p-4">
      {state.error ? <p className="mb-2 text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? <p className="mb-2 text-sm text-teal-800">Saved.</p> : null}
      {children}
    </form>
  );
}

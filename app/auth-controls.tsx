"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function AuthControls() {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Show when="signed-out">
        <SignInButton>
          <button className="rounded-[6px] bg-navy px-3 py-1.5 text-white" type="button">
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}

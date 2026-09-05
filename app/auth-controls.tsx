"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function AuthControls() {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Show when="signed-out">
        <SignInButton>
          <button className="rounded-full bg-foreground px-4 py-2 text-background">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton>
          <button className="rounded-full border px-4 py-2">Sign up</button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}

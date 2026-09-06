"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

export function useClientMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

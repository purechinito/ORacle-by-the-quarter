import { useRef } from "react";
import { api, actorId } from "./api";
import { createPosting } from "./posting";
export function usePosting(scope: string) {
  const storageKey = "quarter:pending:" + actorId + ":" + scope;
  const ref = useRef<ReturnType<typeof createPosting> | null>(null);
  if (!ref.current)
    ref.current = createPosting(api, {
      get: () => sessionStorage.getItem(storageKey),
      set: (value) => sessionStorage.setItem(storageKey, value),
      clear: () => sessionStorage.removeItem(storageKey),
    });
  return ref.current;
}
export function hasPendingPosting(scope: string) {
  return (
    sessionStorage.getItem("quarter:pending:" + actorId + ":" + scope) !== null
  );
}

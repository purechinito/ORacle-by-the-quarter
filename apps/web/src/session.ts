import { useRef, useState, type SetStateAction } from "react";
import { actorId } from "./api";
export function sessionStore(scope: string) {
  const key = "quarter:" + actorId + ":" + scope;
  return {
    get: () => sessionStorage.getItem(key),
    set: (value: string) => sessionStorage.setItem(key, value),
    clear: () => sessionStorage.removeItem(key),
  };
}
export function useSessionState<T>(scope: string, initial: T) {
  const store = sessionStore("cart:" + scope);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = store.get();
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  const current = useRef(value);
  function update(next: SetStateAction<T>) {
    const result =
      typeof next === "function"
        ? (next as (p: T) => T)(current.current)
        : next;
    store.set(JSON.stringify(result));
    current.current = result;
    setValue(result);
  }
  return [value, update] as const;
}

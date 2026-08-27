import { useCallback, useEffect, useRef } from "react";
import { SEARCH_DEBOUNCE_MS } from "../constants/limits";

export { SEARCH_DEBOUNCE_MS };

/**
 * Trailing debounce that always calls the latest callback.
 * `flush` runs immediately (Enter / empty-clear). `flushPending` only
 * fires if a timer is still waiting (blur-safe). `cancel` on unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number = SEARCH_DEBOUNCE_MS,
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Args | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingArgsRef.current = null;
  }, []);

  const flush = useCallback(
    (...args: Args) => {
      cancel();
      callbackRef.current(...args);
    },
    [cancel],
  );

  const flushPending = useCallback(() => {
    if (!timerRef.current) return;
    const args = pendingArgsRef.current;
    cancel();
    if (args) callbackRef.current(...args);
  }, [cancel]);

  const run = useCallback(
    (...args: Args) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingArgsRef.current = args;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (pending) callbackRef.current(...pending);
      }, delayMs);
    },
    [delayMs],
  );

  useEffect(() => cancel, [cancel]);

  return { run, flush, flushPending, cancel };
}

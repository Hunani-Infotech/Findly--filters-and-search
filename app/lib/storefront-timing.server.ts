import { AsyncLocalStorage } from "node:async_hooks";
import { log } from "./log.server";

type StorefrontTimingMarks = Record<string, number>;

function timingEnabled() {
  return process.env.STOREFRONT_TIMING !== "0";
}

type TimingStore = {
  route: string;
  started: number;
  marks: StorefrontTimingMarks;
};

const als = new AsyncLocalStorage<TimingStore>();

function roundMs(ms: number): number {
  return Math.round(ms * 10) / 10;
}

/**
 * Lightweight server-side timing for App Proxy storefront routes.
 * Reuses existing `log` — no new logging library.
 */
export function createStorefrontTimer(route: string) {
  const store: TimingStore = {
    route,
    started: performance.now(),
    marks: {},
  };

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      return als.run(store, fn);
    },
    mark(name: string, startedAt: number) {
      store.marks[name] = roundMs(performance.now() - startedAt);
    },
    async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const t0 = performance.now();
      try {
        return await fn();
      } finally {
        store.marks[name] = roundMs(performance.now() - t0);
      }
    },
    finish(extra?: Record<string, unknown>) {
      const totalMs = roundMs(performance.now() - store.started);
      if (timingEnabled()) {
        log.info(`[storefront-timing] ${route}`, {
          totalMs,
          ...store.marks,
          ...extra,
        });
      }
      return { totalMs, marks: { ...store.marks } };
    },
  };
}

export async function measureStorefrontStep<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const store = als.getStore();
  if (!store) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    store.marks[name] = roundMs(performance.now() - t0);
  }
}

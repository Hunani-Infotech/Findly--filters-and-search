/** Short-lived in-process cache for Tokyo-latency GET loaders. */

/**
 * Soft-TTL stale-while-revalidate cache.
 * After `ttlMs`, `wrap` still returns the last value immediately and refreshes
 * in the background. Only a true miss (never cached / deleted) blocks on load.
 */
export function createTtlCache<T>(ttlMs: number) {
  const store = new Map<string, { value: T; freshUntil: number }>();
  const inflight = new Map<string, Promise<T>>();

  function set(key: string, value: T) {
    store.set(key, { value, freshUntil: Date.now() + ttlMs });
  }

  function del(key: string) {
    store.delete(key);
    inflight.delete(key);
  }

  function deletePrefix(prefix: string) {
    for (const key of [...store.keys()]) {
      if (key.startsWith(prefix)) store.delete(key);
    }
    for (const key of [...inflight.keys()]) {
      if (key.startsWith(prefix)) inflight.delete(key);
    }
  }

  function revalidateInBackground(key: string, load: () => Promise<T>) {
    if (inflight.has(key)) return;
    const promise = load()
      .then((value) => {
        set(key, value);
        inflight.delete(key);
        return value;
      })
      .catch((error) => {
        inflight.delete(key);
        throw error;
      });
    inflight.set(key, promise);
    void promise.catch(() => {
      /* keep serving stale; next request can retry refresh */
    });
  }

  async function wrap(key: string, load: () => Promise<T>): Promise<T> {
    const hit = store.get(key);
    if (hit) {
      if (hit.freshUntil <= Date.now()) {
        revalidateInBackground(key, load);
      }
      return hit.value;
    }
    const pending = inflight.get(key);
    if (pending) return pending;
    const promise = load()
      .then((value) => {
        set(key, value);
        inflight.delete(key);
        return value;
      })
      .catch((error) => {
        inflight.delete(key);
        throw error;
      });
    inflight.set(key, promise);
    return promise;
  }

  return { wrap, del, deletePrefix };
}

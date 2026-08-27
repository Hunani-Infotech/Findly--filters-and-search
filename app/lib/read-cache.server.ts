/** Short-lived in-process cache for Tokyo-latency GET loaders. */

export function createTtlCache<T>(ttlMs: number) {
  const store = new Map<string, { value: T; expires: number }>();
  const inflight = new Map<string, Promise<T>>();

  function get(key: string): T | undefined {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key: string, value: T) {
    store.set(key, { value, expires: Date.now() + ttlMs });
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

  async function wrap(key: string, load: () => Promise<T>): Promise<T> {
    const hit = get(key);
    if (hit !== undefined) return hit;
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

  return { get, set, del, deletePrefix, wrap };
}

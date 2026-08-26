/**
 * Parallel job slots for the BullMQ sync worker (one process, N concurrent jobs).
 * Set WORKER_COUNT in env — used by in-process (Hostinger / `npm start`) and
 * by `npm run worker` / the worker child from `npm run dev`.
 */
const DEFAULT_COUNT = 2;
const MAX_COUNT = 32;

export function getWorkerCount(): number {
  const raw = process.env.WORKER_COUNT?.trim();
  if (!raw) return DEFAULT_COUNT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_COUNT;
  return Math.min(n, MAX_COUNT);
}

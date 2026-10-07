// One place for outbound request timeouts. A slow or hung organizer site must not hold up the
// whole collection run (or a serverless function), so every fetch gets a 20-second limit that
// covers connecting and reading the body.
export const FETCH_TIMEOUT_MS = 20_000;

export function fetchWithTimeout(input: string | URL, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  timer.unref?.(); // never keep the process alive just for this timer
  return fetch(input, { ...init, signal: controller.signal });
}

import { readJSON, writeJSON } from "./storage";
import type { EventsResponse } from "./types";

const CACHE_KEY = "events.v1";
const TIMEOUT_MS = 20000;

function isEventsResponse(x: unknown): x is EventsResponse {
  const r = x as EventsResponse;
  return !!r && Array.isArray(r.events) && Array.isArray(r.sources);
}

// Loads events.json (collected every few hours on GitHub) and saves it for offline use.
// forceRefresh skips any cached copy along the way, for pull-to-refresh.
export async function fetchEvents(apiBaseUrl: string, forceRefresh = false): Promise<EventsResponse> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = `${base}/events.json${forceRefresh ? `?t=${Date.now()}` : ""}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`The schedule server returned an error (${res.status}).`);
    const data: unknown = await res.json();
    if (!isEventsResponse(data)) throw new Error("The schedule server sent something unexpected.");
    data.events.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
    await writeJSON(CACHE_KEY, data);
    return data;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new Error("The schedule took too long to load. Check your signal and try again.");
    }
    if (err instanceof TypeError) {
      throw new Error("Couldn't reach the schedule. You might be offline.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function readCachedEvents(): Promise<EventsResponse | null> {
  const data = await readJSON<EventsResponse>(CACHE_KEY);
  return isEventsResponse(data) ? data : null;
}

import { readJSON, writeJSON } from "./storage";
import type { EventSource, EventsResponse, TournamentEvent } from "./types";

const CACHE_KEY = "events.v1";
const TIMEOUT_MS = 20000;

// The nationwide feed (every state, tagged with organization and state). Until it's
// published, the app falls back to the Texas feed so nothing breaks.
const FEEDS = ["events-usa.json", "events.json"];

// Governing body of each source, for feeds that don't say (the Texas events.json).
const ORGANIZATION: Partial<Record<EventSource, string>> = {
  TFAA: "NFAA",
  ASA: "ASA",
  TSAA: "USA Archery",
  S3DA: "S3DA",
  WA: "World Archery",
};

const TEXAS_SOURCES = new Set(["TFAA", "ASA", "TSAA", "CLUB", "USER"]);

function isEventsResponse(x: unknown): x is EventsResponse {
  const r = x as EventsResponse;
  return !!r && Array.isArray(r.events) && Array.isArray(r.sources);
}

/** Maps the feed's source names onto the app's, so an unknown future source still shows. */
export function toSource(raw: string): EventSource {
  if (raw === "TFAA" || raw === "ASA" || raw === "TSAA" || raw === "CLUB" || raw === "USER" || raw === "S3DA") return raw;
  if (raw === "World Archery" || raw === "WA") return "WA";
  return "OTHER";
}

// Every event leaves here with an organization and, for the Texas sources (which only
// list Texas shoots), state TX.
export function normalizeEvent(e: TournamentEvent): TournamentEvent {
  const source = toSource(e.source as string);
  const state = (e.state ?? "").trim().toUpperCase() || (TEXAS_SOURCES.has(source) ? "TX" : null);
  return { ...e, source, state, organization: e.organization || ORGANIZATION[source] || null };
}

/** A tournament's name boiled down for comparing ("The Vegas Shoot" and "Vegas Shoot!" match). */
export const nameKey = (name: string) => name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");
const knownPlace = (e: TournamentEvent) => !!e.city && e.city !== "TBA";

// Two schedules can list the same tournament (TFAA and World Archery both list The Vegas
// Shoot). Show it once, keeping the copy with a real town, and remember the other listing
// so the tournament still shows under that organization's filter and state.
export function mergeDuplicates(events: TournamentEvent[]): TournamentEvent[] {
  const out: TournamentEvent[] = [];
  const byName = new Map<string, TournamentEvent[]>();
  for (const e of events) {
    const key = nameKey(e.name);
    const same = (byName.get(key) ?? []).find(
      (o) => o.source !== e.source && o.startDate <= e.endDate && e.startDate <= o.endDate
    );
    if (!same) {
      out.push(e);
      byName.set(key, [...(byName.get(key) ?? []), e]);
      continue;
    }
    const [keep, drop] = knownPlace(e) && !knownPlace(same) ? [e, same] : [same, e];
    const merged: TournamentEvent = {
      ...keep,
      alsoListed: [
        ...(keep.alsoListed ?? []),
        { source: drop.source, organization: drop.organization ?? null, state: drop.state },
        ...(drop.alsoListed ?? []),
      ],
    };
    out[out.indexOf(same)] = merged;
    byName.set(key, (byName.get(key) ?? []).map((o) => (o === same ? merged : o)));
  }
  return out;
}

// A row with no name or no start date can't be shown; skip it rather than lose the whole schedule.
const isUsableRow = (e: unknown): e is TournamentEvent => {
  const r = e as Partial<TournamentEvent> | null;
  return !!r && typeof r.name === "string" && !!r.name.trim() && typeof r.startDate === "string" && !!r.startDate;
};

function normalize(data: EventsResponse): EventsResponse {
  const rows = data.events.filter(isUsableRow).map((e) => (typeof e.endDate === "string" && e.endDate ? e : { ...e, endDate: e.startDate }));
  const events = mergeDuplicates(rows.map(normalizeEvent));
  events.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  return { ...data, events };
}

// The request itself failed (no signal, no route): the only case we call "offline".
class NetworkError extends Error {}

async function fetchFeed(url: string, signal: AbortSignal): Promise<EventsResponse | null> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal }).catch((e) => {
    if (e?.name === "AbortError") throw e;
    throw new NetworkError();
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The schedule server returned an error (${res.status}).`);
  const data: unknown = await res.json();
  if (!isEventsResponse(data)) throw new Error("The schedule server sent something unexpected.");
  return data;
}

// Loads the schedule (collected every few hours on GitHub) and saves it for offline use.
// forceRefresh skips any cached copy along the way, for pull-to-refresh.
export async function fetchEvents(apiBaseUrl: string, forceRefresh = false): Promise<EventsResponse> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let data: EventsResponse | null = null;
    let usedFallback = false;
    for (const feed of FEEDS) {
      data = await fetchFeed(`${base}/${feed}${forceRefresh ? `?t=${Date.now()}` : ""}`, controller.signal);
      if (data) break;
      usedFallback = true;
    }
    if (!data) throw new Error("The schedule server returned an error (404).");
    const out = normalize(data);
    if (usedFallback) {
      // The nationwide file is missing: the Texas-only feed must not replace a good saved copy.
      const saved = await readCachedEvents().catch(() => null);
      if (saved) return saved;
    }
    await writeJSON(CACHE_KEY, out);
    return out;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new Error("The schedule took too long to load. Check your signal and try again.");
    }
    if (err instanceof NetworkError) {
      throw new Error("Couldn't reach the schedule. You might be offline.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function readCachedEvents(): Promise<EventsResponse | null> {
  const data = await readJSON<EventsResponse>(CACHE_KEY);
  return isEventsResponse(data) ? normalize(data) : null;
}

/** True when this phone has loaded the schedule before (an existing Texas user). */
export async function hasCachedEvents(): Promise<boolean> {
  return (await readJSON<EventsResponse>(CACHE_KEY)) !== null;
}

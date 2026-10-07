// State and club calendars that publish a machine-readable feed (WordPress "The Events
// Calendar" JSON, Localist JSON, or iCalendar), found by checking every state's archery
// associations, wildlife agencies and clubs on 2026-10-06. Sites without a feed are left out
// on purpose: copying a hand-built web page breaks whenever the club redesigns it, and the
// USA Archery / NFAA event platform's terms rule scraping out. Only facts (name, dates, place)
// and a link back are kept.
//
// General outdoor calendars list hunter education, classes and kids' days next to the
// shoots, so those sources keep only events whose name reads like an archery shoot.
import { fetchWithTimeout } from "./_http.ts";
import {
  blankEvent, decodeEntities, hash, isoDay, normalizeState, stateFromText,
  type UsaEvent, type UsaSourceStatus,
} from "./_national.ts";

const UA = "Mozilla/5.0 (compatible; ArcheryInTheUSA/1.0; +https://mcbridecheyenne.github.io/texas-archery-calendar/)";

type Kind = "tribe" | "localist" | "ics-page";

export interface StateFeed {
  /** Short name used in event ids and logs. */
  key: string;
  organization: string;
  state: string;
  kind: Kind;
  /** The feed itself. */
  feedUrl: string;
  /** The page people see, used as the link when an event has none. */
  pageUrl: string;
  /** true for clubs whose calendar is only archery; false keeps only shoot-like names. */
  archeryOnly: boolean;
}

export const STATE_FEEDS: StateFeed[] = [
  {
    key: "sdaa", organization: "SDAA", state: "SD", kind: "ics-page",
    feedUrl: "https://sdarchers.com/events", pageUrl: "https://sdarchers.com/events", archeryOnly: true,
  },
  {
    key: "gsb", organization: "Granite State Bowhunters", state: "NH", kind: "tribe",
    feedUrl: "https://granitestatebowhunters.com/wp-json/tribe/events/v1/events",
    pageUrl: "https://granitestatebowhunters.com/events/", archeryOnly: true,
  },
  {
    key: "beoutdoorsaz", organization: "Be Outdoors Arizona", state: "AZ", kind: "tribe",
    feedUrl: "https://beoutdoorsarizona.org/wp-json/tribe/events/v1/events?categories=archery",
    pageUrl: "https://beoutdoorsarizona.org/events/category/archery/", archeryOnly: false,
  },
  {
    key: "nmdgf", organization: "NM Game & Fish", state: "NM", kind: "tribe",
    feedUrl: "https://wildlife.dgf.nm.gov/wp-json/tribe/events/v1/events?search=archery",
    pageUrl: "https://wildlife.dgf.nm.gov/calendar/", archeryOnly: false,
  },
  {
    key: "padcnr", organization: "PA State Parks", state: "PA", kind: "localist",
    feedUrl: "https://events.dcnr.pa.gov/api/2/events?keyword=archery&days=365&pp=100",
    pageUrl: "https://events.dcnr.pa.gov/", archeryOnly: false,
  },
  {
    key: "pottertioga", organization: "Potter-Tioga events", state: "PA", kind: "tribe",
    feedUrl: "https://www.visitpottertioga.com/wp-json/tribe/events/v1/events?search=3d",
    pageUrl: "https://www.visitpottertioga.com/events/", archeryOnly: false,
  },
  {
    key: "threerivers", organization: "Three Rivers Land Trust", state: "NC", kind: "tribe",
    feedUrl: "https://threeriverslandtrust.org/wp-json/tribe/events/v1/events?search=archery",
    pageUrl: "https://threeriverslandtrust.org/events/", archeryOnly: false,
  },
];

const ARCHERY = /archer|\bbow(hunt|s)?\b|\b3-?d\b|\bnasp\b|\bnfaa\b|\basa\b|field round|broadhead/i;
const SHOOT = /shoot|tournament|championship|classic|\bopen\b|league|competition|\bmatch\b|qualifier|\b3-?d\b|state (indoor|outdoor|target|field)/i;
const NOT_A_SHOOT = /hunter ed|education|class\b|classes|clinic|lesson|course|intro|basics|learn|workshop|camp\b|instructor|certification|meeting|volunteer|work ?day|banquet|try archery/i;

/** Whether an event from a feed belongs in a tournament calendar. */
export function looksLikeShoot(name: string, archeryOnly: boolean): boolean {
  if (NOT_A_SHOOT.test(name)) return false;
  if (archeryOnly) return true;
  return ARCHERY.test(name) && SHOOT.test(name);
}

function makeEvent(
  feed: StateFeed,
  row: { id?: string | number; name: string; start: string; end: string; venue?: string | null; city?: string | null; state?: string | null; url?: string | null },
): UsaEvent {
  const city = row.city?.trim() || null;
  const state = normalizeState(row.state) ?? stateFromText(`${row.venue ?? ""} ${row.name}`) ?? feed.state;
  return {
    ...blankEvent(),
    id: `${feed.key}-${row.id ?? hash(`${row.name}|${row.start}`)}`,
    source: "State calendars", organization: feed.organization,
    name: row.name, startDate: row.start, endDate: row.end < row.start ? row.start : row.end,
    location: [row.venue?.trim(), city, state].filter(Boolean).join(", ") || null,
    city, state, sourceUrl: row.url || feed.pageUrl,
  };
}

// --- WordPress "The Events Calendar" REST API ---
interface TribeVenue { venue?: string; city?: string; state?: string; stateprovince?: string; province?: string }
interface TribeEvent { id?: number; title?: string; url?: string; start_date?: string; end_date?: string; venue?: TribeVenue | [] }

export function parseTribe(feed: StateFeed, rows: TribeEvent[]): UsaEvent[] {
  return rows.flatMap((row) => {
    const name = decodeEntities(row.title || "");
    const start = isoDay(row.start_date);
    if (!name || !start || !looksLikeShoot(name, feed.archeryOnly)) return [];
    const v = Array.isArray(row.venue) ? {} : row.venue || {};
    return [makeEvent(feed, {
      id: row.id, name, start, end: isoDay(row.end_date) ?? start,
      venue: v.venue ? decodeEntities(v.venue) : null, city: v.city,
      state: v.state || v.stateprovince || v.province, url: row.url,
    })];
  });
}

async function fetchTribe(feed: StateFeed): Promise<UsaEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const join = feed.feedUrl.includes("?") ? "&" : "?";
  let next: string | null = `${feed.feedUrl}${join}start_date=${today}&per_page=50`;
  const rows: TribeEvent[] = [];
  for (let page = 0; next && page < 10; page++) {
    const res: Response = await fetchWithTimeout(next, { headers: { "User-Agent": UA, Accept: "application/json" } });
    // The plugin answers 404 "no events" when nothing is scheduled.
    if (res.status === 404 && page === 0) return [];
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { events?: TribeEvent[]; next_rest_url?: string };
    rows.push(...(data.events ?? []));
    next = data.next_rest_url || null;
  }
  return parseTribe(feed, rows);
}

// --- Localist (events.dcnr.pa.gov) ---
interface LocalistEvent {
  id?: number; title?: string; localist_url?: string; location_name?: string; city?: string;
  geo?: { city?: string; state?: string };
  event_instances?: { event_instance?: { start?: string; end?: string | null } }[];
}

export function parseLocalist(feed: StateFeed, rows: { event?: LocalistEvent }[]): UsaEvent[] {
  return rows.flatMap(({ event: e }) => {
    const name = decodeEntities(e?.title || "");
    if (!e || !name || !looksLikeShoot(name, feed.archeryOnly)) return [];
    // A repeating event has one instance per date; each is its own day on the calendar.
    return (e.event_instances ?? []).flatMap(({ event_instance: i }) => {
      const start = isoDay(i?.start);
      if (!start) return [];
      return [makeEvent(feed, {
        id: `${e.id ?? hash(name)}-${start}`, name, start, end: isoDay(i?.end) ?? start,
        venue: e.location_name, city: e.geo?.city || e.city, state: e.geo?.state, url: e.localist_url,
      })];
    });
  });
}

async function fetchLocalist(feed: StateFeed): Promise<UsaEvent[]> {
  const res = await fetchWithTimeout(feed.feedUrl, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { events?: { event?: LocalistEvent }[] };
  return parseLocalist(feed, data.events ?? []);
}

// --- iCalendar ---
/** Parses VEVENTs from an .ics body. DTEND on an all-day event is the day after it ends. */
export function parseIcs(text: string): { uid: string | null; name: string; start: string; end: string; location: string | null; url: string | null }[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const out = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      const day = (v?: string) => v?.match(/(\d{4})(\d{2})(\d{2})/)?.slice(1).join("-") ?? null;
      const start = day(cur.DTSTART);
      let end = day(cur.DTEND) ?? start;
      if (start && end && end > start && /^\d{8}$/.test(cur.DTEND ?? "")) {
        const d = new Date(`${end}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        end = d.toISOString().slice(0, 10);
      }
      const unescape = (v?: string) => (v ?? "").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
      if (start && cur.SUMMARY) {
        out.push({
          uid: cur.UID ?? null, name: unescape(cur.SUMMARY), start, end: end ?? start,
          location: unescape(cur.LOCATION) || null, url: cur.URL ?? null,
        });
      }
      cur = null;
    } else if (cur) {
      const m = line.match(/^([A-Z-]+)(?:;[^:]*)?:(.*)$/);
      if (m && !(m[1] in cur)) cur[m[1]] = m[2];
    }
  }
  return out;
}

/** Pages that offer one "Add to calendar" data: link per event (sdarchers.com). */
export function parseIcsPage(feed: StateFeed, html: string): UsaEvent[] {
  const seen = new Set<string>();
  const out: UsaEvent[] = [];
  for (const m of html.matchAll(/href="data:text\/calendar[^,"]*,([^"]+)"/g)) {
    let body: string;
    try {
      body = decodeURIComponent(m[1].replace(/&amp;/g, "&"));
    } catch {
      continue;
    }
    for (const e of parseIcs(body)) {
      const id = e.uid?.split("@")[0] ?? hash(`${e.name}|${e.start}`);
      if (seen.has(id) || !looksLikeShoot(e.name, feed.archeryOnly)) continue;
      seen.add(id);
      out.push(makeEvent(feed, { id, name: e.name, start: e.start, end: e.end, venue: e.location, url: e.url }));
    }
  }
  return out;
}

async function fetchIcsPage(feed: StateFeed): Promise<UsaEvent[]> {
  const res = await fetchWithTimeout(feed.feedUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseIcsPage(feed, await res.text());
}

const FETCHERS: Record<Kind, (feed: StateFeed) => Promise<UsaEvent[]>> = {
  tribe: fetchTribe, localist: fetchLocalist, "ics-page": fetchIcsPage,
};

/**
 * Collects every state feed as one source, so a club with nothing scheduled this month (or a
 * site that's down for a day) doesn't read as the whole source failing. The message lists
 * each feed's count.
 */
export async function collectStateCalendars(): Promise<{ events: UsaEvent[]; status: UsaSourceStatus }> {
  const fetchedAt = new Date().toISOString();
  const results = await Promise.all(STATE_FEEDS.map(async (feed) => {
    try {
      return { feed, events: await FETCHERS[feed.kind](feed), error: null as string | null };
    } catch (err) {
      return { feed, events: [] as UsaEvent[], error: err instanceof Error ? err.message : String(err) };
    }
  }));
  const events = results.flatMap((r) => r.events);
  const parts = results.map((r) => `${r.feed.organization} (${r.feed.state}) ${r.error ? `error: ${r.error}` : r.events.length}`);
  for (const r of results) {
    for (const e of r.events.slice(0, 8)) console.log(`  [${r.feed.key}] ${e.startDate} ${e.name} @ ${e.location ?? "?"}`);
  }
  const allFailed = results.every((r) => r.error);
  return {
    events,
    status: {
      name: "State calendars", url: "api/_states.ts",
      status: allFailed ? "error" : events.length ? "ok" : "partial",
      message: parts.join("; "), eventCount: events.length, fetchedAt,
    },
  };
}

// Nationwide event sources for the USA version of the app. Kept separate from
// _scrapers.ts so the Texas feed (events.json) the current app reads is unchanged.
import { fetchWithTimeout } from "./_http.ts";
import { readFileSync } from "node:fs";
import { getEvents, type TournamentEvent, type SourceStatus } from "./_scrapers.ts";
import { collectStateCalendars } from "./_states.ts";

export interface UsaEvent extends Omit<TournamentEvent, "source"> {
  source: string;
  organization: string;
}

export interface UsaSourceStatus extends Omit<SourceStatus, "name"> {
  name: string;
}

export interface UsaResult {
  events: UsaEvent[];
  sources: UsaSourceStatus[];
  lastUpdated: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Which governing body each existing Texas source belongs to.
const TEXAS_ORGANIZATION: Record<TournamentEvent["source"], string> = {
  TFAA: "NFAA",
  ASA: "ASA",
  TSAA: "USA Archery",
};

const S3DA_URL = "https://www.s3da.net/events/";
const S3DA_API = "https://www.s3da.net/wp-json/tribe/events/v1/events";
const WA_URL = "https://www.worldarchery.sport/events/calendar";
const WA_API = "https://api.worldarchery.org/v3/COMPETITIONS/";

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const CODES = new Set(Object.values(STATES));

// Turns "Texas", "tx" or "TX" into "TX"; returns null for anything else.
export function normalizeState(value: string | null | undefined): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  if (CODES.has(v.toUpperCase())) return v.toUpperCase();
  return STATES[v.toLowerCase()] ?? null;
}

// Finds a state named in free text, e.g. "2026 Utah State 3D Championship". Longest names
// first so "West Virginia" wins over "Virginia".
export function stateFromText(text: string): string | null {
  const lower = text.toLowerCase();
  const names = Object.keys(STATES).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) return STATES[name];
  }
  return null;
}

export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function isoDay(value: unknown): string | null {
  const m = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, "").trim();
}

export function blankEvent(): Omit<UsaEvent, "id" | "source" | "organization" | "name" | "startDate" | "endDate" | "sourceUrl"> {
  return {
    location: null, city: null, state: null, registrationStart: null, registrationEnd: null,
    contact: null, phone: null, email: null,
  };
}

async function runSource(
  name: string,
  url: string,
  collect: () => Promise<UsaEvent[]>,
): Promise<{ events: UsaEvent[]; status: UsaSourceStatus }> {
  const fetchedAt = new Date().toISOString();
  try {
    const events = await collect();
    return {
      events,
      status: {
        name, url, status: events.length > 0 ? "ok" : "partial",
        message: events.length > 0 ? null : "Source loaded but no events were detected.",
        eventCount: events.length, fetchedAt,
      },
    };
  } catch (err) {
    return {
      events: [],
      status: {
        name, url, status: "error",
        message: err instanceof Error ? err.message : String(err),
        eventCount: 0, fetchedAt,
      },
    };
  }
}

// --- S3DA: WordPress "The Events Calendar" REST API ---
interface S3DAVenue { venue?: string; city?: string; state?: string; stateprovince?: string; province?: string }
interface S3DARawEvent { id?: number; title?: string; url?: string; start_date?: string; end_date?: string; venue?: S3DAVenue | [] }

export function parseS3DAEvents(rows: S3DARawEvent[]): UsaEvent[] {
  const out: UsaEvent[] = [];
  for (const row of rows) {
    const name = decodeEntities(row.title || "");
    const start = isoDay(row.start_date);
    const end = isoDay(row.end_date) ?? start;
    if (!name || !start || !end) continue;
    const venue = Array.isArray(row.venue) ? {} : (row.venue || {});
    const city = (venue.city || "").trim() || null;
    const state =
      normalizeState(venue.state) ?? normalizeState(venue.stateprovince) ??
      normalizeState(venue.province) ?? stateFromText(name);
    const location = [venue.venue, city, state].filter(Boolean).join(", ") || null;
    out.push({
      ...blankEvent(),
      id: `s3da-${row.id ?? hash(`${name}|${start}`)}`,
      source: "S3DA", organization: "S3DA", name, startDate: start, endDate: end,
      location, city, state, sourceUrl: row.url || S3DA_URL,
    });
  }
  return out;
}

export async function collectS3DA(): Promise<UsaEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows: S3DARawEvent[] = [];
  let next: string | null = `${S3DA_API}?start_date=${today}&per_page=50`;
  for (let page = 0; next && page < 20; page++) {
    const res = await fetchWithTimeout(next, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { events?: S3DARawEvent[]; next_rest_url?: string };
    rows.push(...(data.events ?? []));
    next = data.next_rest_url || null;
  }
  return parseS3DAEvents(rows);
}

// --- World Archery: public results API, US-hosted competitions ---
interface WARawCompetition { ID?: number | string; Name?: string; DFrom?: string; DTo?: string; Place?: string }

export function parseWorldArchery(rows: WARawCompetition[]): UsaEvent[] {
  const out: UsaEvent[] = [];
  for (const row of rows) {
    const name = (row.Name || "").trim();
    const start = isoDay(row.DFrom);
    const end = isoDay(row.DTo) ?? start;
    if (!name || !start || !end) continue;
    const place = (row.Place || "").trim();
    const parts = place.split(",").map((s) => s.trim()).filter(Boolean);
    const state = parts.map(normalizeState).find(Boolean) ?? stateFromText(place);
    out.push({
      ...blankEvent(),
      id: `wa-${row.ID ?? hash(`${name}|${start}`)}`,
      source: "World Archery", organization: "World Archery", name, startDate: start, endDate: end,
      location: place || null, city: parts[0] || null, state: state ?? null,
      sourceUrl: row.ID ? `https://www.worldarchery.sport/competition/${row.ID}` : WA_URL,
    });
  }
  return out;
}

async function collectWorldArchery(): Promise<UsaEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetchWithTimeout(`${WA_API}?Country=USA&StartDate=${today}&RBP=100`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { items?: WARawCompetition[] } | WARawCompetition[];
  return parseWorldArchery(Array.isArray(data) ? data : data.items ?? []);
}

// --- ASA Pro/Am tour: the /pro-am/ page plus the site's WordPress events feed ---
// The page's header menu carries the current season's dates ("Hoyt/Easton Pro/AM <b>Foley,
// AL<br>Feb 25- 27, 2027</b>") but shows "XXXX" for cities not announced yet. The feed has
// venue names and addresses, but its dates lag a season behind until ASA edits each event,
// so dates come from the menu and venues from the feed only when they match the menu city.
// robots.txt allows both; ASA's terms reserve their text and logos, so only facts are kept.
const ASA_PROAM_URL = "https://asaarchery.com/pro-am/";
const ASA_FEED = "https://asaarchery.com/wp-json/wp/v2/events?per_page=50";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Parses "Feb 25- 27, 2027", "March 18 – 20, 2027" or "July 30 – Aug 1, 2027".
export function parseAsaDateRange(text: string): { startDate: string; endDate: string } | null {
  const t = decodeEntities(text).replace(/(\d)(st|nd|rd|th)\b/gi, "$1").replace(/\s+/g, " ");
  const m = t.match(/([A-Za-z]{3,})\.? (\d{1,2}) ?[-–—] ?(?:([A-Za-z]{3,})\.? )?(\d{1,2}),? (\d{4})/);
  if (!m) return null;
  const [, mon1, d1, mon2, d2, year] = m;
  const m1 = MONTHS[mon1.slice(0, 3).toLowerCase()];
  const m2 = mon2 ? MONTHS[mon2.slice(0, 3).toLowerCase()] : m1;
  if (!m1 || !m2) return null;
  const y1 = m2 < m1 ? Number(year) - 1 : Number(year);
  const day = (y: number, mo: number, d: string) =>
    `${y}-${String(mo).padStart(2, "0")}-${d.padStart(2, "0")}`;
  return { startDate: day(y1, m1, d1), endDate: day(Number(year), m2, d2) };
}

export interface AsaMenuEvent { slug: string; name: string; city: string | null; startDate: string; endDate: string }

export function parseAsaProAmMenu(html: string): AsaMenuEvent[] {
  const out: AsaMenuEvent[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href=["'](?:https?:\/\/asaarchery\.com)?\/events\/([\w-]+)\/?["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, slug, inner] = m;
    const text = inner.match(/<span class="avia-menu-text">([\s\S]*?)<\/span>/i)?.[1];
    if (!text || seen.has(slug)) continue;
    const name = decodeEntities(text.split(/<b>/i)[0]).replace(/Pro\/AM\b/g, "Pro/Am");
    // The bold part is "City, ST" then the dates, split by <br> or by separate <b> tags.
    const bold = [...text.matchAll(/<b>([\s\S]*?)<\/b>/gi)]
      .flatMap((b) => b[1].split(/<br\s*\/?>/i)).map(decodeEntities).filter(Boolean);
    const dates = bold.map(parseAsaDateRange).find(Boolean);
    if (!name || !dates) continue;
    const city = bold.find((b) => !parseAsaDateRange(b) && /^[A-Za-z .'-]+, [A-Za-z]{2}$/.test(b)) ?? null;
    seen.add(slug);
    out.push({ slug, name, city, ...dates });
  }
  return out;
}

interface AsaFeedEvent {
  slug?: string; link?: string; title?: string | { rendered?: string };
  start_date?: string; end_date?: string; location_region?: string;
  event_location?: { region?: string; name?: string; address?: string };
}

function splitCityState(region: string | null | undefined): { city: string | null; state: string | null } {
  const parts = (region || "").split(",").map((s) => s.trim());
  const state = normalizeState(parts[1]);
  return state ? { city: parts[0] || null, state } : { city: null, state: null };
}

/** "7 Uchee Creek Rd, Fort Mitchell, AL 36856" -> "Fort Mitchell". */
export function townFromAddress(address: string | null | undefined): string | null {
  const m = (address || "").match(/,\s*([^,]+?),\s*[A-Z]{2}\s+\d{5}/);
  return m ? m[1].trim() : null;
}

export function mergeAsaProAm(menu: AsaMenuEvent[], feed: AsaFeedEvent[]): UsaEvent[] {
  const bySlug = new Map(feed.filter((f) => f.slug).map((f) => [f.slug!, f]));
  const rows = menu.length
    ? menu
    // Menu missing (page redesigned): fall back to the feed's own dates.
    : feed.flatMap((f) => {
        const start = isoDay(f.start_date);
        const title = typeof f.title === "string" ? f.title : f.title?.rendered;
        return f.slug && start && title
          ? [{ slug: f.slug, name: decodeEntities(title).replace(/Pro\/AM\b/g, "Pro/Am"),
               city: f.location_region || f.event_location?.region || null,
               startDate: start, endDate: isoDay(f.end_date) ?? start }]
          : [];
      });
  return rows.map((row) => {
    const f = bySlug.get(row.slug);
    const loc = f?.event_location ?? {};
    const region = loc.region || f?.location_region || "";
    const cityKey = (row.city || "").split(",")[0].trim().toLowerCase();
    // Use the feed's venue only when it is plainly the same place the menu names.
    const venueMatches = !!cityKey && `${region} ${loc.name ?? ""} ${loc.address ?? ""}`.toLowerCase().includes(cityKey);
    const { city: menuCity, state } = splitCityState(row.city);
    // ASA sometimes names a county ("Russell County, AL"); the venue address has the town.
    const town = venueMatches && /\bcounty$/i.test(menuCity ?? "") ? townFromAddress(loc.address) : null;
    const city = town ?? menuCity;
    return {
      ...blankEvent(),
      id: `asa-proam-${row.slug}-${row.startDate.slice(0, 4)}`,
      source: "ASA Pro/Am", organization: "ASA", name: row.name,
      startDate: row.startDate, endDate: row.endDate,
      location: venueMatches ? [loc.name, loc.address].filter(Boolean).join(", ") || row.city : row.city,
      city, state,
      sourceUrl: f?.link || `https://asaarchery.com/events/${row.slug}/`,
    };
  });
}

async function collectAsaProAm(): Promise<UsaEvent[]> {
  const headers = { "User-Agent": UA };
  const pageRes = await fetchWithTimeout(ASA_PROAM_URL, { headers });
  if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
  const menu = parseAsaProAmMenu(await pageRes.text());
  let feed: AsaFeedEvent[] = [];
  try {
    const res = await fetchWithTimeout(ASA_FEED, { headers: { ...headers, Accept: "application/json" } });
    if (res.ok) feed = (await res.json()) as AsaFeedEvent[];
  } catch {
    // Venues are optional; the page alone still gives names, dates and cities.
  }
  return mergeAsaProAm(menu, Array.isArray(feed) ? feed : []);
}

// --- Hand-kept marquee events (data/manual-events.json) ---
interface ManualEvent {
  organization: string; name: string; startDate: string; endDate?: string;
  city?: string; state?: string; location?: string; sourceUrl: string;
}

async function collectManual(): Promise<UsaEvent[]> {
  const path = new URL("../data/manual-events.json", import.meta.url);
  const rows = JSON.parse(readFileSync(path, "utf8")) as ManualEvent[];
  return rows.map((row) => ({
    ...blankEvent(),
    id: `manual-${hash(`${row.name}|${row.startDate}`)}`,
    source: "Manual", organization: row.organization, name: row.name,
    startDate: row.startDate, endDate: row.endDate ?? row.startDate,
    location: row.location ?? null, city: row.city ?? null, state: normalizeState(row.state),
    sourceUrl: row.sourceUrl,
  }));
}

// The app's month view labels each shoot with its town, so a place that isn't known
// ("XXXX" on ASA's page, "Texas (TBD)", a bare ",") reads TBA instead of a blank or a
// stray bracket.
export function tidyPlace<T extends Pick<UsaEvent, "city" | "location">>(e: T): T {
  const unknown = (v: string | null | undefined) => !v || !/[a-z0-9]/i.test(v) || /\b(tbd|tba)\b|^x{3,}$/i.test(v);
  const city = unknown(e.city) ? null : e.city!.trim();
  const location = unknown(e.location) ? null : e.location!.trim();
  if (city || location) return { ...e, city, location };
  return { ...e, city: "TBA", location: "Location TBA" };
}

export async function getUsaEvents(): Promise<UsaResult> {
  // S3DA is not collected automatically: its site has no events API and answers automated
  // requests from GitHub with a block page (checked 2026-10-04). Its national and state
  // championships go in data/manual-events.json instead. collectS3DA is kept in case they
  // open a feed.
  const [texas, wa, asa, manual, states] = await Promise.all([
    getEvents(),
    runSource("World Archery", WA_URL, collectWorldArchery),
    runSource("ASA Pro/Am", ASA_PROAM_URL, collectAsaProAm),
    runSource("Manual", "data/manual-events.json", collectManual),
    collectStateCalendars(),
  ]);
  const texasEvents: UsaEvent[] = texas.events.map((e) => ({
    ...e, state: normalizeState(e.state) ?? "TX", organization: TEXAS_ORGANIZATION[e.source],
  }));
  const today = new Date().toISOString().slice(0, 10);
  const events = [...texasEvents, ...wa.events, ...asa.events, ...manual.events, ...states.events]
    .filter((e) => e.endDate >= today)
    .map(tidyPlace)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  return {
    events,
    sources: [...texas.sources, wa.status, asa.status, manual.status, states.status],
    lastUpdated: new Date().toISOString(),
  };
}

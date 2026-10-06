// Shared types for Vercel serverless functions (no zod dependency needed at runtime)

export interface TournamentEvent {
  id: string;
  source: "TFAA" | "ASA" | "TSAA";
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  city: string | null;
  state: string | null;
  registrationStart: string | null;
  registrationEnd: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  sourceUrl: string;
}

export interface SourceStatus {
  name: "TFAA" | "ASA" | "TSAA";
  url: string;
  status: "ok" | "partial" | "error";
  message: string | null;
  eventCount: number;
  fetchedAt: string;
}

export interface CombinedResult {
  events: TournamentEvent[];
  sources: SourceStatus[];
  lastUpdated: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const TFAA_URL = "https://texasfieldarchery.org/schedule";
const ASA_URL = "https://www.txasafederation.com/texas-asa-schedule";
const TSAA_URL = "https://texasarchery.org/Calendar";
const ASA_SHEET_ID = "1PeF-bm9k73m1onVmGDytHoGNCET4WRyLJeR9xCAI6Y4";
const ASA_CSV_URL = `https://docs.google.com/spreadsheets/d/${ASA_SHEET_ID}/export?format=csv`;
const TSAA_APP_ID = "69ac99564af1af86e1557667";
const TSAA_EVENTS_URL = `https://base44.app/api/apps/${TSAA_APP_ID}/entities/TournamentEvent`;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIsoDate(mmddyyyy: string): string | null {
  const m = mmddyyyy.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, mo, d, y] = m;
  const moNum = parseInt(mo, 10);
  const dNum = parseInt(d, 10);
  if (moNum < 1 || moNum > 12 || dNum < 1 || dNum > 31) return null;
  return `${y}-${pad(moNum)}-${pad(dNum)}`;
}

function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return toIsoDate(trimmed);
}

function isPlaceholderDate(s: string): boolean {
  return /^0\/0+\/0+$/.test(s.trim());
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// --- TFAA ---
async function scrapeTFAA(): Promise<{ events: TournamentEvent[]; status: SourceStatus }> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(TFAA_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const events = parseTFAAHtml(html);
    return {
      events,
      status: {
        name: "TFAA", url: TFAA_URL,
        status: events.length > 0 ? "ok" : "partial",
        message: events.length > 0 ? null : "Source loaded but no events were detected.",
        eventCount: events.length, fetchedAt,
      },
    };
  } catch (err) {
    return {
      events: [],
      status: {
        name: "TFAA", url: TFAA_URL, status: "error",
        message: err instanceof Error ? err.message : String(err),
        eventCount: 0, fetchedAt,
      },
    };
  }
}

function parseTFAAHtml(html: string): TournamentEvent[] {
  const events: TournamentEvent[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(html))) {
    const rowHtml = m[1];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    while ((c = cellRegex.exec(rowHtml))) cells.push(stripTags(c[1]));
    if (cells.length < 3) continue;
    const [name, location, dates, registration] = cells;
    const dateMatch = (dates || "").match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})$/);
    if (!dateMatch) continue;
    const start = toIsoDate(dateMatch[1]);
    const end = toIsoDate(dateMatch[2]);
    if (!start || !end) continue;
    let regStart: string | null = null;
    let regEnd: string | null = null;
    if (registration) {
      const rm = registration.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})$/);
      if (rm && !isPlaceholderDate(rm[1])) { regStart = toIsoDate(rm[1]); regEnd = toIsoDate(rm[2]); }
    }
    const locParts = (location || "").split(",").map((s) => s.trim());
    events.push({
      id: `tfaa-${hash(`${name}|${start}|${end}|${location}`)}`,
      source: "TFAA", name: name || "Tournament", startDate: start, endDate: end,
      location: location || null, city: locParts[0] || null, state: locParts[1] || null,
      registrationStart: regStart, registrationEnd: regEnd,
      contact: null, phone: null, email: null, sourceUrl: TFAA_URL,
    });
  }
  return events;
}

// --- ASA ---
async function scrapeASA(): Promise<{ events: TournamentEvent[]; status: SourceStatus }> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(ASA_CSV_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const events = parseASACsv(csv);
    return {
      events,
      status: {
        name: "ASA", url: ASA_URL,
        status: events.length > 0 ? "ok" : "partial",
        message: events.length > 0 ? null : "Schedule sheet loaded but contained no parseable rows.",
        eventCount: events.length, fetchedAt,
      },
    };
  } catch (err) {
    return {
      events: [],
      status: {
        name: "ASA", url: ASA_URL, status: "error",
        message: err instanceof Error ? err.message : String(err),
        eventCount: 0, fetchedAt,
      },
    };
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else { field += ch; }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

function parseASACsv(csv: string): TournamentEvent[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (label: string) => header.indexOf(label.toLowerCase());
  const iStart = idx("Start Date"), iEnd = idx("End Date"), iName = idx("Club Name");
  const iContact = idx("Club Contact"), iAddr = idx("Club Address"), iCity = idx("City");
  const iState = idx("ST"), iPhone = idx("Club Phone"), iEmail = idx("Club Email");
  const out: TournamentEvent[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const startRaw = (row[iStart] || "").trim();
    const name = (row[iName] || "").trim();
    if (!name || !startRaw) continue;
    const start = toIsoDate(startRaw);
    const endRaw = (row[iEnd] || "").trim();
    const end = endRaw ? toIsoDate(endRaw) : start;
    if (!start || !end) continue;
    const city = (row[iCity] || "").trim() || null;
    const state = (row[iState] || "").trim() || null;
    const addr = (row[iAddr] || "").trim();
    const locParts = [addr, city, state].filter(Boolean);
    out.push({
      id: `asa-${hash(`${name}|${start}|${end}|${city}`)}`,
      source: "ASA", name, startDate: start, endDate: end,
      location: locParts.join(", ") || null, city, state,
      registrationStart: null, registrationEnd: null,
      contact: (row[iContact] || "").trim() || null,
      phone: (row[iPhone] || "").trim() || null,
      email: (row[iEmail] || "").trim() || null,
      sourceUrl: ASA_URL,
    });
  }
  return out;
}

// --- TSAA ---
interface TSAARawEvent {
  id?: string; name?: string; event_date?: string; end_date?: string;
  location?: string; organizer?: string; registration_url?: string;
  notes?: string; is_tsaa?: boolean;
}

async function scrapeTSAA(): Promise<{ events: TournamentEvent[]; status: SourceStatus }> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(TSAA_EVENTS_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as TSAARawEvent[];
    const events = parseTSAAEvents(raw);
    return {
      events,
      status: {
        name: "TSAA", url: TSAA_URL,
        status: events.length > 0 ? "ok" : "partial",
        message: events.length > 0 ? null : "Calendar loaded but contained no parseable events.",
        eventCount: events.length, fetchedAt,
      },
    };
  } catch (err) {
    return {
      events: [],
      status: {
        name: "TSAA", url: TSAA_URL, status: "error",
        message: err instanceof Error ? err.message : String(err),
        eventCount: 0, fetchedAt,
      },
    };
  }
}

function parseTSAAEvents(rows: TSAARawEvent[]): TournamentEvent[] {
  const out: TournamentEvent[] = [];
  for (const row of rows) {
    const name = (row.name || "").trim();
    const start = normalizeIsoDate(row.event_date);
    const end = normalizeIsoDate(row.end_date) ?? start;
    if (!name || !start || !end) continue;
    const location = (row.location || "").replace(/\s+/g, " ").trim() || null;
    const relevanceText = [name, location, row.organizer, row.notes].filter(Boolean).join(" ");
    const isTexasRelevant = row.is_tsaa === true || /\b(TX|Texas|TFAA|TOTS|TSAA)\b/i.test(relevanceText);
    if (!isTexasRelevant) continue;
    const { city, state } = parseTSAALocation(location);
    const url = (row.registration_url || "").trim();
    out.push({
      id: `tsaa-${row.id || hash(`${name}|${start}|${end}|${location}`)}`,
      source: "TSAA", name, startDate: start, endDate: end,
      location, city, state, registrationStart: null, registrationEnd: null,
      contact: (row.organizer || "").trim() || null, phone: null, email: null,
      sourceUrl: url && /^https?:\/\//.test(url) ? url : TSAA_URL,
    });
  }
  return out;
}

// TSAA locations come as "Venue, City, ST", "City, ST" or a full street address
// ("Venue, 123 Main St, City, ST, 75042, United States"). The city is the part just
// before the two-letter state code; with no state code, a lone part is taken as the city.
// Placeholders like "Texas" or "Texas (TBD)" aren't cities.
export function parseTSAALocation(location: string | null): { city: string | null; state: string | null } {
  const parts = (location || "").split(",").map((s) => s.trim());
  const stateIdx = parts.findIndex((part) => /^[A-Z]{2}$/.test(part));
  const state = stateIdx >= 0 ? parts[stateIdx] : null;
  const candidate = stateIdx > 0 ? parts[stateIdx - 1] : stateIdx === -1 && parts.length === 1 ? parts[0] : null;
  const city = candidate && !/^texas\b/i.test(candidate) ? candidate : null;
  return { city, state };
}

// --- Dedup + combine ---
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// True when the TSAA listing starts during the other event (allowing a day either side),
// e.g. TSAA lists "TFAA Legacy Archery-1" on Saturday while TFAA lists it Friday–Sunday.
function datesOverlap(tsaaEvent: TournamentEvent, event: TournamentEvent): boolean {
  return tsaaEvent.startDate >= addDays(event.startDate, -1) && tsaaEvent.startDate <= addDays(event.endDate, 1);
}

function normalizeForMatch(value: string | null | undefined): string {
  return (value || "").toLowerCase()
    .replace(/\b(tfaa|texas asa qualifier|qualifier|round|sywat|outdoor)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").replace(/\b(\d|1|2|3|4|5)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

function sameOrSimilarTSAAEvent(tsaaEvent: TournamentEvent, primaryEvents: TournamentEvent[]): boolean {
  const tsaaName = normalizeForMatch(tsaaEvent.name);
  const tsaaLocation = normalizeForMatch(tsaaEvent.location);
  return primaryEvents.some((event) => {
    const eventName = normalizeForMatch(event.name);
    const fullNameMatch = Boolean(tsaaName && eventName) &&
      (tsaaName.includes(eventName) || eventName.includes(tsaaName));
    if (event.startDate === tsaaEvent.startDate) {
      const eventLocation = normalizeForMatch(event.location);
      const nameMatches = fullNameMatch ||
        (eventName.length > 8 && tsaaName.includes(eventName.slice(0, 12)));
      const locationMatches = tsaaLocation && eventLocation &&
        (tsaaLocation.includes(eventLocation) || eventLocation.includes(tsaaLocation));
      return Boolean(nameMatches || locationMatches);
    }
    // Different start dates (TSAA often lists only one day of a multi-day shoot): only call
    // it the same shoot when the dates overlap, the whole name matches, and the cities agree.
    if (!datesOverlap(tsaaEvent, event) || !fullNameMatch) return false;
    const a = (tsaaEvent.city || "").toLowerCase().replace(/^ft\.?\s/, "fort ");
    const b = (event.city || "").toLowerCase().replace(/^ft\.?\s/, "fort ");
    return !a || !b || a === b;
  });
}

function dedupeTSAAEvents(events: TournamentEvent[]): TournamentEvent[] {
  const kept: TournamentEvent[] = [];
  for (const event of events) {
    if (!sameOrSimilarTSAAEvent(event, kept)) kept.push(event);
  }
  return kept;
}

export async function getEvents(): Promise<CombinedResult> {
  const [tfaa, asa, tsaa] = await Promise.all([scrapeTFAA(), scrapeASA(), scrapeTSAA()]);
  const primaryEvents = [...tfaa.events, ...asa.events];
  const tsaaEvents = dedupeTSAAEvents(
    tsaa.events.filter((event) => !sameOrSimilarTSAAEvent(event, primaryEvents))
  );
  const events = [...primaryEvents, ...tsaaEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return {
    events,
    sources: [
      tfaa.status, asa.status,
      {
        ...tsaa.status, eventCount: tsaaEvents.length,
        message: tsaa.status.message ??
          (tsaa.events.length !== tsaaEvents.length
            ? "Texas-relevant TSAA calendar events loaded; duplicates already covered by TFAA/Texas ASA were hidden."
            : null),
      },
    ],
    lastUpdated: new Date().toISOString(),
  };
}

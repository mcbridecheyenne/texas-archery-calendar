// Club calendar feeds: shoots that Texas clubs publish on their own public calendars
// (Google Calendar ICS, other .ics links, or the WordPress "The Events Calendar" REST API).
// The list of feeds lives in data/club-feeds.json. Everything here except collectClubFeeds
// is a pure function so it can be tested without the network.

export interface ClubFeed {
  club: string;
  city: string | null;
  state: string;
  organization: string;
  // ics: any public .ics link (Google Calendar's "public address in iCal format", a
  //   WordPress events plugin's export, ...).
  // tribe: WordPress "The Events Calendar" REST API, e.g. https://club.org/wp-json/tribe/events/v1/events
  // squarespace: a Squarespace events page, e.g. https://club.com/events (read as ?format=json)
  feedType: "ics" | "tribe" | "squarespace";
  url: string;
  // Page people should land on for details when an event has no link of its own.
  siteUrl?: string;
  // For calendars that are not only archery (a county extension office, a shooting
  // complex): keep only events that mention archery.
  requireArcheryWord?: boolean;
  notes?: string;
}

// A calendar entry after the ICS has been read, before deciding whether it is a shoot.
export interface CalendarEntry {
  uid: string;
  title: string;
  description: string;
  location: string | null;
  url: string | null;
  startDate: string; // YYYY-MM-DD, local to the club
  endDate: string; // YYYY-MM-DD, inclusive
  cancelled: boolean;
  // How often the calendar repeats this entry, when it is part of a series.
  repeats?: "daily" | "weekly" | "monthly" | "yearly" | null;
}

// The shape added to the nationwide feed. Matches UsaEvent in _national.ts.
export interface ClubEvent {
  id: string;
  source: "CLUB";
  feedName: string; // "CLUB: <club>", the status row this event belongs to
  organization: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  city: string | null;
  state: string | null;
  registrationStart: null;
  registrationEnd: null;
  contact: string | null;
  phone: null;
  email: null;
  sourceUrl: string;
}

const DEFAULT_TZ = "America/Chicago";
const MAX_OCCURRENCES = 200;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// --- Dates ---

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(day: string, n: number): string {
  const d = parseYmd(day);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
}

// The calendar date of an instant in a time zone.
function dateInZone(instant: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(instant);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return dateInZone(instant, DEFAULT_TZ);
  }
}

interface IcsDate {
  date: string; // local calendar date
  allDay: boolean;
  midnight: boolean; // a timed value at exactly 00:00 local
}

// Reads DTSTART/DTEND style values: 20261010, 20261010T090000 (floating or with TZID,
// already local) and 20261010T140000Z (UTC, converted to the calendar's zone).
export function parseIcsDate(value: string, params: Record<string, string>, calendarTz: string): IcsDate | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, z] = m;
  if (!hh || params.VALUE === "DATE") return { date: `${y}-${mo}-${d}`, allDay: true, midnight: false };
  if (z) {
    const instant = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +(ss || 0)));
    const zone = params.TZID || calendarTz;
    const date = dateInZone(instant, zone);
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: safeZone(zone), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
    return { date, allDay: false, midnight: time === "00:00" };
  }
  return { date: `${y}-${mo}-${d}`, allDay: false, midnight: hh === "00" && mi === "00" };
}

function safeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_TZ;
  }
}

// --- ICS text ---

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

interface Prop { name: string; params: Record<string, string>; value: string }

function parseLine(line: string): Prop | null {
  // NAME;PARAM=a;PARAM2="b:c":value — the first colon outside quotes ends the params.
  let inQuote = false;
  let split = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ":" && !inQuote) { split = i; break; }
  }
  if (split < 0) return null;
  const head = line.slice(0, split).split(";");
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(split + 1) };
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

function cleanText(s: string): string {
  return unescapeText(s)
    .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&#039;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").trim();
}

interface RawVEvent {
  uid: string;
  summary: string;
  description: string;
  location: string | null;
  url: string | null;
  start: IcsDate;
  end: IcsDate | null;
  duration: string | null;
  rrule: string | null;
  exdates: Set<string>;
  rdates: string[];
  recurrenceId: string | null;
  cancelled: boolean;
}

function parseDuration(value: string): number {
  // Whole days only; that's all a date-level calendar needs. P1D, P2DT4H, PT3H, P1W.
  const m = value.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const hours = (+(m[1] || 0)) * 168 + (+(m[2] || 0)) * 24 + (+(m[3] || 0)) + (+(m[4] || 0)) / 60;
  return Math.max(0, Math.ceil(hours / 24) - (hours % 24 === 0 ? 0 : 1));
}

function endDateOf(ev: RawVEvent): string {
  const start = ev.start.date;
  if (ev.end) {
    let end = ev.end.date;
    // All-day DTEND is exclusive, and a timed event ending at midnight ends the day before.
    if (ev.end.allDay || (ev.end.midnight && end > start)) end = addDays(end, -1);
    return end < start ? start : end;
  }
  if (ev.duration) {
    const days = parseDuration(ev.duration);
    return addDays(start, ev.start.allDay ? Math.max(0, days - 1) : days);
  }
  return start;
}

// --- Recurrence (RRULE) ---

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string | null {
  // n = 1..5 from the start of the month, or -1..-5 from the end.
  if (n > 0) {
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    const day = 1 + offset + (n - 1) * 7;
    const d = new Date(Date.UTC(year, month, day));
    return d.getUTCMonth() === month ? ymd(d) : null;
  }
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  const day = last.getUTCDate() - offset + (n + 1) * 7;
  if (day < 1) return null;
  return ymd(new Date(Date.UTC(year, month, day)));
}

// Expands simple RRULEs (DAILY, WEEKLY with BYDAY, MONTHLY by month day or by "2SA"/"-1SU",
// YEARLY) into start dates up to `until`. Anything fancier yields just the first date.
export function expandRRule(rule: string, dtstart: string, windowEnd: string): string[] {
  const parts: Record<string, string> = {};
  for (const p of rule.split(";")) {
    const [k, v] = p.split("=");
    if (k && v) parts[k.toUpperCase()] = v.toUpperCase();
  }
  const freq = parts.FREQ;
  const interval = Math.max(1, parseInt(parts.INTERVAL || "1", 10) || 1);
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : Infinity;
  const untilRaw = parts.UNTIL?.match(/^(\d{4})(\d{2})(\d{2})/);
  const until = untilRaw ? `${untilRaw[1]}-${untilRaw[2]}-${untilRaw[3]}` : null;
  const last = until && until < windowEnd ? until : windowEnd;
  const out: string[] = [];
  const push = (d: string) => {
    if (d < dtstart || d > last || out.length >= Math.min(count, MAX_OCCURRENCES)) return false;
    out.push(d);
    return true;
  };
  const byday = (parts.BYDAY || "").split(",").filter(Boolean)
    .map((t) => t.match(/^([+-]?\d)?(SU|MO|TU|WE|TH|FR|SA)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ n: m[1] ? parseInt(m[1], 10) : 0, wd: WEEKDAYS.indexOf(m[2]) }));
  const bymonthday = (parts.BYMONTHDAY || "").split(",").filter(Boolean).map((n) => parseInt(n, 10));
  const start = parseYmd(dtstart);
  const done = () => out.length >= Math.min(count, MAX_OCCURRENCES);

  if (freq === "DAILY") {
    for (let d = dtstart; d <= last && !done(); d = addDays(d, interval)) push(d);
  } else if (freq === "WEEKLY") {
    const days = byday.length ? byday.map((b) => b.wd) : [start.getUTCDay()];
    const weekStart = addDays(dtstart, -start.getUTCDay());
    for (let w = weekStart; w <= last && !done(); w = addDays(w, 7 * interval)) {
      for (const wd of [...days].sort()) push(addDays(w, wd));
    }
  } else if (freq === "MONTHLY") {
    for (let i = 0; !done(); i += interval) {
      const y = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + i) / 12);
      const mo = (start.getUTCMonth() + i) % 12;
      if (`${y}-${pad(mo + 1)}-01` > last) break;
      const dates: string[] = [];
      if (byday.length) {
        for (const b of byday) {
          if (b.n) { const d = nthWeekdayOfMonth(y, mo, b.wd, b.n); if (d) dates.push(d); }
          else for (let n = 1; n <= 5; n++) { const d = nthWeekdayOfMonth(y, mo, b.wd, n); if (d) dates.push(d); }
        }
        // BYSETPOS=1 / -1 with a BYDAY list ("first Saturday or Sunday") — keep that one.
        const pos = parts.BYSETPOS ? parseInt(parts.BYSETPOS, 10) : 0;
        dates.sort();
        if (pos) { const pick = pos > 0 ? dates[pos - 1] : dates[dates.length + pos]; dates.length = 0; if (pick) dates.push(pick); }
      } else {
        for (const md of bymonthday.length ? bymonthday : [start.getUTCDate()]) {
          const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
          const day = md > 0 ? md : dim + md + 1;
          if (day >= 1 && day <= dim) dates.push(`${y}-${pad(mo + 1)}-${pad(day)}`);
        }
      }
      for (const d of dates.sort()) push(d);
      if (i > 12 * 50) break;
    }
  } else if (freq === "YEARLY") {
    for (let i = 0; !done(); i += interval) {
      const d = `${start.getUTCFullYear() + i}-${dtstart.slice(5)}`;
      if (d > last) break;
      push(d);
    }
  } else {
    push(dtstart);
  }
  return out;
}

// --- Parse a whole calendar ---

// Reads an ICS file into calendar entries, expanding recurring events between `today` and
// `windowEnd` (inclusive). Moved or cancelled single occurrences (RECURRENCE-ID) replace
// the occurrence they belong to.
export function parseIcs(text: string, today: string, windowEnd = addDays(today, 400)): CalendarEntry[] {
  const lines = unfold(text);
  const calTzLine = lines.find((l) => l.startsWith("X-WR-TIMEZONE"));
  const calendarTz = safeZone(calTzLine ? calTzLine.slice(calTzLine.indexOf(":") + 1).trim() : DEFAULT_TZ);
  const raw: RawVEvent[] = [];
  let cur: Partial<RawVEvent> | null = null;
  let depth = 0; // nested components (VALARM) inside a VEVENT
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = { exdates: new Set(), rdates: [], cancelled: false, summary: "", description: "", location: null, url: null, end: null, duration: null, rrule: null, recurrenceId: null, uid: "" }; depth = 0; continue; }
    if (!cur) continue;
    if (line.startsWith("BEGIN:")) { depth++; continue; }
    if (line.startsWith("END:") && line !== "END:VEVENT") { depth = Math.max(0, depth - 1); continue; }
    if (line === "END:VEVENT") {
      if (cur.start) raw.push(cur as RawVEvent);
      cur = null;
      continue;
    }
    if (depth > 0) continue;
    const p = parseLine(line);
    if (!p) continue;
    switch (p.name) {
      case "UID": cur.uid = p.value.trim(); break;
      case "SUMMARY": cur.summary = cleanText(p.value); break;
      case "DESCRIPTION": cur.description = cleanText(p.value); break;
      case "LOCATION": cur.location = cleanText(p.value) || null; break;
      case "URL": cur.url = p.value.trim() || null; break;
      case "DTSTART": cur.start = parseIcsDate(p.value, p.params, calendarTz) ?? undefined; break;
      case "DTEND": cur.end = parseIcsDate(p.value, p.params, calendarTz); break;
      case "DURATION": cur.duration = p.value.trim(); break;
      case "RRULE": cur.rrule = p.value.trim(); break;
      case "STATUS": cur.cancelled = /CANCELLED/i.test(p.value); break;
      case "RECURRENCE-ID": cur.recurrenceId = parseIcsDate(p.value, p.params, calendarTz)?.date ?? null; break;
      case "EXDATE":
        for (const v of p.value.split(",")) { const d = parseIcsDate(v, p.params, calendarTz); if (d) cur.exdates!.add(d.date); }
        break;
      case "RDATE":
        for (const v of p.value.split(",")) { const d = parseIcsDate(v, p.params, calendarTz); if (d) cur.rdates!.push(d.date); }
        break;
    }
  }

  // Occurrences that were moved or cancelled one at a time, keyed by series + original date.
  const overrides = new Map<string, RawVEvent>();
  for (const ev of raw) if (ev.recurrenceId) overrides.set(`${ev.uid}|${ev.recurrenceId}`, ev);

  const out: CalendarEntry[] = [];
  const freqOf = (ev: RawVEvent): CalendarEntry["repeats"] => {
    const f = ev.rrule?.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i)?.[1];
    return f ? (f.toLowerCase() as CalendarEntry["repeats"]) : null;
  };
  const add = (ev: RawVEvent, start: string, span: number, repeats: CalendarEntry["repeats"] = freqOf(ev)) => {
    out.push({
      uid: `${ev.uid || hash(ev.summary)}|${start}`,
      title: ev.summary, description: ev.description, location: ev.location, url: ev.url,
      startDate: start, endDate: addDays(start, span), cancelled: ev.cancelled, repeats,
    });
  };
  const seriesFreq = new Map<string, CalendarEntry["repeats"]>();
  for (const ev of raw) if (ev.rrule && ev.uid) seriesFreq.set(ev.uid, freqOf(ev));
  for (const ev of raw) {
    const span = daysBetween(ev.start.date, endDateOf(ev));
    if (ev.recurrenceId) { add(ev, ev.start.date, span, seriesFreq.get(ev.uid) ?? null); continue; }
    if (!ev.rrule && !ev.rdates.length) { add(ev, ev.start.date, span); continue; }
    const from = addDays(today, -span);
    const dates = new Set([...(ev.rrule ? expandRRule(ev.rrule, ev.start.date, windowEnd) : [ev.start.date]), ...ev.rdates]);
    for (const d of [...dates].sort()) {
      if (d < from || ev.exdates.has(d)) continue;
      if (overrides.has(`${ev.uid}|${d}`)) continue; // the override is added on its own
      add(ev, d, span);
    }
  }
  return out;
}

// --- Is it a shoot? ---

// Always skipped, whatever else the title says.
const HARD_EXCLUDE = /\b(no (?:club )?shoots?|meetings?|work ?days?|work ?party|clean ?-?up|board|maintenance|banquet|potluck|pot luck|volunteers?|orientation|range (?:is )?closed|closed|cancell?ed|postponed|rain ?out|set ?-?up|tear ?-?down|course build|target build|fundraiser dinner)\b/i;
// Skipped unless the title also names a tournament-type event.
const SOFT_EXCLUDE = /\b(leagues?|league nights?|practice|lessons?|class(?:es)?|clinic|camp|open range|range open|open house|open shooting|open hours|range hours|range day|range nights?|youth night|club night|social|birthday|private|rental|homeschool|scouts?|ladies archery|bingo|raffle)\b/i;
const STRONG = /\b(tournament|championships?|champs|qualifier|classic|invitational|sectionals?|state|cup|shoot-?off|finals?)\b/i;
const SHOOT = /\b(shoots?|shootout|shoot-out|3-?d|tournaments?|open|classic|qualifiers?|qualifer|championships?|champs|invitational|sywat|tfaa|nfaa|asa|tbot|s3da|ibo|r100|field round|900 round|720 round|vegas|300 round|600 round|lonestar 600|rendezvous|safari|novelty|competition|cup|challenge|bowhunter|marathon|sectionals?|match)\b/i;
const ARCHERY = /\b(arch(?:er|ery|ers)|bow(?:s|hunters?|men)?|3-?d|arrows?|joad|tfaa|nfaa|asa|tbot|s3da)\b/i;

// `repeats` is how often the calendar repeats the entry: a weekly or daily series is a
// league, class or practice night unless its title says tournament.
export function isArcheryShoot(
  title: string, requireArcheryWord = false, description = "", repeats: CalendarEntry["repeats"] = null,
): boolean {
  const t = title.trim();
  if (!t) return false;
  if (HARD_EXCLUDE.test(t)) return false;
  if (SOFT_EXCLUDE.test(t) && !STRONG.test(t)) return false;
  if ((repeats === "weekly" || repeats === "daily") && !STRONG.test(t)) return false;
  if (requireArcheryWord && !ARCHERY.test(t) && !(ARCHERY.test(description) && SHOOT.test(t))) return false;
  return SHOOT.test(t);
}

// Which governing body an event belongs to, when the title makes that clear.
export function organizationFor(title: string, fallback: string): string {
  if (/\bASA\b/.test(title)) return "ASA";
  if (/\b(TFAA|NFAA|SYWAT)\b/i.test(title)) return "NFAA";
  if (/\b(USA Archery|TSAA|JOAD)\b/i.test(title)) return "USA Archery";
  if (/\bS3DA\b/i.test(title)) return "S3DA";
  if (/\bIBO\b/.test(title)) return "IBO";
  if (/\bTBOT\b/i.test(title)) return "TBOT";
  return fallback;
}

export function feedName(feed: ClubFeed): string {
  return `CLUB: ${feed.club}`;
}

function cityFrom(location: string | null, fallback: string | null): string | null {
  // "Club name, 123 Road, Liberty Hill, TX 78642, USA" -> "Liberty Hill"
  if (location) {
    const parts = location.split(",").map((s) => s.trim());
    const i = parts.findIndex((p) => /^(TX|Texas)\b/i.test(p));
    if (i > 0 && !/\d/.test(parts[i - 1])) return parts[i - 1];
  }
  return fallback;
}

function toClubEvent(feed: ClubFeed, e: CalendarEntry): ClubEvent {
  const isLink = (u: string | null) => !!u && /^https?:\/\//i.test(u);
  const descLink = e.description.match(/https?:\/\/[^\s<>"')]+/)?.[0] ?? null;
  return {
    id: `club-${hash(`${feed.club}|${e.uid}`)}`,
    source: "CLUB",
    feedName: feedName(feed),
    organization: organizationFor(e.title, feed.organization),
    name: e.title,
    startDate: e.startDate,
    endDate: e.endDate,
    location: e.location ?? ([feed.club, feed.city, feed.state].filter(Boolean).join(", ") || null),
    city: cityFrom(e.location, feed.city),
    state: feed.state,
    registrationStart: null, registrationEnd: null,
    contact: feed.club, phone: null, email: null,
    sourceUrl: isLink(e.url) ? e.url! : feed.siteUrl || (isLink(descLink) ? descLink! : feed.url),
  };
}

// "SYWAT 6pm" and "SYWAT" on the next two days are one weekend event.
function sameShootTitle(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase()
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/g, " ")
    .replace(/\b(day|round)\s*(\d|one|two|three)\b/g, " ")
    .replace(/\b(fri(day)?|sat(urday)?|sun(day)?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
  return norm(a) === norm(b);
}

// Keeps upcoming archery shoots from a club calendar and shapes them for the feed.
// Entries with the same title on back-to-back days are joined into one event.
export function clubEventsFromEntries(feed: ClubFeed, entries: CalendarEntry[], today: string, windowEnd = addDays(today, 400)): ClubEvent[] {
  const kept = entries
    .filter((e) => !e.cancelled && e.endDate >= today && e.startDate <= windowEnd)
    .filter((e) => isArcheryShoot(e.title, feed.requireArcheryWord, e.description, e.repeats ?? null))
    // An entry spanning weeks is a league season or a sale, not a shoot.
    .filter((e) => daysBetween(e.startDate, e.endDate) <= 14 || STRONG.test(e.title))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));
  const merged: CalendarEntry[] = [];
  for (const e of kept) {
    const prev = merged.findLast((m) => sameShootTitle(m.title, e.title));
    if (prev && e.startDate <= addDays(prev.endDate, 1)) {
      if (e.endDate > prev.endDate) prev.endDate = e.endDate;
      if (e.title.length < prev.title.length) prev.title = e.title; // "SYWAT" over "SYWAT 6pm"
      prev.location ??= e.location;
      prev.url ??= e.url;
      continue;
    }
    merged.push({ ...e });
  }
  return merged.map((e) => toClubEvent(feed, e));
}

// --- WordPress "The Events Calendar" REST API ---

interface TribeVenue { venue?: string; address?: string; city?: string; state?: string; stateprovince?: string; zip?: string }
export interface TribeRawEvent {
  id?: number; title?: string; description?: string; url?: string; website?: string;
  start_date?: string; end_date?: string; all_day?: boolean; status?: string;
  venue?: TribeVenue | [];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function tribeToEntries(rows: TribeRawEvent[]): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  for (const row of rows) {
    const title = decodeEntities(row.title || "");
    const start = (row.start_date || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    let end = (row.end_date || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? start;
    if (!title || !start || !end) continue;
    // A timed event that runs until midnight ends the day before.
    if (end > start && /\s00:00(:00)?$/.test(row.end_date || "")) end = addDays(end, -1);
    const venue = Array.isArray(row.venue) ? {} : row.venue || {};
    const location = [venue.venue, venue.address, venue.city, venue.state || venue.stateprovince]
      .map((s) => (s ? decodeEntities(s) : "")).filter(Boolean).join(", ") || null;
    out.push({
      uid: String(row.id ?? hash(`${title}|${start}`)),
      title, description: decodeEntities(row.description || ""), location,
      url: row.url || null, startDate: start, endDate: end < start ? start : end,
      cancelled: /cancel/i.test(row.status || ""),
    });
  }
  return out;
}

// --- Squarespace events page (?format=json) ---

interface SquarespaceLocation { addressTitle?: string; addressLine1?: string; addressLine2?: string }
export interface SquarespaceRawEvent {
  id?: string; title?: string; startDate?: number; endDate?: number; fullUrl?: string;
  excerpt?: string; location?: SquarespaceLocation;
}
export interface SquarespaceEventsPage {
  website?: { timeZone?: string };
  upcoming?: SquarespaceRawEvent[];
}

// Squarespace gives times as epoch milliseconds; dates are taken in the site's time zone.
export function squarespaceToEntries(page: SquarespaceEventsPage, pageUrl: string): CalendarEntry[] {
  const zone = safeZone(page.website?.timeZone || DEFAULT_TZ);
  const out: CalendarEntry[] = [];
  for (const row of page.upcoming ?? []) {
    const title = decodeEntities(row.title || "");
    if (!title || typeof row.startDate !== "number") continue;
    const start = dateInZone(new Date(row.startDate), zone);
    let end = typeof row.endDate === "number" ? dateInZone(new Date(row.endDate), zone) : start;
    // Ending at local midnight means the day before.
    if (end > start && typeof row.endDate === "number") {
      const t = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(row.endDate));
      if (t === "00:00") end = addDays(end, -1);
    }
    const loc = row.location || {};
    const location = [loc.addressTitle, loc.addressLine1, loc.addressLine2].map((s) => (s || "").trim()).filter(Boolean).join(", ") || null;
    let url: string | null = null;
    try { url = row.fullUrl ? new URL(row.fullUrl, pageUrl).href : null; } catch { url = null; }
    out.push({
      uid: row.id || hash(`${title}|${start}`), title, description: decodeEntities(row.excerpt || ""),
      location, url, startDate: start, endDate: end < start ? start : end, cancelled: false,
    });
  }
  return out;
}

// --- Matching club events against the association feeds ---

function words(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// True when an association feed (TFAA, Texas ASA, TSAA) already lists this shoot: same
// start date, and the same city or the club's name in the other event.
export function alreadyListed(
  ev: ClubEvent,
  others: { startDate: string; name: string; location: string | null; city: string | null; contact?: string | null }[],
): boolean {
  const club = words(ev.contact);
  const clubKey = club.replace(/\b(archery|club|association|the|of|texas|range)\b/g, " ").replace(/\s+/g, " ").trim();
  const city = words(ev.city);
  return others.some((o) => {
    if (o.startDate !== ev.startDate) return false;
    const hay = words(`${o.name} ${o.location ?? ""} ${o.city ?? ""} ${o.contact ?? ""}`);
    if (city && words(o.city) === city) return true;
    return !!clubKey && clubKey.length >= 4 && hay.includes(clubKey);
  });
}

// --- Fetching (network) ---

export interface ClubFeedStatus {
  name: string;
  url: string;
  status: "ok" | "partial" | "error";
  message: string | null;
  eventCount: number;
  fetchedAt: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function fetchText(url: string, accept: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function loadEntries(feed: ClubFeed, today: string): Promise<CalendarEntry[]> {
  if (feed.feedType === "ics") {
    const text = await fetchText(feed.url, "text/calendar,*/*");
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Not a calendar file (the link may have changed or gone private).");
    return parseIcs(text, today);
  }
  if (feed.feedType === "squarespace") {
    const page = feed.url.replace(/\/$/, "");
    const data = JSON.parse(await fetchText(`${page}?format=json`, "application/json")) as SquarespaceEventsPage;
    if (!Array.isArray(data.upcoming) && !("past" in data)) throw new Error("Not a Squarespace events page.");
    return squarespaceToEntries(data, feed.url);
  }
  const rows: TribeRawEvent[] = [];
  const base = feed.url.replace(/\/$/, "");
  let next: string | null = `${base}?start_date=${today}&per_page=50`;
  for (let page = 0; next && page < 10; page++) {
    const data = JSON.parse(await fetchText(next, "application/json")) as { events?: TribeRawEvent[]; next_rest_url?: string };
    rows.push(...(data.events ?? []));
    next = data.next_rest_url || null;
  }
  return tribeToEntries(rows);
}

// Reads every club feed. One feed failing never affects the others; each gets its own
// status row named "CLUB: <club>". A calendar with no upcoming shoots is "ok" with 0 events
// (clubs go quiet in the off-season), unlike a feed that can't be read, which is "error".
export async function collectClubFeeds(
  feeds: ClubFeed[],
  today = new Date().toISOString().slice(0, 10),
): Promise<{ events: ClubEvent[]; sources: ClubFeedStatus[] }> {
  const results = await Promise.all(feeds.map(async (feed) => {
    const fetchedAt = new Date().toISOString();
    const name = feedName(feed);
    const url = feed.siteUrl || feed.url;
    try {
      const entries = await loadEntries(feed, today);
      const events = clubEventsFromEntries(feed, entries, today);
      const upcoming = entries.filter((e) => e.endDate >= today).length;
      const status: ClubFeedStatus = {
        name, url, status: "ok", eventCount: events.length, fetchedAt,
        message: events.length ? null : `Calendar loaded (${upcoming} upcoming entries) but none look like shoots right now.`,
      };
      return { events, status };
    } catch (err) {
      const status: ClubFeedStatus = {
        name, url, status: "error", eventCount: 0, fetchedAt,
        message: err instanceof Error ? err.message : String(err),
      };
      return { events: [] as ClubEvent[], status };
    }
  }));
  return { events: results.flatMap((r) => r.events), sources: results.map((r) => r.status) };
}

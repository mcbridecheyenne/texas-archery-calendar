// Collects TFAA, Texas ASA and TSAA events and writes them to one events.json file.
// Run by GitHub Actions every few hours (.github/workflows/pages.yml); the website
// and the phone app both read the file it produces.
//
//   node --experimental-strip-types script/collect-events.ts dist/public/events.json
//
// If one association's site can't be reached, its events from the last good run are
// kept (read from PREVIOUS_EVENTS_URL) so a temporary outage doesn't empty the calendar.
//
// Texas shoots from data/manual-events.json (clubs that emailed them in, added by a
// reviewed pull request) are added with source "CLUB".
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getEvents, type CombinedResult, type TournamentEvent } from "../api/_scrapers.ts";

const outPath = process.argv[2] ?? "dist/public/events.json";
const previousUrl = process.env.PREVIOUS_EVENTS_URL;

async function loadPrevious(): Promise<CombinedResult | null> {
  if (!previousUrl) return null;
  try {
    const res = await fetch(`${previousUrl}?t=${Date.now()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as CombinedResult;
    return Array.isArray(data?.events) ? data : null;
  } catch {
    return null;
  }
}

const [fresh, previous] = await Promise.all([getEvents(), loadPrevious()]);

for (const status of fresh.sources) {
  const failed = status.status === "error" || status.eventCount === 0;
  if (!failed || !previous) continue;
  const kept = previous.events.filter((e) => e.source === status.name);
  if (!kept.length) continue;
  const prevStatus = previous.sources.find((s) => s.name === status.name);
  fresh.events.push(...kept);
  status.status = "partial";
  status.eventCount = kept.length;
  status.fetchedAt = prevStatus?.fetchedAt ?? previous.lastUpdated;
  status.message = `Couldn't reach ${status.name} on the latest check, so these are from the last good update.`;
  console.warn(`${status.name}: fresh pull failed, kept ${kept.length} events from the previous run`);
}

// --- Club-submitted Texas shoots (data/manual-events.json) ---
interface ManualEvent {
  organization: string; name: string; startDate: string; endDate?: string;
  city?: string; state?: string; location?: string; sourceUrl: string;
  flyer?: string; // e.g. "flyers/<slug>.jpg", made by script/prepare-flyer.sh
}

const SITE_URL = "https://mcbridecheyenne.github.io/texas-archery-calendar/";

function hash(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

function loadClubShoots(): TournamentEvent[] {
  const path = new URL("../data/manual-events.json", import.meta.url);
  if (!existsSync(path)) return [];
  try {
    const rows = JSON.parse(readFileSync(path, "utf8")) as ManualEvent[];
    return rows
      .filter((row) => ["TX", "TEXAS"].includes((row.state ?? "").trim().toUpperCase()))
      .map((row) => ({
        id: `club-${hash(`${row.name}|${row.startDate}`)}`,
        source: "CLUB" as const,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate ?? row.startDate,
        location: row.location ?? null,
        city: row.city ?? null,
        state: "TX",
        registrationStart: null,
        registrationEnd: null,
        contact: row.organization,
        phone: null,
        email: null,
        sourceUrl: row.sourceUrl,
        flyerUrl: row.flyer ? new URL(row.flyer, SITE_URL).href : null,
      }));
  } catch (err) {
    console.warn(`data/manual-events.json could not be read, skipping club shoots: ${err}`);
    return [];
  }
}

const clubShoots = loadClubShoots();
fresh.events.push(...clubShoots);
console.log(`Club-submitted Texas shoots: ${clubShoots.length}`);

fresh.events.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));

for (const s of fresh.sources) {
  console.log(`${s.name}: ${s.status}, ${s.eventCount} events${s.message ? ` (${s.message})` : ""}`);
}

if (fresh.events.length === clubShoots.length) {
  // Leave the currently published file in place rather than publishing an empty calendar.
  console.error("No events collected from any source. Not publishing.");
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(fresh));
console.log(`Wrote ${fresh.events.length} events to ${outPath}`);

// Collects TFAA, Texas ASA and TSAA events and writes them to one events.json file.
// Run by GitHub Actions every few hours (.github/workflows/pages.yml); the website
// and the phone app both read the file it produces.
//
//   node --experimental-strip-types script/collect-events.ts dist/public/events.json
//
// If one association's site can't be reached, its events from the last good run are
// kept (read from PREVIOUS_EVENTS_URL) so a temporary outage doesn't empty the calendar.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getEvents, type CombinedResult } from "../api/_scrapers.ts";

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

fresh.events.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));

for (const s of fresh.sources) {
  console.log(`${s.name}: ${s.status}, ${s.eventCount} events${s.message ? ` (${s.message})` : ""}`);
}

if (fresh.events.length === 0) {
  // Leave the currently published file in place rather than publishing an empty calendar.
  console.error("No events collected from any source. Not publishing.");
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(fresh));
console.log(`Wrote ${fresh.events.length} events to ${outPath}`);

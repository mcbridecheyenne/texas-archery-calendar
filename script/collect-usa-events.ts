// Collects nationwide events (the Texas sources plus World Archery, the ASA Pro/Am tour and the hand-kept
// list in data/manual-events.json) into events-usa.json. Runs next to collect-events.ts in
// .github/workflows/pages.yml; the current app's events.json is not touched.
//
//   node --experimental-strip-types script/collect-usa-events.ts dist/public/events-usa.json
//
// As with the Texas feed, a source that fails keeps its events from the last good run
// (read from PREVIOUS_EVENTS_URL).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getUsaEvents, type UsaResult } from "../api/_national.ts";

const args = process.argv.slice(2);
const outPath = args.find((a) => !a.startsWith("--")) ?? "dist/public/events-usa.json";
// A deliberate shrink (for example a source was removed on purpose) can pass --force or set ALLOW_SHRINK=1.
const force = args.includes("--force") || process.env.ALLOW_SHRINK === "1";
// A run that finds less than this share of the previous count is treated as a broken run.
const MIN_SHARE = 0.5;
const MIN_PREVIOUS = 20;
const previousUrl = process.env.PREVIOUS_EVENTS_URL;

async function loadPrevious(): Promise<UsaResult | null> {
  if (!previousUrl) return null;
  try {
    if (!/^https?:\/\//.test(previousUrl)) {
      // A local file path (used for testing with fixtures).
      const data = JSON.parse(readFileSync(previousUrl, "utf8")) as UsaResult;
      return Array.isArray(data?.events) ? data : null;
    }
    const res = await fetch(`${previousUrl}?t=${Date.now()}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as UsaResult;
    return Array.isArray(data?.events) ? data : null;
  } catch {
    return null;
  }
}

const [fresh, previous] = await Promise.all([getUsaEvents(), loadPrevious()]);

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
  console.error("No events collected from any source. Not publishing.");
  process.exit(1);
}

if (previous && previous.events.length >= MIN_PREVIOUS && fresh.events.length < previous.events.length * MIN_SHARE) {
  const msg = `Only ${fresh.events.length} events collected, but the previous feed had ${previous.events.length} ` +
    `(under ${MIN_SHARE * 100}%).`;
  if (!force) {
    console.error(`${msg} Refusing to publish a near-empty run; the last good file stays live. ` +
      "If this drop is deliberate, rerun with --force or ALLOW_SHRINK=1.");
    process.exit(1);
  }
  console.warn(`${msg} Publishing anyway because --force / ALLOW_SHRINK=1 is set.`);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(fresh));
console.log(`Wrote ${fresh.events.length} events to ${outPath}`);

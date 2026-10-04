// Scratch probe 3: more Texas clubs; save pages; try Squarespace / tribe / ICS endpoints.
import { mkdirSync, writeFileSync } from "node:fs";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const today = new Date().toISOString().slice(0, 10);
mkdirSync("probe-out/p3", { recursive: true });
async function get(url, accept = "text/html,*/*") {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    return { status: res.status, url: res.url, text: await res.text() };
  } catch (e) {
    return { status: 0, url, text: "", error: String(e?.cause?.code || e?.message || e) };
  }
}
const slug = (u) => u.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 90);
const log = [];
const SITES = [
  "https://www.fredericksburg3darchery.org/",
  "https://permianbasinarchers.com/",
  "https://x10archery.org/",
  "https://tejasjoadarchery.com/",
  "http://www.centraltexasarchery.org.s3-website-us-west-2.amazonaws.com/calendar",
  "http://www.centraltexasarchery.org.s3-website-us-west-2.amazonaws.com/events",
  "https://hogheaven.com/",
  "https://www.texsar.org/archeryshoot/",
  "https://buckdoes.com/class/alamo-area-joad-archery/",
  "https://www.archeryhqtx.com/events",
  "https://lgrgc.wildapricot.org/TeamUp-Calendar",
];
for (const s of SITES) {
  const r = await get(s);
  log.push(`${r.status} ${s} -> ${r.url} ${r.error || ""} len=${r.text.length} ${/squarespace/i.test(r.text) ? "SQS" : ""} ${/wp-content/i.test(r.text) ? "WP" : ""} ${/wixstatic/i.test(r.text) ? "WIX" : ""}`);
  if (r.text) writeFileSync(`probe-out/p3/${slug(s)}.html`, r.text);
  const gc = [...r.text.replace(/&amp;/g, "&").matchAll(/calendar\.google\.com\/calendar\/[^"'\s<>]*/g)].map((m) => m[0]);
  if (gc.length) log.push(`  GCAL ${[...new Set(gc)].join(" ")}`);
  const team = [...r.text.matchAll(/teamup\.com\/([a-z0-9]+)/gi)].map((m) => m[1]);
  if (team.length) log.push(`  TEAMUP ${[...new Set(team)].join(" ")}`);
}
// Squarespace collection guesses
for (const base of ["https://www.fredericksburg3darchery.org", "https://permianbasinarchers.com", "https://x10archery.org", "https://tejasjoadarchery.com"]) {
  for (const p of ["events", "calendar", "schedule", "shoots", "tournaments", "upcoming-events", "event-calendar"]) {
    const r = await get(`${base}/${p}?format=json`, "application/json");
    let note = "";
    try { const d = JSON.parse(r.text); note = d.upcoming || d.past ? `EVENTS up=${(d.upcoming || []).length} past=${(d.past || []).length}` : `json keys=${Object.keys(d).slice(0, 5)}`; } catch { note = "not json"; }
    log.push(`SQS ${r.status} ${base}/${p} ${note}`);
    if (/EVENTS/.test(note)) writeFileSync(`probe-out/p3/sqs_${slug(base + p)}.json`, r.text);
  }
}
for (const base of ["https://hogheaven.com", "https://sfhogheaven.com", "https://www.texsar.org", "https://x10archery.org", "https://permianbasinarchers.com", "https://www.fredericksburg3darchery.org"]) {
  const r = await get(`${base}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`, "application/json");
  log.push(`TRIBE ${r.status} ${base} ${r.text.slice(0, 150).replace(/\s+/g, " ")}`);
  if (r.status === 200) writeFileSync(`probe-out/p3/tribe_${slug(base)}.json`, r.text);
}
writeFileSync("probe-out/p3/log.txt", log.join("\n"));
console.log(log.join("\n"));

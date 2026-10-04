// Scratch probe 4: a few specific pages.
import { mkdirSync, writeFileSync } from "node:fs";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
mkdirSync("probe-out/p4", { recursive: true });
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
const URLS = [
  "https://permianbasinarchers.com/schedules?format=json",
  "https://permianbasinarchers.com/txnm-events?format=json",
  "https://permianbasinarchers.com/schedules",
  "https://www.x10academy.com/book/public-calendar",
  "https://www.x10academy.com/book/events",
  "https://www.fredericksburg3darchery.org/?format=json",
  "https://www.abilenebowhunters.com/local-competitions?format=json",
  "https://www.archeryhqtx.com/events?format=json",
];
for (const u of URLS) {
  const r = await get(u, u.includes("format=json") ? "application/json" : "text/html");
  log.push(`${r.status} ${u} -> ${r.url} ${r.error || ""} len=${r.text.length}`);
  const gc = [...r.text.replace(/&amp;/g, "&").matchAll(/calendar\.google\.com\/calendar\/[^"'\s<>\\]*/g)].map((m) => m[0]);
  if (gc.length) log.push(`  GCAL ${[...new Set(gc)].join(" ")}`);
  const ics = [...r.text.matchAll(/[^"'\s<>]*\.ics\b[^"'\s<>]*/g)].map((m) => m[0]);
  if (ics.length) log.push(`  ICS ${[...new Set(ics)].slice(0, 5).join(" ")}`);
  if (r.text) writeFileSync(`probe-out/p4/${slug(u)}.txt`, r.text.slice(0, 2_000_000));
}
writeFileSync("probe-out/p4/log.txt", log.join("\n"));
console.log(log.join("\n"));

// Scratch probe 2: load candidate feeds from GitHub's network and record compact summaries.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (compatible; ArcheryInTheUSA-probe/1.0; +https://mcbridecheyenne.github.io/texas-archery-calendar/)";
const today = new Date().toISOString().slice(0, 10);
mkdirSync("out/raw", { recursive: true });

const urls = new Set();
for (const line of readFileSync("urls.txt", "utf8").split("\n")) {
  const u = line.trim().replace("TODAY", today);
  if (!u || u.startsWith("#")) continue;
  urls.add(u);
  const url = new URL(u);
  if (url.pathname === "/" && !url.search) {
    urls.add(`${url.origin}/robots.txt`);
    urls.add(`${url.origin}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`);
  }
}

const safe = (u) => u.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 150);
const unfold = (s) => s.replace(/\r?\n[ \t]/g, "");
function icsSummary(body) {
  return unfold(body).split("BEGIN:VEVENT").slice(1).map((b) => {
    const g = (k) => (b.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "m")) || [])[1]?.trim() ?? "";
    return [g("DTSTART"), g("DTEND"), g("SUMMARY"), g("LOCATION"), g("UID"), g("URL")].join(" | ");
  });
}
function jsonSummary(j) {
  if (Array.isArray(j?.events)) return { total: j.total, events: j.events.map((e) => [e.id, e.start_date, e.end_date, e.title, (e.categories || []).map((c) => c.slug).join(","), e.venue?.venue, e.venue?.city, e.venue?.state || e.venue?.stateprovince, e.url].join(" | ")) };
  if (Array.isArray(j?.categories)) return { categories: j.categories.map((c) => `${c.id} ${c.slug} (${c.count})`) };
  const sq = j?.upcoming || j?.items || j?.past;
  if (sq || j?.collection) {
    const rows = [...(j.upcoming || []), ...(j.items || [])];
    return { squarespace: true, collection: j.collection?.type, n: rows.length, past: (j.past || []).length, items: rows.slice(0, 60).map((i) => [i.id, i.urlId, i.startDate && new Date(i.startDate).toISOString(), i.endDate && new Date(i.endDate).toISOString(), i.title, i.location?.addressTitle, i.location?.addressLine1, i.location?.addressLine2, i.fullUrl].join(" | ")) };
  }
  if (Array.isArray(j?.events) === false && Array.isArray(j)) return { array: j.length, first: JSON.stringify(j[0])?.slice(0, 1500) };
  if (j?.routes) return { routes: Object.keys(j.routes).filter((r) => !/\/wp\/v2\/(users|settings|themes|plugins|block|templat|global|navigation|menu|font|sidebars|widget|search|media|comments|types|statuses|taxonomies)/.test(r)).slice(0, 120) };
  return { keys: Object.keys(j || {}).slice(0, 30), sample: JSON.stringify(j).slice(0, 2000) };
}

const results = [];
const list = [...urls];
let i = 0;
async function worker() {
  while (i < list.length) {
    const url = list[i++];
    const r = { url };
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 25000);
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, redirect: "follow", signal: ctl.signal });
      clearTimeout(t);
      const body = await res.text();
      r.status = res.status; r.finalUrl = res.url; r.type = res.headers.get("content-type"); r.bytes = body.length;
      r.vevents = (body.match(/BEGIN:VEVENT/g) || []).length;
      if (r.vevents) r.ics = icsSummary(body).slice(0, 80);
      try { r.json = jsonSummary(JSON.parse(body)); } catch {}
      r.googleLinks = [...new Set([...body.matchAll(/https?:\/\/(?:docs|calendar)\.google\.com\/[^"' <>)]+/g)].map((m) => m[0]))].slice(0, 10);
      r.icalLinks = [...new Set([...body.matchAll(/href="([^"]*(?:\.ics|ical=1|webcal:|ICalendar)[^"]*)"/gi)].map((m) => m[1]))].slice(0, 10);
      r.platform = ["wildapricot", "squarespace", "wix.com", "clubexpress", "tribe-events", "localist", "teamup", "weebly", "godaddy", "93ft", "shopify"].filter((p) => body.toLowerCase().includes(p));
      if (/robots\.txt$/.test(url)) r.text = body.slice(0, 3000);
      if (r.json || r.vevents) continue;
      const clean = body
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .replace(/\b(?:pk|sk|tk)\.[A-Za-z0-9._-]{20,}/g, "[key]")
        .replace(/(?<![\w/.-])[A-Za-z0-9_\-+=]{40,}/g, "[long]");
      writeFileSync(`out/raw/${safe(url)}`, clean.slice(0, 300000));
    } catch (e) {
      r.error = String(e?.cause?.code || e?.name || e);
    } finally {
      results.push(r);
      console.log(r.status ?? r.error, url);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
results.sort((a, b) => a.url.localeCompare(b.url));
writeFileSync("out/results.json", JSON.stringify(results, null, 1));

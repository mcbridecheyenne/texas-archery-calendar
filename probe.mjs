// Scratch probe: load every candidate schedule found in the state-by-state research from
// GitHub's network (the cloud sandbox can't reach these sites) and record what each returns.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (compatible; ArcheryInTheUSA-probe/1.0; +https://mcbridecheyenne.github.io/texas-archery-calendar/)";
const today = new Date().toISOString().slice(0, 10);
mkdirSync("out/raw", { recursive: true });

const urls = new Set();
for (const f of readdirSync("candidates")) {
  for (const e of JSON.parse(readFileSync(`candidates/${f}`, "utf8"))) {
    for (const u of [e.url, e.feedUrl]) if (u && /^https?:\/\//.test(u) && !u.includes("<")) urls.add(u);
  }
}
// WordPress "The Events Calendar" JSON and robots.txt for every site.
const origins = new Set([...urls].map((u) => new URL(u).origin));
for (const o of origins) {
  urls.add(`${o}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`);
  urls.add(`${o}/robots.txt`);
}
// Terms pages for the multi-state platforms.
for (const u of [
  "https://www.nfaausa.com/terms-of-use", "https://nfaausa.com/terms-of-use", "https://www.nfaausa.com/privacy-policy",
  "https://www.nfaausa.com/events?state=OH", "https://nasptournaments.org/robots.txt",
  "https://www.ibo.org/events/", "https://www.ibo.org/wp-json/tribe/events/v1/events?per_page=50",
  "https://www.totalarcherychallenge.com/events", "https://washingtonarchery.org/calendars",
]) urls.add(u);

const safe = (u) => u.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 150);
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
      r.status = res.status;
      r.finalUrl = res.url;
      r.type = res.headers.get("content-type");
      r.bytes = body.length;
      r.vevents = (body.match(/BEGIN:VEVENT/g) || []).length;
      r.archeryMentions = (body.match(/archery|3-?d shoot|bowhunt|field archery/gi) || []).length;
      try {
        const j = JSON.parse(body);
        if (Array.isArray(j?.events)) { r.tribeEvents = j.events.length; r.tribeTotal = j.total; r.sample = j.events.slice(0, 5).map((e) => `${e.start_date?.slice(0, 10)} ${e.title} @ ${e.venue?.city ?? ""} ${e.venue?.state ?? e.venue?.stateprovince ?? ""}`); }
      } catch {}
      r.googleCalendars = [...new Set([...body.matchAll(/calendar\.google\.com\/calendar\/(?:embed\?[^"' ]*?src=|ical\/)([^&"' /]+)/g)].map((m) => decodeURIComponent(m[1])))];
      r.icalLinks = [...new Set([...body.matchAll(/href="([^"]*(?:\.ics|ical=1|webcal:)[^"]*)"/gi)].map((m) => m[1]))].slice(0, 10);
      r.platform = ["wildapricot", "squarespace", "wix.com", "clubexpress", "tribe-events", "localist", "teamup", "weebly", "godaddy", "93ft"].filter((p) => body.toLowerCase().includes(p));
      if (/robots\.txt$|terms|privacy/.test(url)) r.text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000);
      // Saved without scripts and with long key-like strings blanked (sites embed map keys etc.).
      const clean = body
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/\b(?:pk|sk|tk)\.[A-Za-z0-9._-]{20,}/g, "[key]")
        .replace(/[A-Za-z0-9_\-+/=]{40,}/g, (m) => (/^https?:/.test(m) ? m : "[long]"));
      writeFileSync(`out/raw/${safe(url)}`, clean.slice(0, 300000));
    } catch (e) {
      r.error = String(e?.cause?.code || e?.name || e);
    }
    results.push(r);
    console.log(r.status ?? r.error, url);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
results.sort((a, b) => a.url.localeCompare(b.url));
writeFileSync("out/results.json", JSON.stringify(results, null, 1));

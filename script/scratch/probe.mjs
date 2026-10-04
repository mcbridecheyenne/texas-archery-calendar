// Scratch probe 2: save raw pages and feed samples for a closer look.
import { mkdirSync, writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const today = new Date().toISOString().slice(0, 10);
mkdirSync("probe-out/html", { recursive: true });

async function get(url, accept = "text/html,*/*") {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    return { status: res.status, url: res.url, text: await res.text(), type: res.headers.get("content-type") || "" };
  } catch (e) {
    return { status: 0, url, text: "", error: String(e?.cause?.code || e?.message || e) };
  }
}
const slug = (u) => u.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 90);
const log = [];

const PAGES = [
  "https://austinarcheryclub.com/events/",
  "https://austinarcheryclub.com/details3d/",
  "https://hillcountrybowhunters.com/3d-archery/",
  "https://hillcountrybowhunters.com/",
  "https://tylerarcheryclub.com/",
  "https://texasarchery.info/dallas-tournaments",
  "https://texasarchery.info/",
  "https://www.cowtownbowmen.com/Shoots.html",
  "https://huacobowmen.org/events",
  "https://www.tbot.org/schedule.html",
  "https://www.tbot.org/schedule_club.html",
  "https://pearlandarcheryclub.com/calendar/",
  "https://tejasbowmen.com/",
  "https://sherwoodarchery.com/",
  "https://viking-archery.com/Archery_Events_in_the_Texas_Hill_Country_near_San_Antonio.php",
  "http://www.collincountybowhunters.org/",
  "https://www.fortgrard.com/",
  "https://ttha.com/archery-tournament/",
  "https://d24-h.tamu.edu/3d-archery-shoot",
  "http://centraltexasarchery.org/",
  "https://centraltexasarchery.org/calendar",
  "https://southplainsarchery.com/",
  "https://darkhorse-archery.com/",
  "https://www.archerytrainingcenter.com/",
  "https://lgrgc.com/events",
  "https://lgrgc.com/Range-Calendar",
  "https://www.legacyarcherydfw.com/",
  "https://abilenebowhunters.com/",
  "https://www.brazoscountyarchery.com/",
  "https://leadingedgearchery.com/",
  "https://buckdoes.com/archery-range/",
  "https://www.ibatx.org/schedule-and-events",
  "https://www.redriverbowmenarcheryclub.com/calendar",
  "https://hogheaven.com/events",
  "https://baytownarcheryclub.com/",
  "https://www.bananabendarchery.club/",
  "https://archerycountry.com/collections/events-classes-leagues",
  "https://texarchery.com/pages/events",
  "https://www.arjunarcheryacademy.com/tournaments/upcoming-tournaments",
  "https://tamuarchery.com/",
  "https://ncscshooting.org/",
  "https://huntersarchery.com/",
];

const WP = ["https://austinarcheryclub.com", "https://hillcountrybowhunters.com", "https://tylerarcheryclub.com", "https://texasarchery.info",
  "https://leadingedgearchery.com", "https://buckdoes.com", "https://huntersarchery.com", "http://www.collincountybowhunters.org", "https://ncscshooting.org",
  "https://ttha.com", "https://d24-h.tamu.edu", "https://buffalofield.org"];

const ICS = [
  ["Archery Training Center", "https://calendar.google.com/calendar/ical/3cdthat5q4hfrg00krafu4bt6k%40group.calendar.google.com/public/basic.ics"],
  ["Brazos County", "https://calendar.google.com/calendar/ical/brazoscountyarchery%40gmail.com/public/basic.ics"],
  ["Fort Grard", "https://calendar.google.com/calendar/ical/ube761ip2hg745mmckus74206o%40group.calendar.google.com/public/basic.ics"],
  ["Buffalo Field ical", "https://buffalofield.org/events/?ical=1"],
];

const JSONS = [
  "https://www.archeryhqtx.com/events?format=json",
  "https://www.abilenebowhunters.com/local-competitions?format=json",
  "https://www.abilenebowhunters.com/clubevents?format=json",
  "https://buffalofield.org/wp-json/tribe/events/v1/events?per_page=50&start_date=" + today,
  "https://d24-h.tamu.edu/wp-json/tribe/events/v1/events?per_page=50&start_date=" + today,
];

for (const p of PAGES) {
  const r = await get(p);
  log.push(`${r.status} ${p} -> ${r.url} ${r.error || ""} ${r.text.length}`);
  if (r.text) writeFileSync(`probe-out/html/${slug(p)}.html`, r.text);
}
for (const w of WP) {
  const r = await get(`${w}/wp-json/`, "application/json");
  let ns = "";
  try { ns = JSON.parse(r.text).namespaces?.join(" ") ?? ""; } catch { ns = `not json (${r.status})`; }
  log.push(`WPNS ${w}: ${ns}`);
}
for (const [n, u] of ICS) {
  const r = await get(u, "text/calendar");
  writeFileSync(`probe-out/html/ics_${slug(n)}.ics`, r.text);
  log.push(`ICS ${r.status} ${n} ${r.text.length}`);
}
for (const u of JSONS) {
  const r = await get(u, "application/json");
  writeFileSync(`probe-out/html/json_${slug(u)}.json`, r.text.slice(0, 400000));
  log.push(`JSON ${r.status} ${u} ${r.text.length}`);
}
writeFileSync("probe-out/log2.txt", log.join("\n"));
console.log(log.join("\n"));

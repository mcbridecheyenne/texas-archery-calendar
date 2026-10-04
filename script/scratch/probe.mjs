// Scratch probe: finds machine-readable calendar feeds on Texas archery club sites.
import { mkdirSync, writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const today = new Date().toISOString().slice(0, 10);

const SEEDS = [
  ["Austin Archery Club", "Austin", "https://austinarcheryclub.com/"],
  ["Brazos County Archery Club", "Bryan", "https://www.brazoscountyarchery.com/"],
  ["Buffalo Field Archery Club", "Houston", "https://buffalofield.org/"],
  ["Central Texas Archery", "Manor", "https://centraltexasarchery.org/"],
  ["Cowtown Bowmen", "Fort Worth", "https://www.cowtownbowmen.com/"],
  ["Irving Bowhunters Association", "Dallas", "https://www.ibatx.org/"],
  ["Texans Archery Club (Elm Fork)", "Dallas", "https://texasarchery.info/"],
  ["Hill Country Bow Hunters", "Liberty Hill", "https://hillcountrybowhunters.com/"],
  ["Huaco Bowmen", "Waco", "https://huacobowmen.org/"],
  ["Tyler Archery Club", "Tyler", "https://tylerarcheryclub.com/"],
  ["The Carriage Archery Club", "Houston", "https://thecarriagehtx.com/"],
  ["Traditional Bowhunters of Texas", "", "https://www.tbot.org/"],
  ["Viking Archery", "San Antonio", "https://viking-archery.com/"],
  ["TexArchery", "", "https://texarchery.com/"],
  ["Elm Fork Shooting Sports", "Dallas", "https://elmfork.com/"],
  ["Cinnamon Creek Ranch", "Roanoke", "https://www.cinnamoncreekranch.com/"],
  ["Texas A&M Archery", "College Station", "https://tamuarchery.com/"],
  ["Arjun Archery Academy", "Frisco", "https://www.arjunarcheryacademy.com/"],
  ["Legacy Archery DFW", "Fort Worth", "https://www.legacyarcherydfw.com/"],
  ["Leading Edge Archery", "Boerne", "https://leadingedgearchery.com/"],
  ["Banana Bend Archery Club", "Baytown", "https://www.bananabendarchery.club/"],
  ["Baytown Archery Club", "Baytown", "https://baytownarcheryclub.com/"],
  ["Mesquite Archery Club", "Terrell", "https://www.mesquitearcheryclub.com/"],
  ["Pearland Archery Club", "Pearland", "https://pearlandarcheryclub.com/"],
  ["Archery Training Center", "Austin", "https://www.archerytrainingcenter.com/"],
  ["Archery HQ", "New Braunfels", "https://www.archeryhqtx.com/"],
  ["Buck & Doe's Mercantile", "San Antonio", "https://buckdoes.com/"],
  ["SF Hog Heaven", "", "https://sfhogheaven.com/"],
  ["Archer County AgriLife (Holliday Creek Archery)", "Archer City", "https://archer.agrilife.org/"],
  ["4-H District 3D shoot (AgriLife D2/4)", "", "https://d24-h.tamu.edu/"],
  ["Texas Trophy Hunters Association", "", "https://ttha.com/"],
  ["Lake Granbury? LGRGC", "", "https://lgrgc.com/"],
  ["Texas State Archery Association", "", "https://texasarchery.org/"],
  ["Texas ASA Federation", "", "https://www.txasafederation.com/"],
  ["Texas Field Archery Association", "", "https://texasfieldarchery.org/"],
  ["Sherwood Archery", "Bedias", "https://sherwoodarchery.com/"],
  ["Panola Archery Club", "Carthage", "https://panolaarcheryclub.com/"],
  ["Target Seekers", "Lubbock", "https://targetseekers.org/"],
  ["South Plains Archery Club", "Lubbock", "https://southplainsarchery.com/"],
  ["Palo Duro Bowhunters", "Amarillo", "https://palodurobowhunters.com/"],
  ["Archers for Christ", "Paris", "https://archersforchrist.org/"],
  ["Tejas Bowmen", "Corpus Christi", "https://tejasbowmen.com/"],
  ["Archer's Haven", "Canyon Lake", "https://archershaven.com/"],
  ["Arrow Minded Outdoors", "Bulverde", "https://arrowmindedoutdoors.com/"],
  ["Dark Horse Archery", "Orange Grove", "https://darkhorsearchery.com/"],
  ["Enduring Freedom Academy", "San Antonio", "https://enduringfreedomacademy.com/"],
  ["1975 Ranch 3D Archery", "Von Ormy", "https://1975ranch.com/"],
  ["Saddle River Range", "Conroe", "https://saddleriverrange.com/"],
  ["Texas Archery Academy", "", "https://texasarcheryacademy.com/"],
  ["Archery Country", "Houston", "https://archerycountry.com/"],
  ["Hunters Archery", "", "https://huntersarchery.com/"],
  ["Rio Grande Valley Shooting Center", "Rio Hondo", "https://rgvsc.com/"],
  ["Victoria Shooting Sports", "Victoria", "https://victoriashootingsports.com/"],
  ["Gateway Archery", "Fort Worth", "https://gatewayarchery.com/"],
  ["Texas Longbow Shoot", "", "https://texaslongbow.com/"],
  ["Lone Star Selfbow Society", "", "https://lonestarselfbow.com/"],
  ["Golden Triangle Archery", "Beaumont", "https://goldentrianglearchery.com/"],
  ["Rockdale Archery / Bowhunters Texas", "", "https://bowhunterstx.com/"],
];

const DIRECTORIES = [
  "https://texasfieldarchery.org/clubs",
  "https://www.txasafederation.com/club-links",
  "https://www.tbot.org/schedule_club.html",
  "https://www.tbot.org/schedule.html",
  "https://centraltexasarchery.org/archery-associations",
  "https://www.ibatx.org/copy-of-sponsors",
  "https://texasarchery.org/Events",
];

const SKIP_HOSTS = /(facebook|instagram|twitter|x\.com|youtube|google\.com\/maps|maps\.google|goo\.gl|wix\.com|squarespace\.com|godaddy|weebly\.com$|tiktok|linkedin|pinterest|apple\.com|paypal|venmo|usarchery|nfaausa|asaarchery|worldarchery|mailto|tel:|gstatic|googleapis|cloudflare|jquery|fonts\.|wp\.com|gravatar|w3\.org|schema\.org|yelp|amazon|bit\.ly|linktr\.ee|eventbrite|archeryeventshub|addthis|sharethis|doubleclick|googletagmanager|wixstatic|parastorage|cdn\.|typekit)/i;

async function get(url, accept = "text/html,*/*") {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: ctrl.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, text, type: res.headers.get("content-type") || "" };
  } catch (e) {
    return { ok: false, status: 0, url, text: "", error: String(e?.cause?.code || e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

function abs(href, base) {
  try { return new URL(href.replace(/&amp;/g, "&"), base).href; } catch { return null; }
}

function links(html, base) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = abs(m[1], base);
    if (u) out.push({ url: u, text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) });
  }
  return out;
}

function platform(html) {
  if (/wp-content|wp-json/i.test(html)) return "WordPress";
  if (/static\.wixstatic|wix\.com|_wixCIDX|wixBiSession/i.test(html)) return "Wix";
  if (/squarespace/i.test(html)) return "Squarespace";
  if (/sites\.google\.com|gstatic\.com\/atari/i.test(html)) return "Google Sites";
  if (/weebly/i.test(html)) return "Weebly";
  if (/godaddy|img1\.wsimg\.com/i.test(html)) return "GoDaddy";
  if (/cdn\.shopify/i.test(html)) return "Shopify";
  if (/joomla/i.test(html)) return "Joomla";
  return "other";
}

function googleCalIds(text) {
  const ids = new Set();
  const decoded = text.replace(/&amp;/g, "&");
  const re = /calendar\.google\.com\/calendar\/(?:u\/\d\/)?(?:embed|ical|htmlembed|r|b\/\d\/embed)[^"'\s<>]*/gi;
  let m;
  while ((m = re.exec(decoded))) {
    const frag = m[0];
    const srcRe = /[?&](?:src|cid)=([^&"'\s#]+)/g;
    let s;
    while ((s = srcRe.exec(frag))) {
      let id = decodeURIComponent(s[1]);
      if (/^[A-Za-z0-9+/=]+$/.test(id) && !id.includes("@") && id.length > 20) {
        try { const b = Buffer.from(id, "base64").toString("utf8"); if (b.includes("@")) id = b; } catch {}
      }
      ids.add(id);
    }
    const ical = frag.match(/\/ical\/([^/]+)\//);
    if (ical) ids.add(decodeURIComponent(ical[1]));
  }
  return [...ids];
}

function icsLinks(text, base) {
  const out = new Set();
  const re = /(?:href|src|data-[a-z-]+)\s*=\s*["']([^"']*(?:\.ics\b|webcal:|[?&]ical=1|format=ical)[^"']*)["']/gi;
  let m;
  while ((m = re.exec(text))) {
    const u = abs(m[1].replace(/^webcal:/i, "https:"), base);
    if (u) out.add(u);
  }
  return [...out];
}

function countIcs(text) {
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  let upcoming = 0;
  const samples = [];
  for (const b of blocks) {
    const ds = (b.match(/\nDTSTART[^:]*:(\d{8})/) || [])[1];
    const rrule = /\nRRULE:/.test(b);
    const sum = ((b.match(/\nSUMMARY[^:]*:(.*)/) || [])[1] || "").trim();
    const iso = ds ? `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}` : "";
    if (iso >= today || rrule) { upcoming++; if (samples.length < 12) samples.push(`${iso}${rrule ? " (RRULE)" : ""} ${sum}`); }
  }
  return { total: blocks.length, upcoming, samples };
}

async function probeIcs(url) {
  const r = await get(url, "text/calendar,*/*");
  if (!r.ok || !r.text.includes("BEGIN:VCALENDAR")) return { url, ok: false, status: r.status, error: r.error, head: r.text.slice(0, 120) };
  return { url, ok: true, ...countIcs(r.text), calname: (r.text.match(/X-WR-CALNAME:(.*)/) || [])[1]?.trim() };
}

async function probeTribe(origin) {
  const url = `${origin}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`;
  const r = await get(url, "application/json");
  if (!r.ok) return { url, ok: false, status: r.status, error: r.error };
  try {
    const d = JSON.parse(r.text);
    return { url, ok: true, total: d.total, samples: (d.events || []).slice(0, 12).map((e) => `${(e.start_date || "").slice(0, 10)} ${e.title}`) };
  } catch { return { url, ok: false, status: r.status, error: "not json" }; }
}

async function probeSquarespace(pageUrl) {
  const url = `${pageUrl.replace(/\/$/, "")}?format=json`;
  const r = await get(url, "application/json");
  if (!r.ok) return { url, ok: false, status: r.status };
  try {
    const d = JSON.parse(r.text);
    const up = d.upcoming || [];
    if (!d.upcoming && !d.past) return { url, ok: false, error: "no upcoming/past keys" };
    return { url, ok: true, total: up.length, past: (d.past || []).length, samples: up.slice(0, 12).map((e) => `${new Date(e.startDate).toISOString().slice(0, 10)} ${e.title}`) };
  } catch { return { url, ok: false, error: "not json" }; }
}

async function probeSite([club, city, url]) {
  const rec = { club, city, site: url, reachable: false, platform: null, pages: [], googleCalendars: [], icsLinks: [], tribe: null, squarespace: [], notes: [] };
  const home = await get(url);
  rec.homeStatus = home.status;
  if (!home.ok) { rec.notes.push(`home ${home.status} ${home.error || ""}`); return rec; }
  rec.reachable = true;
  rec.finalUrl = home.url;
  rec.platform = platform(home.text);
  const origin = new URL(home.url).origin;
  const host = new URL(home.url).host.replace(/^www\./, "");
  const cand = links(home.text, home.url)
    .filter((l) => { try { return new URL(l.url).host.replace(/^www\./, "") === host; } catch { return false; } })
    .filter((l) => /event|calendar|schedule|shoot|tournament|3d|competition|league/i.test(`${l.url} ${l.text}`));
  const pageUrls = [...new Set(cand.map((l) => l.url.split("#")[0]))].slice(0, 6);
  for (const guess of ["/events/", "/calendar/"]) if (pageUrls.length < 8) pageUrls.push(origin + guess);
  const texts = [{ url: home.url, text: home.text }];
  for (const p of [...new Set(pageUrls)]) {
    const r = await get(p);
    rec.pages.push(`${r.status} ${p}`);
    if (r.ok) texts.push({ url: r.url, text: r.text });
  }
  const gids = new Set();
  const icsSet = new Set();
  for (const t of texts) {
    googleCalIds(t.text).forEach((g) => gids.add(g));
    icsLinks(t.text, t.url).forEach((i) => icsSet.add(i));
    // Google Sites embed calendars inside iframes on a different host; follow those.
    const ifr = [...t.text.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => abs(m[1], t.url)).filter(Boolean);
    for (const f of ifr.slice(0, 4)) {
      if (/calendar\.google\.com/.test(f)) { googleCalIds(f).forEach((g) => gids.add(g)); continue; }
      if (/googleusercontent|sites\.google/.test(f)) {
        const r = await get(f);
        if (r.ok) googleCalIds(r.text).forEach((g) => gids.add(g));
      }
    }
    if (/inffuse|calendar-embed|boomte|elfsight|teamup|addevent|localist|timely|calendarwiz|calendar\.time\.ly/i.test(t.text)) {
      const w = t.text.match(/inffuse|boomte|elfsight|teamup|addevent|localist|timely|calendarwiz/i)?.[0];
      rec.notes.push(`calendar widget: ${w} on ${t.url}`);
    }
    if (/wix-events|events-widget|wixEvents|"events":\{/i.test(t.text) && rec.platform === "Wix") rec.notes.push(`Wix events widget? ${t.url}`);
  }
  for (const g of gids) {
    const ics = `https://calendar.google.com/calendar/ical/${encodeURIComponent(g)}/public/basic.ics`;
    rec.googleCalendars.push({ id: g, ...(await probeIcs(ics)) });
  }
  for (const i of [...icsSet].slice(0, 5)) rec.icsLinks.push(await probeIcs(i));
  if (rec.platform === "WordPress" || texts.some((t) => /tribe-events|wp-json/i.test(t.text))) {
    rec.tribe = await probeTribe(origin);
    if (!rec.tribe.ok) {
      const icsGuess = await probeIcs(`${origin}/events/?ical=1`);
      if (icsGuess.ok) rec.icsLinks.push(icsGuess);
    }
  }
  if (rec.platform === "Squarespace") {
    for (const t of texts.slice(1)) if (/event|calendar|schedule|shoot/i.test(t.url)) rec.squarespace.push(await probeSquarespace(t.url));
  }
  return rec;
}

async function harvest() {
  const found = [];
  for (const d of DIRECTORIES) {
    const r = await get(d);
    if (!r.ok) { found.push({ directory: d, status: r.status, error: r.error }); continue; }
    const ext = links(r.text, r.url).filter((l) => {
      try { const h = new URL(l.url).host; return h && !h.endsWith(new URL(r.url).host.replace(/^www\./, "")) && !SKIP_HOSTS.test(l.url) && /^https?:/.test(l.url); } catch { return false; }
    });
    const calendars = googleCalIds(r.text);
    found.push({ directory: d, status: r.status, links: ext, calendars });
    // TFAA club pages may hold club websites one level down.
    if (/texasfieldarchery\.org\/clubs/.test(d)) {
      const clubPages = links(r.text, r.url).filter((l) => /texasfieldarchery\.org\/(club|clubview|view)/i.test(l.url)).slice(0, 80);
      const sub = [];
      for (const cp of clubPages) {
        const rr = await get(cp.url);
        if (!rr.ok) continue;
        const ex = links(rr.text, rr.url).filter((l) => { try { return !/texasfieldarchery/.test(new URL(l.url).host) && !SKIP_HOSTS.test(l.url) && /^https?:/.test(l.url); } catch { return false; } });
        sub.push({ page: cp.url, text: cp.text, links: ex.map((e) => e.url) });
      }
      found.push({ directory: `${d} (club pages)`, sub });
      found.push({ directory: `${d} (raw sample)`, sample: r.text.replace(/\s+/g, " ").slice(0, 6000) });
    }
  }
  return found;
}

mkdirSync("probe-out", { recursive: true });
const dirs = await harvest();
writeFileSync("probe-out/directories.json", JSON.stringify(dirs, null, 1));

// Add harvested sites not already seeded.
const seededHosts = new Set(SEEDS.map((s) => new URL(s[2]).host.replace(/^www\./, "")));
const extra = [];
for (const d of dirs) {
  const all = [...(d.links || []).map((l) => ({ url: l.url, text: l.text })), ...((d.sub || []).flatMap((s) => s.links.map((u) => ({ url: u, text: s.text }))))];
  for (const l of all) {
    let h; try { h = new URL(l.url).host.replace(/^www\./, ""); } catch { continue; }
    if (seededHosts.has(h)) continue;
    seededHosts.add(h);
    extra.push([l.text || h, "", new URL(l.url).origin + "/"]);
  }
}
const sites = [...SEEDS, ...extra.slice(0, 80)];
const results = [];
const queue = [...sites];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try { results.push(await probeSite(s)); } catch (e) { results.push({ club: s[0], site: s[2], error: String(e) }); }
  }
}));
results.sort((a, b) => a.club.localeCompare(b.club));
writeFileSync("probe-out/sites.json", JSON.stringify(results, null, 1));

const lines = ["| Club | Site | Platform | Feeds |", "|---|---|---|---|"];
for (const r of results) {
  const feeds = [
    ...(r.googleCalendars || []).map((g) => `GCal ${g.id}: ${g.ok ? `${g.upcoming}/${g.total}` : `ERR ${g.status}`}`),
    ...(r.icsLinks || []).map((g) => `ICS ${g.url}: ${g.ok ? `${g.upcoming}/${g.total}` : `ERR ${g.status}`}`),
    ...(r.tribe ? [`tribe: ${r.tribe.ok ? r.tribe.total : `ERR ${r.tribe.status}`}`] : []),
    ...(r.squarespace || []).map((s) => `sqs ${s.url}: ${s.ok ? s.total : "ERR"}`),
  ].join("<br>");
  lines.push(`| ${r.club} | ${r.site} (${r.homeStatus ?? "?"}) | ${r.platform ?? "-"} | ${feeds || (r.notes || []).join("; ")} |`);
}
writeFileSync("probe-out/summary.md", lines.join("\n"));
console.log(lines.join("\n"));

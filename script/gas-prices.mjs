// Builds gas-prices.json: today's average price of regular gas in every state, from AAA's
// state averages page. The phone app uses the archer's state average for trip costs when
// they haven't typed in their own gas price. Run by the website job (pages.yml).
//
// Usage: node script/gas-prices.mjs dist/public/gas-prices.json
//
// If AAA can't be reached, the last published file is kept for up to two weeks (read from
// PREVIOUS_GAS_URL), so a hiccup never leaves the app without prices.
import fs from "node:fs";
import path from "node:path";

const AAA_URL = "https://gasprices.aaa.com/state-gas-price-averages/";
const KEEP_DAYS = 14;
const outPath = process.argv[2] ?? "dist/public/gas-prices.json";
const today = new Date().toISOString().slice(0, 10);

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcheryInTheUSA/1.0; +https://mcbridecheyenne.github.io/texas-archery-calendar/)" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// The page's map lists every state as "TX,Texas,$3.7868,<link>,<color>;".
function parse(html) {
  const states = {};
  for (const m of html.matchAll(/(?:^|[;"])([A-Z]{2}),[A-Za-z .]+,\$(\d+\.\d+),/g)) {
    const price = Number(m[2]);
    if (price > 1 && price < 15) states[m[1]] = Math.round(price * 100) / 100;
  }
  return states;
}

async function previous() {
  const url = process.env.PREVIOUS_GAS_URL;
  if (!url) return null;
  try {
    const d = JSON.parse(await fetchText(`${url}?t=${Date.now()}`));
    const age = (Date.parse(today) - Date.parse(d.checked)) / 86400000;
    return d.states && Object.keys(d.states).length >= 40 && age <= KEEP_DAYS ? d : null;
  } catch {
    return null;
  }
}

let out;
try {
  const states = parse(await fetchText(AAA_URL));
  const prices = Object.values(states);
  if (prices.length < 40) throw new Error(`only found ${prices.length} states`);
  const national = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;
  out = { checked: today, source: "AAA", national, states };
  console.log(`Gas prices: ${prices.length} states, Texas $${states.TX}, average $${national}`);
} catch (e) {
  out = await previous();
  if (!out) {
    console.error(`Couldn't get gas prices (${e.message}) and no recent file to keep.`);
    process.exit(1);
  }
  console.warn(`Couldn't get gas prices (${e.message}); keeping the ones from ${out.checked}.`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));

// Builds hotel-prices.json from a day's hotel searches. Used by the daily Claude routine
// that refreshes hotel prices (see hotel-towns.yml).
//
// Usage: node script/hotel-prices.mjs <hotel-towns.json> <results.json> [<yesterday's hotel-prices.json>] > hotel-prices.json
// results.json maps each town key ("brownwood, tx") to the nightly prices (USD) of the
// hotels a search found for that town's nights.
import fs from "node:fs";

const MIN_HOTELS = 4; // fewer than this isn't a fair range
const KEEP_DAYS = 7; // reuse yesterday's prices this long when a search comes back thin

const [townsFile, resultsFile, prevFile] = process.argv.slice(2);
const { towns } = JSON.parse(fs.readFileSync(townsFile, "utf8"));
const results = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
const prev = prevFile && fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, "utf8")).cities ?? {} : {};
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (iso) => (Date.parse(today) - Date.parse(iso)) / 86400000;

const cities = {};
const counts = { fresh: 0, kept: 0, dropped: 0 };
for (const t of towns) {
  const prices = (results[t.key] ?? []).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (prices.length >= MIN_HOTELS) {
    const n = prices.length;
    const typical = Math.round(prices.reduce((s, p) => s + p, 0) / n / 5) * 5;
    const low = prices[0];
    const high = prices[Math.ceil(0.9 * n) - 1];
    cities[t.key] = {
      low,
      typical: Math.min(Math.max(typical, low), high),
      high,
      checked: today,
      hotels: n,
      checkin: t.checkin,
      checkout: t.checkout,
    };
    counts.fresh++;
  } else if (prev[t.key] && daysAgo(prev[t.key].checked) <= KEEP_DAYS) {
    cities[t.key] = prev[t.key];
    counts.kept++;
  } else {
    counts.dropped++;
  }
}

const sorted = Object.fromEntries(Object.keys(cities).sort().map((k) => [k, cities[k]]));
const out = {
  updated: today,
  note:
    "Nightly hotel prices (USD, 2 adults, before taxes) found in a hotel search for each shoot town for the nights of its next shoot (check-in the night before). low = cheapest, high = 90th percentile, typical = average. Refreshed daily by a Claude routine.",
  cities: sorted,
};
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
console.error(`${counts.fresh} towns priced, ${counts.kept} kept from earlier, ${counts.dropped} without prices (of ${towns.length})`);

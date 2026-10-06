// Lists the towns with upcoming shoots, and the nights to price hotels for in each (the
// night before its next shoot through the shoot's last day). Written to hotel-towns.json on
// the hotel-data branch every day by .github/workflows/hotel-towns.yml; a daily Claude
// routine reads it, searches hotel prices for each town, and writes hotel-prices.json back
// to that branch. The website publishes that file and the phone app reads it.
//
// Usage: node script/hotel-towns.mjs <events.json> [<events-usa.json> ...] > hotel-towns.json
import fs from "node:fs";

const DAYS_AHEAD = 180; // only shoots in the next ~6 months
const STATES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const CODES = new Set(Object.values(STATES));

// Same rules as stateCode() and cityKey() in mobile/src/features/calendar/{states,hotels}.ts.
function stateCode(text) {
  const t = String(text ?? "").trim();
  if (CODES.has(t.toUpperCase())) return t.toUpperCase();
  return STATES[t.toLowerCase()] ?? null;
}
function cityKey(e) {
  const city = String(e.city ?? "").trim().replace(/\s+/g, " ");
  const code = stateCode(e.state);
  if (!city || /^tba$/i.test(city) || !code) return null;
  return { key: `${city}, ${code}`.toLowerCase(), city, state: code };
}

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const today = iso(new Date());
const horizon = addDays(today, DAYS_AHEAD);

const towns = new Map();
for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(file)) continue;
  for (const e of JSON.parse(fs.readFileSync(file, "utf8")).events ?? []) {
    const end = e.endDate < e.startDate ? e.startDate : e.endDate;
    if (end < today || e.startDate > horizon) continue;
    const place = cityKey(e);
    if (!place) continue;
    // Night before the shoot (most archers drive in the evening before) through its last day.
    let checkin = addDays(e.startDate, -1);
    if (checkin < today) checkin = today;
    let checkout = end > checkin ? end : addDays(checkin, 1);
    const prev = towns.get(place.key);
    if (prev && prev.checkin <= checkin) continue; // keep each town's soonest shoot
    towns.set(place.key, { ...place, checkin, checkout, shoot: e.name });
  }
}

const out = { updated: today, towns: [...towns.values()].sort((a, b) => a.key.localeCompare(b.key)) };
process.stdout.write(JSON.stringify(out, null, 1) + "\n");

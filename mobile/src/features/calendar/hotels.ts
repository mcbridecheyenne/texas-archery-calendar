// "Hotels near the shoot": nightly hotel prices in the shoot's town, and a link to search
// hotels for the shoot's dates.
//
// Town prices come from hotel-prices.json on the website: the lowest, highest and average
// nightly price found for each shoot town in a real hotel search for the nights of that
// town's next shoot. A Claude routine refreshes them every day on the hotel-data branch
// (see .github/workflows/hotel-towns.yml on main); client/public/hotel-prices.json is the
// fallback copy. The card says which nights were searched and when. Towns not in that file fall back to a typical range for the state (an estimate,
// spot-checked against live prices in Oct 2026). Edit PRICE_TIERS / STATE_TIER to adjust it.
//
// The link goes through Stay22, which shows hotels from Booking.com, Expedia, Hotels.com
// and Vrbo and pays a commission on stays booked from it. Until the Stay22 affiliate id is
// filled in (config.ts → HOTELS.stay22Aid), the button opens a plain Booking.com search
// so it still works, but nothing is earned.
import { useEffect, useState } from "react";
import { parseISODate, toIso } from "./dates";
import { stateCode, stateName } from "./states";
import { readJSON, writeJSON } from "./storage";
import type { TournamentEvent } from "./types";

export interface HotelsConfig {
  enabled: boolean;
  /** Stay22 affiliate id ("aid"). Blank: the button opens a Booking.com search that earns nothing. */
  stay22Aid: string;
  /** Label for Stay22's reports, so app clicks show apart from website clicks. */
  campaign: string;
  /** hotel-prices.json on the website: real prices per shoot town. */
  pricesUrl?: string;
}

export interface PriceRange {
  low: number;
  typical: number;
  high: number;
}

// Per night, before taxes, for 2 adults. "low" is an economy motel, "high" a newer
// upper-midscale chain hotel (Hampton, Holiday Inn Express), "typical" in between.
const PRICE_TIERS: Record<"budget" | "middle" | "pricey" | "island", PriceRange> = {
  budget: { low: 75, typical: 120, high: 190 },
  middle: { low: 85, typical: 140, high: 230 },
  pricey: { low: 105, typical: 170, high: 290 },
  island: { low: 150, typical: 250, high: 420 },
};

const STATE_TIER: Record<string, keyof typeof PRICE_TIERS> = {
  AL: "budget", AR: "budget", IA: "budget", IN: "budget", KS: "budget", KY: "budget", LA: "budget",
  MO: "budget", MS: "budget", ND: "budget", NE: "budget", NM: "budget", OH: "budget", OK: "budget",
  SD: "budget", WV: "budget",
  AZ: "middle", DE: "middle", GA: "middle", ID: "middle", IL: "middle", MI: "middle", MN: "middle",
  MT: "middle", NC: "middle", NH: "middle", NV: "middle", OR: "middle", PA: "middle", SC: "middle",
  TN: "middle", TX: "middle", UT: "middle", VA: "middle", WI: "middle", WY: "middle", ME: "middle",
  CA: "pricey", CO: "pricey", CT: "pricey", DC: "pricey", FL: "pricey", MA: "pricey", MD: "pricey",
  NJ: "pricey", NY: "pricey", RI: "pricey", VT: "pricey", WA: "pricey",
  AK: "island", HI: "island",
};

/** A town's prices from hotel-prices.json. */
export interface CityPrices extends PriceRange {
  /** The date the search was run (YYYY-MM-DD). */
  checked: string;
  /** How many hotels the prices came from. */
  hotels?: number;
  /** The nights searched (YYYY-MM-DD): the night before the town's next shoot through its last day. */
  checkin?: string;
  checkout?: string;
}

/** hotel-prices.json: keyed by cityKey(), e.g. "brownwood, tx". */
export interface CityPriceTable {
  updated: string;
  cities: Record<string, CityPrices>;
}

export type HotelPriceInfo =
  | ({ scope: "city"; place: string } & CityPrices)
  | ({ scope: "state"; place: string } & PriceRange);

/** "brownwood, tx": how a town is looked up in hotel-prices.json. Null without a real town. */
export function cityKey(e: Pick<TournamentEvent, "city" | "state">): string | null {
  const city = (e.city ?? "").trim().replace(/\s+/g, " ");
  const code = stateCode(e.state);
  if (!city || /^tba$/i.test(city) || !code) return null;
  return `${city}, ${code}`.toLowerCase();
}

/**
 * Nightly hotel prices near a shoot: the town's own prices when hotel-prices.json has them,
 * otherwise the state's typical range. Null when neither the town nor the state is known.
 */
export function hotelPrices(
  e: Pick<TournamentEvent, "city" | "state">,
  table?: CityPriceTable | null
): HotelPriceInfo | null {
  const code = stateCode(e.state);
  const key = cityKey(e);
  const city = key ? table?.cities[key] : undefined;
  if (city && isRange(city)) return { scope: "city", place: `${(e.city ?? "").trim()}, ${code}`, ...city };
  const tier = code ? STATE_TIER[code] : undefined;
  return tier ? { scope: "state", place: stateName(code) ?? code!, ...PRICE_TIERS[tier] } : null;
}

function isRange(v: unknown): v is CityPrices {
  const r = v as CityPrices;
  return !!r && [r.low, r.typical, r.high].every((n) => typeof n === "number" && n > 0) && r.low <= r.high;
}

// Loaded once per app launch and saved on the phone, so the card shows town prices offline
// and right away on the next launch.
const CACHE_KEY = "hotelPrices.v1";
let loading: Promise<CityPriceTable | null> | null = null;
let latest: CityPriceTable | null = null;

function loadTable(url: string): Promise<CityPriceTable | null> {
  loading ??= (async () => {
    latest = await readJSON<CityPriceTable>(CACHE_KEY);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as CityPriceTable;
        if (data && typeof data.cities === "object" && data.cities) {
          latest = data;
          writeJSON(CACHE_KEY, data);
        }
      }
    } catch {
      // Offline or the file isn't there: keep the saved copy (or the state estimates).
    }
    return latest;
  })();
  return loading;
}

/** The town price table, or null while loading / when there's none (state estimates are used then). */
export function useCityPrices(url: string | undefined): CityPriceTable | null {
  const [table, setTable] = useState<CityPriceTable | null>(latest);
  useEffect(() => {
    if (!url) return;
    let live = true;
    loadTable(url).then((t) => live && setTable(t));
    return () => {
      live = false;
    };
  }, [url]);
  return table;
}

/** "Brownwood, TX", or the state name when there's no town; null when there's nothing to search. */
export function hotelPlace(e: Pick<TournamentEvent, "city" | "state" | "location">): string | null {
  const code = stateCode(e.state);
  const city = (e.city ?? "").trim();
  if (city && !/^tba$/i.test(city)) return code ? `${city}, ${code}` : city;
  const loc = (e.location ?? "").trim();
  if (loc && !/^tba\b/i.test(loc)) return loc;
  return stateName(code);
}

/**
 * The nights to search: from the night before the shoot (most archers drive in the evening
 * before) to the last day. Never starts in the past. Null once the shoot is over.
 */
export function hotelNights(e: Pick<TournamentEvent, "startDate" | "endDate">, today = new Date()): { checkin: string; checkout: string } | null {
  const todayIso = toIso(today);
  const end = e.endDate < e.startDate ? e.startDate : e.endDate;
  if (end < todayIso) return null;
  const s = parseISODate(e.startDate);
  let checkin = toIso(new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1));
  if (checkin < todayIso) checkin = todayIso;
  let checkout = end;
  if (checkout <= checkin) {
    const c = parseISODate(checkin);
    checkout = toIso(new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1));
  }
  return { checkin, checkout };
}

/** Where the "Find hotels" button goes, or null when the shoot has no place or is over. */
export function hotelSearchUrl(
  e: Pick<TournamentEvent, "city" | "state" | "location" | "startDate" | "endDate">,
  config: HotelsConfig,
  today = new Date()
): string | null {
  const place = hotelPlace(e);
  const nights = hotelNights(e, today);
  if (!place || !nights) return null;
  const address = /\b(usa|united states)\b/i.test(place) ? place : `${place}, USA`;
  const aid = config.stay22Aid.trim();
  if (aid) {
    const campaign: Record<string, string> = config.campaign ? { campaign: config.campaign } : {};
    return `https://www.stay22.com/allez/roam?${query({ aid, ...campaign, address, ...nights })}`;
  }
  return `https://www.booking.com/searchresults.html?${query({ ss: address, ...nights, group_adults: "2" })}`;
}

// Built by hand: React Native's URLSearchParams can't be relied on without a polyfill.
function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

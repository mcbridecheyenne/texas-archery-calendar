// "Hotels near the shoot": nightly hotel prices in the shoot's town, and a link to search
// hotels for the shoot's dates.
//
// Town prices come from hotel-prices.json on the website: the lowest, highest and average
// nightly price found for each shoot town in a real hotel search for the nights of that
// town's next shoot. A Claude routine refreshes them every day on the hotel-data branch
// (see .github/workflows/hotel-towns.yml on main); client/public/hotel-prices.json is the
// fallback copy. The card says which nights were searched and when. Towns not in that file
// show no prices, just the "Find hotels" button.
//
// The link goes through Stay22, which shows hotels from Booking.com, Expedia, Hotels.com
// and Vrbo and pays a commission on stays booked from it. Until the Stay22 affiliate id is
// filled in (config.ts → HOTELS.stay22Aid), the button opens a plain Booking.com search
// so it still works, but nothing is earned.
import { useEffect, useState } from "react";
import { parseISODate, toIso } from "./dates";
import { stateCode } from "./states";
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

export type HotelPriceInfo = { place: string } & CityPrices;

/**
 * True when a shoot's "city" isn't a real town: empty, "TBA", "Multiple", "Various", or a range or
 * event title like "College Station Texas - Aggie Invite". Same rule as the hotel price job
 * (script/hotel-towns.mjs on main), so the app and the prices agree on which towns exist.
 */
export function isPlaceholderTown(city: string | null | undefined): boolean {
  const c = (city ?? "").trim().replace(/\s+/g, " ");
  return !c || /^(tba|multiple|various)$/i.test(c) || /\s-\s/.test(c);
}

/** "brownwood, tx": how a town is looked up in hotel-prices.json. Null without a real town. */
export function cityKey(e: Pick<TournamentEvent, "city" | "state">): string | null {
  const city = (e.city ?? "").trim().replace(/\s+/g, " ");
  const code = stateCode(e.state);
  if (isPlaceholderTown(city) || !code) return null;
  return `${city}, ${code}`.toLowerCase();
}

/** Nightly hotel prices in a shoot's town from hotel-prices.json, or null when the town has none. */
export function hotelPrices(
  e: Pick<TournamentEvent, "city" | "state">,
  table?: CityPriceTable | null
): HotelPriceInfo | null {
  const code = stateCode(e.state);
  const key = cityKey(e);
  const city = key ? table?.cities[key] : undefined;
  return city && isRange(city) ? { place: `${(e.city ?? "").trim()}, ${code}`, ...city } : null;
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
      // Offline or the file isn't there: keep the saved copy, if any.
    }
    return latest;
  })();
  return loading;
}

/** The town price table, or null while loading / when there's none (the card then shows just the button). */
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

/** "Brownwood, TX"; null when the shoot has no real town, so no hotel or flight search is offered. */
export function hotelPlace(e: Pick<TournamentEvent, "city" | "state">): string | null {
  const city = (e.city ?? "").trim().replace(/\s+/g, " ");
  if (isPlaceholderTown(city)) return null;
  const code = stateCode(e.state);
  return code ? `${city}, ${code}` : city;
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

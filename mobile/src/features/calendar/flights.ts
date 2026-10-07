// "Flights to the shoot": a button that opens an Expedia round-trip flight search to the
// shoot's town for the shoot's dates (fly in the day before, home on the last day, the
// same nights the hotel search uses). No departure airport is filled in; the archer picks
// theirs on Expedia.
//
// The link goes through Expedia Group's Travel Creator Program (creator.expediagroup.com),
// which pays a commission on bookings made from it. The tracked link is
// expedia.com/affiliate?siteid=1&landingPage=<the Expedia page>&camref=<creator id>.
// Until the creator id is filled in (config.ts → FLIGHTS.expediaCamref) the button opens a
// plain Expedia search, which works but earns nothing.
import { hotelNights, hotelPlace } from "./hotels";
import type { TournamentEvent } from "./types";

export interface FlightsConfig {
  enabled: boolean;
  /** Expedia Travel Creator Program id ("camref"). Blank: plain Expedia search, no commission. */
  expediaCamref: string;
}

/** Where the "Find flights" button goes, or null when the shoot has no place or is over. */
export function flightSearchUrl(
  e: Pick<TournamentEvent, "city" | "state" | "location" | "startDate" | "endDate">,
  config: FlightsConfig,
  today = new Date()
): string | null {
  const place = hotelPlace(e);
  const dates = hotelNights(e, today);
  if (!place || !dates) return null;
  const to = place.replace(/,\s*(usa|united states)$/i, "");
  const page =
    "https://www.expedia.com/Flights-Search?" +
    query({
      trip: "roundtrip",
      leg1: `from:,to:${to},departure:${usDate(dates.checkin)}TANYT`,
      leg2: `from:${to},to:,departure:${usDate(dates.checkout)}TANYT`,
      passengers: "adults:1,children:0,seniors:0,infantinlap:Y",
      mode: "search",
    });
  const camref = config.expediaCamref.trim();
  if (!camref) return page;
  return `https://expedia.com/affiliate?${query({ siteid: "1", landingPage: page, camref })}`;
}

// "2026-11-13" → "11/13/2026", the date format Expedia's flight search takes.
function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

// Built by hand: React Native's URLSearchParams can't be relied on without a polyfill.
function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

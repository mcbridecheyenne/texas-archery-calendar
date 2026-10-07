// Season planning: turns the archer's starred shoots ("My Shoots") into a plan for the
// season: what each trip roughly costs, shoots that clash, open stretches with no shoot
// (and shoots that could fill them), and progress toward the archer's own goal.
// Everything is worked out on the phone from things the app already has (miles to each
// town, the town's hotel prices); the archer's settings are saved on the phone.
import { useCallback, useEffect, useState } from "react";
import { parseISODate, toIso } from "./dates";
import { hotelNights, hotelPrices, type CityPriceTable } from "./hotels";
import { readJSON, writeJSON } from "./storage";
import type { TournamentEvent } from "./types";

export interface SeasonSettings {
  /** The car's miles per gallon. */
  mpg: number;
  /** Dollars per gallon. */
  gasPrice: number;
  /** Shoots at least this far away (one way) get a hotel; closer ones are day trips. */
  overnightMiles: number;
  /** Where the archer drives from, e.g. "Abilene, TX". Blank: the phone's location. */
  homeTown: string;
  /** How many shoots the archer wants to make this season. Null: no goal. */
  goal: number | null;
  /** Season travel budget in dollars. Null: no budget. */
  budget: number | null;
}

export const DEFAULT_SETTINGS: SeasonSettings = {
  mpg: 25,
  gasPrice: 3.25,
  overnightMiles: 150,
  homeTown: "",
  goal: null,
  budget: null,
};

// The miles the app shows are straight-line; roads are about this much longer.
export const ROAD_FACTOR = 1.2;
// An open stretch this long (or longer) between shoots is worth pointing out.
const GAP_DAYS = 21;
const DAY_MS = 86_400_000;

const KEY = "season.v1";

let saved: SeasonSettings | null = null;
const listeners = new Set<(s: SeasonSettings) => void>();

/** The archer's season settings, shared by every screen, and a way to change them. */
export function useSeasonSettings(): [SeasonSettings, (change: Partial<SeasonSettings>) => void] {
  const [settings, setSettings] = useState<SeasonSettings>(saved ?? DEFAULT_SETTINGS);
  useEffect(() => {
    let live = true;
    listeners.add(setSettings);
    if (!saved) {
      readJSON<Partial<SeasonSettings>>(KEY).then((s) => {
        saved = { ...DEFAULT_SETTINGS, ...(saved ?? {}), ...(s ?? {}) };
        if (live) setSettings(saved);
      });
    }
    return () => {
      live = false;
      listeners.delete(setSettings);
    };
  }, []);
  const update = useCallback((change: Partial<SeasonSettings>) => {
    saved = { ...(saved ?? DEFAULT_SETTINGS), ...change };
    writeJSON(KEY, saved);
    listeners.forEach((fn) => fn(saved!));
  }, []);
  return [settings, update];
}

export interface Trip {
  event: TournamentEvent;
  /** Straight-line miles one way, when the town has been looked up. */
  miles: number | null;
  /** Gas for the round trip, in dollars. Null without miles. */
  gas: number | null;
  /** Hotel nights (0 for a day trip). Null without miles. */
  nights: number | null;
  /** The town's average nightly price, when the app has it. */
  nightly: number | null;
  /** Hotel cost in dollars; null when it needs a hotel but the town's prices aren't known. */
  hotel: number | null;
  /** Gas plus hotel, counting only the parts that are known. */
  total: number;
  /** True when part of the cost couldn't be worked out. */
  partial: boolean;
}

function nightsBetween(checkin: string, checkout: string): number {
  return Math.max(1, Math.round((parseISODate(checkout).getTime() - parseISODate(checkin).getTime()) / DAY_MS));
}

export function tripFor(
  event: TournamentEvent,
  miles: number | undefined,
  settings: SeasonSettings,
  prices: CityPriceTable | null
): Trip {
  if (miles == null) {
    return { event, miles: null, gas: null, nights: null, nightly: null, hotel: null, total: 0, partial: true };
  }
  const mpg = settings.mpg > 0 ? settings.mpg : DEFAULT_SETTINGS.mpg;
  const gas = ((miles * 2 * ROAD_FACTOR) / mpg) * settings.gasPrice;
  const range = hotelNights(event);
  const nights = miles >= settings.overnightMiles && range ? nightsBetween(range.checkin, range.checkout) : 0;
  const nightly = hotelPrices(event, prices)?.typical ?? null;
  const hotel = nights === 0 ? 0 : nightly != null ? nights * nightly : null;
  return {
    event,
    miles,
    gas,
    nights,
    nightly,
    hotel,
    total: gas + (hotel ?? 0),
    partial: hotel == null,
  };
}

export interface SeasonTotals {
  shoots: number;
  /** Round-trip road miles, for shoots whose towns are known. */
  miles: number;
  gas: number;
  hotel: number;
  nights: number;
  total: number;
  /** Shoots whose cost is missing a part (town not found yet, or no hotel prices). */
  partial: number;
}

export function seasonTotals(trips: Trip[]): SeasonTotals {
  const t: SeasonTotals = { shoots: trips.length, miles: 0, gas: 0, hotel: 0, nights: 0, total: 0, partial: 0 };
  for (const trip of trips) {
    if (trip.miles != null) t.miles += trip.miles * 2 * ROAD_FACTOR;
    t.gas += trip.gas ?? 0;
    t.hotel += trip.hotel ?? 0;
    t.nights += trip.nights ?? 0;
    t.total += trip.total;
    if (trip.partial) t.partial++;
  }
  return t;
}

/** Pairs of starred shoots whose dates overlap, so the archer can only make one of them. */
export function clashes(shoots: TournamentEvent[]): [TournamentEvent, TournamentEvent][] {
  const sorted = [...shoots].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const out: [TournamentEvent, TournamentEvent][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].startDate <= sorted[i].endDate; j++) {
      out.push([sorted[i], sorted[j]]);
    }
  }
  return out;
}

export interface Gap {
  /** First free day (YYYY-MM-DD). */
  from: string;
  /** Last free day. */
  to: string;
  /** Saturdays in the stretch. */
  weekends: number;
  /** Unstarred shoots inside the stretch, closest (or soonest) first. */
  suggestions: TournamentEvent[];
}

function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

function saturdaysBetween(from: string, to: string): number {
  let n = 0;
  for (let iso = from; iso <= to; iso = addDays(iso, 1)) if (parseISODate(iso).getDay() === 6) n++;
  return n;
}

/**
 * Stretches of three weeks or more with nothing planned, from today up to the last starred
 * shoot, each with a few shoots that would fill it. `candidates` are the shoots worth
 * suggesting (nearby ones); `miles` sorts them closest first when known.
 */
export function openStretches(
  shoots: TournamentEvent[],
  candidates: TournamentEvent[],
  miles: Map<string, number>,
  today = toIso(new Date()),
  perGap = 3
): Gap[] {
  const sorted = [...shoots].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const starred = new Set(shoots.map((s) => s.id));
  const out: Gap[] = [];
  let free = today;
  for (const s of sorted) {
    if (s.startDate > free) {
      const to = addDays(s.startDate, -1);
      const days = Math.round((parseISODate(to).getTime() - parseISODate(free).getTime()) / DAY_MS) + 1;
      if (days >= GAP_DAYS) {
        const from = free;
        const far = (e: TournamentEvent) => miles.get(e.id) ?? Infinity;
        const suggestions = candidates
          .filter((e) => !starred.has(e.id) && e.startDate >= from && e.endDate <= to)
          .sort((a, b) => far(a) - far(b) || a.startDate.localeCompare(b.startDate))
          .slice(0, perGap);
        out.push({ from, to, weekends: saturdaysBetween(from, to), suggestions });
      }
    }
    const after = addDays(s.endDate, 1);
    if (after > free) free = after;
  }
  return out;
}

/** "3,240". Formatted by hand: number formatting isn't reliable on every Android phone. */
export function fmtCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "$1,240" */
export function fmtMoney(n: number): string {
  return `$${fmtCount(n)}`;
}

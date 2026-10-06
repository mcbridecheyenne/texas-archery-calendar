// "~120 mi" on each shoot, and the "Near me" filter. The schedule only has towns, not map
// points, so the phone looks each town up once and remembers the answer for next time.
//
// Looking up hundreds of towns takes a while (iPhones only allow about one a second), so:
// - each town is looked up only once, ever: answers are saved on the phone;
// - lookups happen one at a time in the background, and the list updates every few towns,
//   so scrolling never freezes;
// - only towns that matter right now are looked up (what's on screen, or nearby states);
// - if the phone's map service keeps failing, it stops for now and rows just skip the miles.
import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { lookUpPlace, milesBetween, type Coords } from "../../lib/location";
import { readJSON, writeJSON } from "./storage";
import type { TournamentEvent } from "./types";

const CACHE_KEY = "placeCoords.v1";
// Pause between lookups. Apple's limit is roughly 50 a minute; Android has no real limit.
const GAP_MS = Platform.OS === "ios" ? 1200 : 250;
// After this many failures in a row, stop until the app is opened again.
const MAX_FAILS = 3;
const FAIL_WAIT_MS = 15000;

// The text the phone looks up for a shoot, e.g. "wichita falls, tx". Null when there's no
// usable town ("TBA" or blank).
export function placeKey(e: Pick<TournamentEvent, "city" | "state" | "location">): string | null {
  const city = (e.city ?? "").trim();
  if (city && !/^tba$/i.test(city)) return (e.state ? `${city}, ${e.state}` : city).toLowerCase();
  const loc = (e.location ?? "").trim();
  if (loc && !/^tba\b/i.test(loc)) return loc.toLowerCase();
  return null;
}

// Every town looked up so far: its map point, or null when the phone couldn't find it.
// Shared by the whole app and saved on the phone.
const known = new Map<string, Coords | null>();
let loaded: Promise<void> | null = null;
function loadKnown(): Promise<void> {
  loaded ??= readJSON<Record<string, Coords | null>>(CACHE_KEY).then((saved) => {
    for (const [k, v] of Object.entries(saved ?? {})) if (!known.has(k)) known.set(k, v);
  });
  return loaded;
}
function saveKnown() {
  writeJSON(CACHE_KEY, Object.fromEntries(known));
}

// The towns waiting to be looked up, most important first. Each new request replaces the
// list, so switching from one state to another doesn't wait on the old state's towns.
let queue: string[] = [];
let working = false;
let gaveUp = false;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((fn) => fn());
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function want(keys: string[]) {
  queue = keys.filter((k) => !known.has(k));
  if (!working && !gaveUp && queue.length) work();
}

async function work() {
  working = true;
  let fails = 0;
  let sinceUpdate = 0;
  while (queue.length && !gaveUp) {
    const key = queue[0];
    if (known.has(key)) {
      queue.shift();
      continue;
    }
    const found = await lookUpPlace(key);
    if (found === "error") {
      fails++;
      if (fails >= MAX_FAILS) gaveUp = true;
      else await wait(FAIL_WAIT_MS);
      continue; // try the same town again
    }
    fails = 0;
    known.set(key, found);
    if (queue[0] === key) queue.shift();
    // Redraw and save every few towns rather than after each one.
    if (++sinceUpdate >= 6) {
      sinceUpdate = 0;
      tell();
      saveKnown();
    }
    await wait(GAP_MS);
  }
  working = false;
  saveKnown();
  tell();
}

export interface Distances {
  /** Miles from the archer to each shoot whose town is known, by shoot id. */
  miles: Map<string, number>;
  /** Towns in `wanted` still waiting to be looked up. */
  pending: number;
  /** True when the phone's map service stopped answering, so some towns won't get miles today. */
  stuck: boolean;
}

/**
 * Miles from `origin` to every shoot in `events` whose town has been looked up, and quietly
 * looks up the towns of the shoots in `wanted` (in that order). Does nothing without an origin.
 */
export function useDistances(events: TournamentEvent[], origin: Coords | null, wanted: TournamentEvent[]): Distances {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    loadKnown().then(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);

  // Each town once, in the order given.
  const keys = useMemo(() => {
    const out = new Set<string>();
    for (const e of wanted) {
      const k = placeKey(e);
      if (k) out.add(k);
    }
    return [...out];
  }, [wanted]);
  const keysSig = keys.join("|");

  useEffect(() => {
    if (!origin) return;
    loadKnown().then(() => want(keys));
    // keysSig stands in for keys, so a new list with the same towns doesn't restart anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, keysSig]);

  const miles = useMemo(() => {
    const out = new Map<string, number>();
    if (!origin) return out;
    for (const e of events) {
      const k = placeKey(e);
      const at = k ? known.get(k) : null;
      if (at) out.set(e.id, milesBetween(origin, at));
    }
    return out;
    // version changes whenever more towns have been looked up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, origin, version]);

  const pending = useMemo(
    () => (origin ? keys.filter((k) => !known.has(k)).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, origin, version]
  );

  return { miles, pending, stuck: gaveUp && pending > 0 };
}

/** "~120 mi", or "Under 5 mi" up close (towns are only placed to within a few miles). */
export function fmtMiles(miles: number): string {
  return miles < 5 ? "Under 5 mi" : `~${Math.round(miles)} mi`;
}

// The archer's starred shoots ("My Shoots"), kept on the phone. One shared copy for the
// whole app, so every screen that shows stars agrees.
//
// Why there's more here than a list of ids: a shoot's id is made from its name, dates and
// place. When a host moves a shoot to another weekend or town, the schedule gives it a new
// id, and the old star would quietly disappear (with its reminder still set for the old
// date). So next to each star we keep a small note of the shoot (name, dates, schedule,
// town). When the schedule loads and a starred shoot is missing, we look for the same shoot
// under its new id and move the star and the reminders over.
import { nameKey, toSource } from "./api";
import { toIso } from "./dates";
import { cancelRemindersFor, scheduleRemindersFor } from "./reminders";
import { readJSON, writeJSON } from "./storage";
import type { EventSource, EventsResponse, TournamentEvent } from "./types";

const KEY = "going.v1"; // starred ids (same key as before, so nobody loses their stars)
const INFO_KEY = "goingInfo.v1"; // { [eventId]: StarredShoot }
const MOVED_KEY = "goingMoved.v1"; // { [oldId]: newId } for shoots that moved, so the account copy can follow
const MERGED_KEY = "goingMerged.v1"; // account ids whose saved stars were already brought onto this phone

// How far a shoot can move and still count as "the same shoot".
const MAX_MOVE_DAYS = 45;
const MAX_MOVED_KEPT = 200;
const ARCHER_ADDED_PREFIX = "user:"; // ids of tournaments archers added (see community/api.ts)

/** A small note about a starred shoot, so we can recognize it if its id changes. */
export interface StarredShoot {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** Which schedule listed it. Null when it came back from the archer's account and hasn't been seen in the schedule yet. */
  source: EventSource | null;
  city: string | null;
  /** The dates the reminders were set for (see reminderKey). Missing when no reminders are set. */
  remindersFor?: string;
}

/** What a star looks like when it comes back from the archer's account. */
export interface AccountStar {
  id: string;
  name: string;
  startDate: string;
}

let ids = new Set<string>();
let info: Record<string, StarredShoot> = {};
let moved: Record<string, string> = {};
let loading: Promise<void> | null = null;

const listeners = new Set<(ids: Set<string>) => void>();
const moveListeners = new Set<() => void>();

// Every change goes through this line one at a time, so two things (a tap and a schedule
// load, say) never set the same reminder twice or overwrite each other's save.
let line: Promise<unknown> = Promise.resolve();
function inLine<T>(job: () => Promise<T>): Promise<T> {
  const next = line.then(job);
  line = next.catch(() => {});
  return next;
}

async function readAll() {
  const [savedIds, savedInfo, savedMoved] = await Promise.all([
    readJSON<string[]>(KEY),
    readJSON<Record<string, StarredShoot>>(INFO_KEY),
    readJSON<Record<string, string>>(MOVED_KEY),
  ]);
  ids = new Set(Array.isArray(savedIds) ? savedIds : []);
  info = savedInfo && typeof savedInfo === "object" ? savedInfo : {};
  moved = savedMoved && typeof savedMoved === "object" ? savedMoved : {};
}

function ensureLoaded(): Promise<void> {
  if (!loading) loading = readAll();
  return loading;
}

function tell() {
  const copy = new Set(ids);
  listeners.forEach((fn) => fn(copy));
}

async function save() {
  // Drop notes for shoots that are no longer starred.
  for (const id of Object.keys(info)) if (!ids.has(id)) delete info[id];
  await Promise.all([writeJSON(KEY, Array.from(ids)), writeJSON(INFO_KEY, info), writeJSON(MOVED_KEY, moved)]);
  tell();
}

/** The dates a shoot's reminders depend on. When these change, the reminders need moving. */
function reminderKey(e: TournamentEvent): string {
  return `${e.startDate}|${e.endDate}|${e.registrationEnd ?? ""}`;
}

function noteFor(e: TournamentEvent, remindersFor?: string): StarredShoot {
  return {
    id: e.id,
    name: e.name,
    startDate: e.startDate,
    endDate: e.endDate,
    source: e.source,
    city: e.city,
    ...(remindersFor ? { remindersFor } : {}),
  };
}

function sameNote(a: StarredShoot, b: StarredShoot | undefined): boolean {
  return (
    !!b &&
    a.name === b.name &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.source === b.source &&
    a.city === b.city &&
    a.remindersFor === b.remindersFor
  );
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000;
}

const listedUnder = (e: TournamentEvent, source: EventSource) =>
  e.source === source || !!e.alsoListed?.some((a) => a.source === source);

/** True when every part of that schedule loaded fully ("ok") this time. */
function sourceLoadedFully(source: EventSource | null, data: EventsResponse): boolean {
  if (!source || source === "USER" || source === "CLUB") return false; // no status for these, so we can't be sure
  const statuses = data.sources.filter((s) => toSource(s.name) === source);
  return statuses.length > 0 && statuses.every((s) => s.status === "ok");
}

// Ids the schedule had last time it loaded (only kept while the app is open). A shoot that
// moved shows up under an id that wasn't there before, which keeps us from moving a star
// onto a different shoot that happens to share the name (like a monthly series).
let lastData: EventsResponse | null = null;
let lastIds: Set<string> | null = null;
let earlierIds: Set<string> | null = null;
let lastEvents: TournamentEvent[] = [];

/** Finds where a missing starred shoot went: same name, same schedule, close in date. */
function findMovedShoot(
  note: StarredShoot,
  events: TournamentEvent[],
  claimed: Set<string>,
  today: string
): TournamentEvent | null {
  const key = nameKey(note.name);
  let best: TournamentEvent | null = null;
  let bestGap = Infinity;
  for (const e of events) {
    if (claimed.has(e.id) || e.endDate < today || nameKey(e.name) !== key) continue;
    if (note.source && !listedUnder(e, note.source)) continue;
    const gap = Math.abs(dayNumber(e.startDate) - dayNumber(note.startDate));
    if (gap > MAX_MOVE_DAYS) continue;
    // Was already in the schedule last time: it's a different shoot, unless it's the copy
    // another schedule lists (two schedules' copies get shown as one; see mergeDuplicates).
    const isOtherListing = !!note.source && e.source !== note.source;
    if (earlierIds && earlierIds.has(e.id) && !isOtherListing) continue;
    if (gap < bestGap) {
      best = e;
      bestGap = gap;
    }
  }
  return best;
}

async function setRemindersQuietly(e: TournamentEvent): Promise<string | undefined> {
  try {
    const count = await scheduleRemindersFor(e, false);
    return count > 0 ? reminderKey(e) : undefined;
  } catch {
    return undefined;
  }
}

async function checkStars(events: TournamentEvent[], data: EventsResponse): Promise<void> {
  await ensureLoaded();
  // Only step forward when it's a new copy of the schedule (not the same one shown again).
  if (data !== lastData) {
    earlierIds = lastIds;
    lastIds = new Set(data.events.map((e) => e.id));
    lastData = data;
  }
  lastEvents = events;

  const today = toIso(new Date());
  const byId = new Map(events.map((e) => [e.id, e]));
  const claimed = new Set<string>();
  let changed = false;
  let anyMoved = false;

  for (const id of Array.from(ids)) {
    const e = byId.get(id);
    const note = info[id];

    if (e) {
      // Still on the schedule. Refresh the note, and move the reminders if the dates changed
      // (or set them if they never were, e.g. a star that came back from the account).
      let fresh = noteFor(e, note?.remindersFor);
      if (e.endDate >= today && fresh.remindersFor !== reminderKey(e)) {
        fresh = { ...fresh, remindersFor: await setRemindersQuietly(e) };
        if (!fresh.remindersFor) delete fresh.remindersFor;
      }
      if (!sameNote(fresh, note)) {
        info[id] = fresh;
        changed = true;
      }
      continue;
    }

    // Missing. Without a note we can't recognize it; past shoots and archer-added ones
    // (whose ids never change, they may just not be loaded yet) are left alone.
    if (!note || note.endDate < today || note.source === "USER") continue;

    const match = findMovedShoot(note, data.events, claimed, today);
    if (match) {
      claimed.add(match.id);
      ids.delete(id);
      delete info[id];
      await cancelRemindersFor(id);
      if (!ids.has(match.id)) {
        ids.add(match.id);
        info[match.id] = noteFor(match, await setRemindersQuietly(match));
      }
      // Remember the move (and point older moves at the newest id) so the account copy can follow.
      for (const [from, to] of Object.entries(moved)) if (to === id) moved[from] = match.id;
      delete moved[match.id];
      moved[id] = match.id;
      const keys = Object.keys(moved);
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_MOVED_KEPT))) delete moved[old];
      changed = true;
      anyMoved = true;
    } else if (sourceLoadedFully(note.source, data)) {
      // Truly gone (its schedule loaded fully and it isn't there): don't remind them about it.
      // The star stays, so if the shoot comes back the reminders are set again.
      await cancelRemindersFor(id);
      if (note.remindersFor) {
        const rest = { ...note };
        delete rest.remindersFor;
        info[id] = rest;
        changed = true;
      }
    }
  }

  if (changed) await save();
  if (anyMoved) moveListeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Used by the useGoing hook and the account code
// ---------------------------------------------------------------------------

export async function loadStars(): Promise<Set<string>> {
  await ensureLoaded();
  return new Set(ids);
}

/** Re-reads the saved list from the phone (e.g. after another screen changed it). */
export function reloadStars(): Promise<Set<string>> {
  return inLine(async () => {
    loading = readAll();
    await loading;
    tell();
    return new Set(ids);
  });
}

export function subscribeStars(fn: (ids: Set<string>) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Called after a starred shoot moves to a new id (so the account copy can be moved too). */
export function onStarsMoved(fn: () => void): () => void {
  moveListeners.add(fn);
  return () => {
    moveListeners.delete(fn);
  };
}

/**
 * Stars or un-stars a shoot. Resolves to whether it's now starred, whether anything changed,
 * how many shoots are starred, and how many reminders were set.
 */
export function setStar(
  event: TournamentEvent,
  want: boolean
): Promise<{ starred: boolean; changed: boolean; count: number; reminders: number }> {
  return inLine(async () => {
    await ensureLoaded();
    if (want === ids.has(event.id)) return { starred: want, changed: false, count: ids.size, reminders: 0 };
    if (!want) {
      ids.delete(event.id);
      await save();
      await cancelRemindersFor(event.id);
      return { starred: false, changed: true, count: ids.size, reminders: 0 };
    }
    ids.add(event.id);
    info[event.id] = noteFor(event);
    await save(); // show the star right away, before the notification question
    let reminders = 0;
    try {
      reminders = await scheduleRemindersFor(event);
    } catch {
      reminders = 0;
    }
    if (reminders > 0 && ids.has(event.id)) {
      info[event.id] = noteFor(event, reminderKey(event));
      await save();
    }
    return { starred: true, changed: true, count: ids.size, reminders };
  });
}

/** Runs whenever the schedule loads: follows shoots that moved and fixes their reminders. */
export function checkStarsAgainst(events: TournamentEvent[], data: EventsResponse): Promise<void> {
  return inLine(() => checkStars(events, data));
}

/** Notes for every starred shoot we know about (for saving them to the archer's account). */
export function starredShoots(): Promise<StarredShoot[]> {
  return inLine(async () => {
    await ensureLoaded();
    return Array.from(ids)
      .map((id) => info[id])
      .filter((n): n is StarredShoot => !!n);
  });
}

/** Old id → new id for starred shoots that moved. */
export function movedStars(): Promise<Record<string, string>> {
  return inLine(async () => {
    await ensureLoaded();
    return { ...moved };
  });
}

/**
 * The first time an archer is signed in on this phone, brings back the stars saved to their
 * account (adds them; never removes any). Later calls for the same account do nothing, so a
 * shoot they un-star here doesn't keep coming back. Resolves true if it merged this time.
 */
export function addStarsFromAccount(userId: string, stars: AccountStar[]): Promise<boolean> {
  return inLine(async () => {
    await ensureLoaded();
    const merged = (await readJSON<string[]>(MERGED_KEY)) ?? [];
    if (merged.includes(userId)) return false;
    let added = false;
    for (const s of stars) {
      const id = moved[s.id] ?? s.id; // the account may still have a shoot's old id
      if (ids.has(id)) continue;
      ids.add(id);
      // Archer-added tournaments have ids starting "user:"; their ids never change.
      const source = id.startsWith(ARCHER_ADDED_PREFIX) ? "USER" : null;
      info[id] = { id, name: s.name, startDate: s.startDate, endDate: s.startDate, source, city: null };
      added = true;
    }
    if (added) await save();
    await writeJSON(MERGED_KEY, [...merged, userId]);
    // If the schedule's already loaded, set reminders for the ones that came back now
    // (instead of waiting for the next time it loads).
    if (added && lastData) await checkStars(lastEvents, lastData);
    return true;
  });
}

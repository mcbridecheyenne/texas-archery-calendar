// A paid "Featured" spot: a shoot shown at the top of one state's list or the "All states"
// list for 7, 14 or 30 days. Rows live in featured_shoots (supabase/schema.sql) and are
// only written by the feature-shoot edge function after it checks the purchase.
import type { TournamentEvent } from "../calendar";

export interface FeaturedShoot {
  id: string;
  buyerId: string | null;
  buyerName: string;
  eventId: string;
  eventSource: string;
  eventName: string;
  eventStart: string; // YYYY-MM-DD
  eventEnd: string;
  eventCity: string | null;
  eventState: string | null;
  eventLocation: string | null;
  eventUrl: string | null;
  eventFlyerPath: string | null;
  placement: "state" | "national";
  state: string | null;
  spot: string; // two-letter state, or "ALL"
  days: number;
  startsAt: string; // ISO timestamp
  endsAt: string;
  status: "active" | "ended" | "removed";
  shownCount: number;
  openedCount: number;
}

export const SPOT_SIZE = 3;

export function isLive(f: FeaturedShoot, now = Date.now()): boolean {
  return f.status === "active" && new Date(f.startsAt).getTime() <= now && new Date(f.endsAt).getTime() > now;
}

/** The spot a list shows: a state's own, or "ALL" for the All states list. */
export function spotFor(stateFilter: string): string {
  return stateFilter === "ALL" ? "ALL" : stateFilter;
}

/** Midnight after the shoot's last day: a feature never outlives its shoot. */
export function dayAfter(isoDate: string): Date {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** When a new feature could start in a spot, given the ones already live or queued there. */
export function nextStart(others: FeaturedShoot[], now = new Date()): Date {
  const ends = others
    .filter((f) => f.status === "active")
    .map((f) => new Date(f.endsAt))
    .filter((d) => d > now)
    .sort((a, b) => a.getTime() - b.getTime());
  if (ends.length < SPOT_SIZE) return now;
  return ends[ends.length - SPOT_SIZE];
}

/** The shoot a feature points at, if it's still on the calendar (by id, else source + name + start). */
export function matchEvent(f: FeaturedShoot, events: TournamentEvent[]): TournamentEvent | null {
  const byId = events.find((e) => e.id === f.eventId);
  if (byId) return byId;
  const key = nameKey(f.eventName);
  return events.find((e) => e.source === f.eventSource && e.startDate === f.eventStart && nameKey(e.name) === key) ?? null;
}

const nameKey = (name: string) => name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

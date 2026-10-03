// Spots tournaments that are probably the same shoot: dates that overlap (give or
// take a day) plus a similar name, or the same town on the same dates.
import type { TournamentEvent } from "../calendar";

const STOP = new Set([
  "the", "a", "an", "of", "and", "at", "in", "on", "for", "&", "-",
  "archery", "shoot", "tournament", "event", "club", "texas", "tx", "annual", "presents",
  "3d", "state", "championship", "championships", "open",
]);

function words(s: string | null | undefined): Set<string> {
  return new Set(
    (s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function datesClose(a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }): boolean {
  return dayNumber(a.startDate) <= dayNumber(b.endDate) + 1 && dayNumber(b.startDate) <= dayNumber(a.endDate) + 1;
}

export interface Candidate {
  name: string;
  startDate: string;
  endDate: string;
  city?: string | null;
  location?: string | null;
}

/** Events that look like the same tournament as `c`, most likely first. */
export function findLikelyDuplicates(c: Candidate, events: TournamentEvent[], ignoreId?: string): TournamentEvent[] {
  const name = words(c.name);
  const place = words(`${c.city ?? ""} ${c.location ?? ""}`);
  const scored: { e: TournamentEvent; score: number }[] = [];
  for (const e of events) {
    if (e.id === ignoreId || !datesClose(c, e)) continue;
    const nameScore = overlap(name, words(e.name));
    const placeScore = overlap(place, words(`${e.city ?? ""} ${e.location ?? ""}`));
    const sameDay = c.startDate === e.startDate;
    const score = nameScore + placeScore * 0.6 + (sameDay ? 0.2 : 0);
    if (nameScore >= 0.5 || (placeScore >= 0.5 && sameDay) || score >= 0.9) scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.e);
}

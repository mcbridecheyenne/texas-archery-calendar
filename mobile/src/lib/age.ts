// Accounts are for archers 13 and older (D8). The birthday is only used for this check.
import { readJSON, writeJSON } from "../features/calendar/storage";

// Set on this phone when someone says they're under 13, so the age question can't just be retried.
const UNDER_13_KEY = "under13";

/** Whole years old, from a birth month (1-12) and year. Assumes the birthday hasn't come yet in their birth month. */
export function ageFrom(month: number, year: number, now = new Date()): number {
  const m = now.getMonth() + 1;
  return now.getFullYear() - year - (m <= month ? 1 : 0);
}

export async function isMarkedUnder13(): Promise<boolean> {
  return !!(await readJSON<boolean>(UNDER_13_KEY));
}

export async function markUnder13(): Promise<void> {
  await writeJSON(UNDER_13_KEY, true);
}

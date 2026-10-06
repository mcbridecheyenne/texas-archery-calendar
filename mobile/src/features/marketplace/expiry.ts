// Listings expire 60 days after they're posted or last renewed, so the market
// doesn't fill up with old gear. The database does the actual hiding (see the
// "browse listings" rule in supabase/schema.sql); this file works out the
// "Expires in N days" wording and the reminder on the seller's phone.
// Reminders are scheduled on the phone itself, like tournament reminders, so no
// push server is needed.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureNotificationPermission } from "../calendar/reminders";
import { readJSON, writeJSON } from "../calendar/storage";
import type { Listing } from "./types";

export const LISTING_DAYS = 60; // keep in step with "60 days" in supabase/schema.sql
const REMIND_DAYS_BEFORE = 7;
const DAY_MS = 86_400_000;

const MAP_KEY = "listingReminders.v1"; // { [listingId]: { id: notificationId, renewedAt } }
const CHANNEL_ID = "listing-reminders";

type ReminderMap = Record<string, { id: string; renewedAt: string }>;
type ListingBits = Pick<Listing, "id" | "title" | "status" | "renewed_at" | "created_at">;

// When the listing stops showing up in the market.
export function expiresAt(l: Pick<Listing, "renewed_at" | "created_at">): Date {
  return new Date(new Date(l.renewed_at ?? l.created_at).getTime() + LISTING_DAYS * DAY_MS);
}

export function isExpired(l: Pick<Listing, "renewed_at" | "created_at">): boolean {
  return expiresAt(l).getTime() <= Date.now();
}

// Whole days left, rounded up, so "Expires in 1 day" means sometime before tomorrow ends.
export function daysLeft(l: Pick<Listing, "renewed_at" | "created_at">): number {
  return Math.max(0, Math.ceil((expiresAt(l).getTime() - Date.now()) / DAY_MS));
}

// "Expires in 12 days", "Expires in 1 day" or "Expired".
export function expiryLabel(l: Pick<Listing, "renewed_at" | "created_at">): string {
  if (isExpired(l)) return "Expired";
  const n = daysLeft(l);
  return `Expires in ${n} day${n === 1 ? "" : "s"}`;
}

let channelReady = false;
async function ensureChannel() {
  if (Platform.OS !== "android" || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Listing reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

// A week before it expires, at 10 AM.
function remindAt(l: ListingBits): Date {
  const d = new Date(expiresAt(l).getTime() - REMIND_DAYS_BEFORE * DAY_MS);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0, 0);
}

async function scheduleOne(l: ListingBits, map: ReminderMap): Promise<void> {
  const old = map[l.id];
  if (old) {
    await Notifications.cancelScheduledNotificationAsync(old.id).catch(() => {});
    delete map[l.id];
  }
  const date = remindAt(l);
  if (l.status !== "active" || date.getTime() <= Date.now() + 60_000) return;
  await ensureChannel();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Still selling ${l.title}?`,
      body: "Tap to renew it for another 60 days, or mark it sold.",
      data: { listingId: l.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });
  map[l.id] = { id, renewedAt: l.renewed_at ?? l.created_at };
}

// Call after posting or renewing a listing (or marking it available again).
// Asks for notification permission the first time. Never throws: a missing
// reminder shouldn't stop someone from selling.
export async function remindBeforeExpiry(l: ListingBits): Promise<void> {
  try {
    if (!(await ensureNotificationPermission())) return;
    const map = (await readJSON<ReminderMap>(MAP_KEY)) ?? {};
    await scheduleOne(l, map);
    await writeJSON(MAP_KEY, map);
  } catch {
    // Notifications aren't available here (for example on the web).
  }
}

// Call when a listing is marked sold or deleted.
export async function cancelExpiryReminder(listingId: string): Promise<void> {
  try {
    const map = (await readJSON<ReminderMap>(MAP_KEY)) ?? {};
    const old = map[listingId];
    if (!old) return;
    await Notifications.cancelScheduledNotificationAsync(old.id).catch(() => {});
    delete map[listingId];
    await writeJSON(MAP_KEY, map);
  } catch {
    // Nothing to cancel.
  }
}

// Brings this phone's reminders in line with the seller's full list of listings:
// sets one for listings that don't have one yet (for example listings posted before
// this update, or renewed on another phone) and drops ones for listings that were
// sold or deleted elsewhere. Only runs if notifications are already allowed, so it
// never pops up a permission question by itself.
export async function syncExpiryReminders(mine: ListingBits[]): Promise<void> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    const map = (await readJSON<ReminderMap>(MAP_KEY)) ?? {};
    const ids = new Set(mine.map((l) => l.id));
    for (const listingId of Object.keys(map)) {
      if (!ids.has(listingId)) {
        await Notifications.cancelScheduledNotificationAsync(map[listingId].id).catch(() => {});
        delete map[listingId];
      }
    }
    for (const l of mine) {
      const have = map[l.id];
      const renewedAt = l.renewed_at ?? l.created_at;
      if (l.status === "active" ? have?.renewedAt !== renewedAt : !!have) await scheduleOne(l, map);
    }
    await writeJSON(MAP_KEY, map);
  } catch {
    // Reminders are a convenience; never let them break the screen.
  }
}

// Local reminders for tournaments the archer marks as "Going".
// These are scheduled on the phone itself, so no push server is needed.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { parseISODate, fmtRange } from "./dates";
import { readJSON, writeJSON } from "./storage";
import { sourceLabel, type TournamentEvent } from "./types";

const MAP_KEY = "reminders.v1"; // { [eventId]: notificationId[] }
const CHANNEL_ID = "tournament-reminders";

type ReminderMap = Record<string, string[]>;

let channelReady = false;
async function ensureChannel() {
  if (Platform.OS !== "android" || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Tournament reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function at(iso: string, dayOffset: number, hour: number): Date {
  const d = parseISODate(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, hour, 0, 0);
}

async function schedule(title: string, body: string, date: Date, eventId: string): Promise<string | null> {
  if (date.getTime() <= Date.now() + 60_000) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { eventId } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });
}

// Returns how many reminders were set (0 if permission was declined or all dates have passed).
export async function scheduleRemindersFor(event: TournamentEvent): Promise<number> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) return 0;
  await ensureChannel();
  await cancelRemindersFor(event.id);

  const where = event.city || event.location;
  const ids: string[] = [];

  // Evening before the shoot, 6 PM.
  const dayBefore = await schedule(
    `Tomorrow: ${event.name}`,
    [fmtRange(event.startDate, event.endDate), where].filter(Boolean).join(" · "),
    at(event.startDate, -1, 18),
    event.id
  );
  if (dayBefore) ids.push(dayBefore);

  // Morning registration closes, 9 AM.
  if (event.registrationEnd && event.registrationEnd < event.startDate) {
    const reg = await schedule(
      `Registration closes today`,
      `${event.name} (${sourceLabel(event.source)})`,
      at(event.registrationEnd, 0, 9),
      event.id
    );
    if (reg) ids.push(reg);
  }

  const map = (await readJSON<ReminderMap>(MAP_KEY)) ?? {};
  if (ids.length) map[event.id] = ids;
  else delete map[event.id];
  await writeJSON(MAP_KEY, map);
  return ids.length;
}

export async function cancelRemindersFor(eventId: string): Promise<void> {
  const map = (await readJSON<ReminderMap>(MAP_KEY)) ?? {};
  const ids = map[eventId];
  if (!ids) return;
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  delete map[eventId];
  await writeJSON(MAP_KEY, map);
}

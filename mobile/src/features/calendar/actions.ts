// Things the phone can do that the website can't: add to the phone's calendar,
// open directions, call or email the host, open the source schedule.
import * as Calendar from "expo-calendar";
import { Alert, Linking, Platform } from "react-native";
import { parseISODate } from "./dates";
import { readJSON, writeJSON } from "./storage";
import { listedBy, type TournamentEvent } from "./types";

function calendarDetails(event: TournamentEvent) {
  const start = parseISODate(event.startDate);
  const endDay = parseISODate(event.endDate < event.startDate ? event.startDate : event.endDate);
  // All-day events end at midnight after the last day.
  const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1);

  const notes = [
    event.source === "USER" ? `Added in Archery in the USA by ${event.addedBy ?? "an archer"} (not an official schedule)` : `${listedBy(event)} tournament`,
    event.contact && `Contact: ${event.contact}`,
    event.phone && `Phone: ${event.phone}`,
    event.email && `Email: ${event.email}`,
    event.details,
    event.sourceUrl && `Details: ${event.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: event.name,
    startDate: start,
    endDate: end,
    allDay: true,
    location: event.location ?? undefined,
    notes,
    url: event.sourceUrl || undefined,
  };
}

export async function addToPhoneCalendar(event: TournamentEvent): Promise<void> {
  const details = calendarDetails(event);
  try {
    // Opens the phone's own "New Event" sheet so the archer can pick a calendar and confirm.
    await Calendar.createEventInCalendarAsync(details);
  } catch {
    // Older phones need calendar permission first.
    const { granted } = await Calendar.requestCalendarPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Calendar access is off",
        "To add tournaments, allow calendar access for this app in Settings.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    await Calendar.createEventInCalendarAsync(details);
  }
}

// Shoots already put in the phone's calendar by "Add all to Calendar": { [shootId]: calendarEventId }.
const ADDED_KEY = "calendarAdded.v1";

/**
 * Puts every shoot in the phone's default calendar in one go (the season plan's "Add all to
 * Calendar"), skipping ones it already added that are still there. Resolves to how many were
 * added, or null when calendar access is off (the archer is told how to turn it on).
 */
export async function addAllToPhoneCalendar(events: TournamentEvent[]): Promise<{ added: number; already: number } | null> {
  const { granted } = await Calendar.requestCalendarPermissionsAsync();
  if (!granted) {
    Alert.alert(
      "Calendar access is off",
      "To add your shoots, allow calendar access for this app in Settings.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
    return null;
  }
  const calendarId = await writableCalendarId();
  if (!calendarId) throw new Error("No calendar on this phone can take new events.");
  const added = (await readJSON<Record<string, string>>(ADDED_KEY)) ?? {};
  let count = 0;
  let already = 0;
  for (const event of events) {
    const earlier = added[event.id];
    if (earlier && (await Calendar.getEventAsync(earlier).then(() => true, () => false))) {
      already++;
      continue;
    }
    added[event.id] = await Calendar.createEventAsync(calendarId, calendarDetails(event));
    count++;
  }
  await writeJSON(ADDED_KEY, added);
  return { added: count, already };
}

async function writableCalendarId(): Promise<string | null> {
  if (Platform.OS === "ios") {
    const cal = await Calendar.getDefaultCalendarAsync().catch(() => null);
    if (cal?.allowsModifications) return cal.id;
  }
  const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = all.filter((c) => c.allowsModifications);
  return (writable.find((c) => c.isPrimary) ?? writable[0])?.id ?? null;
}

export function openDirections(event: TournamentEvent): void {
  const query = encodeURIComponent(event.location || [event.city, event.state].filter(Boolean).join(", "));
  if (!query) return;
  const url = Platform.select({
    ios: `https://maps.apple.com/?q=${query}`,
    default: `geo:0,0?q=${query}`,
  });
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
  );
}

export function callHost(phone: string): void {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => {});
}

export function emailHost(email: string, event: TournamentEvent): void {
  Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(event.name)}`).catch(() => {});
}

export function openUrl(url: string): void {
  Linking.openURL(url).catch(() => {});
}

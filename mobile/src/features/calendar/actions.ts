// Things the phone can do that the website can't: add to the phone's calendar,
// open directions, call or email the host, open the source schedule.
import * as Calendar from "expo-calendar";
import { Alert, Linking, Platform } from "react-native";
import { parseISODate } from "./dates";
import { sourceLabel, type TournamentEvent } from "./types";

export async function addToPhoneCalendar(event: TournamentEvent): Promise<void> {
  const start = parseISODate(event.startDate);
  const endDay = parseISODate(event.endDate < event.startDate ? event.startDate : event.endDate);
  // All-day events end at midnight after the last day.
  const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1);

  const notes = [
    `${sourceLabel(event.source)} tournament`,
    event.contact && `Contact: ${event.contact}`,
    event.phone && `Phone: ${event.phone}`,
    event.email && `Email: ${event.email}`,
    `Details: ${event.sourceUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const details = {
    title: event.name,
    startDate: start,
    endDate: end,
    allDay: true,
    location: event.location ?? undefined,
    notes,
    url: event.sourceUrl,
  };

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

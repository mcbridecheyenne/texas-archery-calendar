// Text that goes with a shared shoot picture. The phone's share sheet lists Messages,
// Facebook, Instagram, WhatsApp, X, Mail and any other app the archer has installed.
import { Share } from "react-native";
import { fmtRange } from "./dates";
import type { TournamentEvent } from "./types";

function line(e: TournamentEvent): string {
  const where = e.city || e.location || "";
  return `• ${fmtRange(e.startDate, e.endDate)} — ${e.name}${where ? ` (${where})` : ""}`;
}

/** Caption for a list of shoots. `plug` is an optional app-download line. */
export function shootsMessage(events: TournamentEvent[], plug?: string): string {
  return [
    events.length === 1 ? "🏹 Here's the next shoot I'm going to:" : "🏹 Here are the shoots I'm going to:",
    "",
    ...events.map(line),
    "",
    "Come shoot with me!",
    plug ? `\n${plug}` : "",
  ]
    .join("\n")
    .trim();
}

/** Caption for one shoot. */
export function shootMessage(event: TournamentEvent, going: boolean, plug?: string): string {
  const where = event.location || event.city || "";
  return [
    `🏹 ${going ? "I'm going to" : "Check out"} ${event.name}`,
    `📅 ${fmtRange(event.startDate, event.endDate)}`,
    where ? `📍 ${where}` : "",
    event.sourceUrl ? `Details: ${event.sourceUrl}` : "",
    plug ? `\n${plug}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Text-only sharing (used if a picture can't be made). */
export async function shareMyShoots(events: TournamentEvent[], plug?: string): Promise<void> {
  if (events.length) await Share.share({ message: shootsMessage(events, plug) });
}

export async function shareShoot(event: TournamentEvent, going: boolean, plug?: string): Promise<void> {
  await Share.share({ message: shootMessage(event, going, plug) });
}

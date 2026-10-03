// Sharing shoots by text or social media. The phone's share sheet lists Messages,
// Facebook, Instagram, WhatsApp, X, Mail and any other app the archer has installed.
import { Share } from "react-native";
import { fmtRange } from "./dates";
import type { TournamentEvent } from "./types";

function place(e: TournamentEvent): string {
  return e.city || e.location || "";
}

function line(e: TournamentEvent): string {
  const where = place(e);
  return `• ${fmtRange(e.startDate, e.endDate)} — ${e.name}${where ? ` (${where})` : ""}`;
}

/** Shares the archer's upcoming Going list. `plug` is an optional app-download line. */
export async function shareMyShoots(events: TournamentEvent[], plug?: string): Promise<void> {
  if (!events.length) return;
  const message = [
    events.length === 1 ? "🏹 Here's the next shoot I'm going to:" : "🏹 Here are the shoots I'm going to:",
    "",
    ...events.map(line),
    "",
    "Come shoot with me!",
    plug ? `\n${plug}` : "",
  ]
    .join("\n")
    .trim();
  await Share.share({ message });
}

/** Shares one tournament. */
export async function shareShoot(event: TournamentEvent, going: boolean, plug?: string): Promise<void> {
  const where = event.location || place(event);
  const message = [
    `🏹 ${going ? "I'm going to" : "Check out"} ${event.name}`,
    `📅 ${fmtRange(event.startDate, event.endDate)}`,
    where ? `📍 ${where}` : "",
    event.sourceUrl ? `Details: ${event.sourceUrl}` : "",
    plug ? `\n${plug}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  await Share.share({ message });
}

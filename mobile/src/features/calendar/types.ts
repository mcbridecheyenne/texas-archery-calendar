// Mirrors shared/schema.ts on the website so both read the same /api/events feed.
import type { ReactNode } from "react";

/** Official schedules, plus "USER" for tournaments archers added in the app. */
export type EventSource = "TFAA" | "ASA" | "TSAA" | "USER";
export type OfficialSource = Exclude<EventSource, "USER">;

export interface TournamentEvent {
  id: string;
  source: EventSource;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  location: string | null;
  city: string | null;
  state: string | null;
  registrationStart: string | null;
  registrationEnd: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  sourceUrl: string; // official schedule page, or the host's link for archer-added events ("" if none)
  // Only on tournaments archers added:
  addedBy?: string | null; // display name of the archer who added it
  addedById?: string | null;
  details?: string | null;
}

export interface SourceStatus {
  name: OfficialSource;
  url: string;
  status: "ok" | "partial" | "error";
  message: string | null;
  eventCount: number;
  fetchedAt: string;
}

export interface EventsResponse {
  events: TournamentEvent[];
  sources: SourceStatus[];
  lastUpdated: string;
}

/** "OOS" = out of state: any tournament (official or archer-added) outside Texas. */
export type SourceFilter = "all" | "going" | "OOS" | EventSource;

/** True when a tournament's state is known and isn't Texas. */
export function isOutOfState(e: Pick<TournamentEvent, "state">): boolean {
  const s = (e.state ?? "").trim().toUpperCase();
  return !!s && s !== "TX" && s !== "TEXAS";
}

/**
 * Optional hooks a host app can pass to CalendarScreen to add social features
 * (friends, sharing, archer-added tournaments) without the calendar knowing about accounts.
 */
export interface CalendarSocial {
  /** Tournaments archers added, merged into the calendar under the "Added by archers" filter. */
  extraEvents?: TournamentEvent[];
  /** Shows an "Add a tournament" button when provided. */
  onAddEvent?: () => void;
  /** Runs before an event is added to Going. Resolve false to cancel. */
  beforeGoing?: (event: TournamentEvent) => Promise<boolean>;
  /** Runs after Going changes. */
  onGoingChange?: (event: TournamentEvent, going: boolean) => void;
  /** A short line on an event's row, e.g. "Kim and Jo are going". */
  rowNote?: (event: TournamentEvent) => string | null;
  /** Extra content in the event's detail sheet, under the Going button. */
  renderDetail?: (event: TournamentEvent, going: boolean, close: () => void) => ReactNode;
  /** Pull-to-refresh also reloads these. */
  onRefresh?: () => void;
}

export function sourceLabel(source: EventSource): string {
  if (source === "TFAA") return "TFAA";
  if (source === "ASA") return "Texas ASA";
  if (source === "TSAA") return "TSAA";
  return "Added by archers";
}

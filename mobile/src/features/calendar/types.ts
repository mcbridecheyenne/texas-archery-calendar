// Mirrors shared/schema.ts on the website so both read the same /api/events feed.

export type EventSource = "TFAA" | "ASA" | "TSAA";

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
  sourceUrl: string;
}

export interface SourceStatus {
  name: EventSource;
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

export type SourceFilter = "all" | "going" | EventSource;

export function sourceLabel(source: EventSource): string {
  if (source === "TFAA") return "TFAA";
  if (source === "ASA") return "Texas ASA";
  return "TSAA";
}

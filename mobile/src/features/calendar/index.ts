// Public surface of the calendar feature. A host app only needs CalendarScreen;
// the hooks and types are exported for apps that want to reuse the data (for example,
// showing "next shoot" on the scoring app's dashboard).
export { CalendarScreen, type CalendarScreenProps } from "./CalendarScreen";
export { useEvents } from "./useEvents";
export { useGoing } from "./useGoing";
export { fetchEvents, readCachedEvents } from "./api";
export type { TournamentEvent, EventsResponse, EventSource, SourceStatus } from "./types";

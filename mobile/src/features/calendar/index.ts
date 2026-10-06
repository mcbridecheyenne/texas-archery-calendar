// Public surface of the calendar feature. A host app only needs CalendarScreen;
// the hooks and types are exported for apps that want to reuse the data (for example,
// showing "next shoot" on the scoring app's dashboard).
export { CalendarScreen, type CalendarScreenProps } from "./CalendarScreen";
export { useEvents } from "./useEvents";
export { useGoing } from "./useGoing";
export { addStarsFromAccount, movedStars, onStarsMoved, starredShoots, type AccountStar, type StarredShoot } from "./goingStore";
export { useCalendarTheme, type CalendarTheme } from "./theme";
export { fetchEvents, readCachedEvents } from "./api";
export { shareMyShoots, shareShoot, shootMessage, shootsMessage } from "./share";
export { useShareCard, type ShareCardInfo } from "./components/ShareCard";
export type { TournamentEvent, EventsResponse, EventSource, SourceStatus, CalendarSocial } from "./types";
export { hasCachedEvents, normalizeEvent } from "./api";
export { StatePicker } from "./components/StatePicker";
export { US_STATES, stateName } from "./states";
export { organizationOf, organizationsOf, listedBy } from "./types";
export { hotelPrices, hotelSearchUrl, type CityPriceTable, type HotelsConfig } from "./hotels";

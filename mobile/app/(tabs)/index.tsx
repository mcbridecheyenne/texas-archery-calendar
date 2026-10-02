import { CalendarScreen } from "../../src/features/calendar";
import { API_BASE_URL } from "../../config";

export default function TournamentsTab() {
  // The tab bar below handles the bottom safe area.
  return <CalendarScreen apiBaseUrl={API_BASE_URL} title="Archery in Texas" bottomInset={0} />;
}

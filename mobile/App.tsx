// Thin app shell. Everything about the calendar lives in src/features/calendar,
// so the same folder can later be dropped into the scoring app as a tab.
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CalendarScreen } from "./src/features/calendar";
import { API_BASE_URL } from "./config";

// Show reminder banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <CalendarScreen apiBaseUrl={API_BASE_URL} />
    </SafeAreaProvider>
  );
}

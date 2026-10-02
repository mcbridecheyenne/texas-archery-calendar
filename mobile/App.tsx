// Thin app shell. Everything about the calendar lives in src/features/calendar,
// so the same folder can later be dropped into the scoring app as a tab.
// Ads and the ad-free subscription live in src/monetization, outside the calendar.
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { API_BASE_URL } from "./config";
import { CalendarScreen, useCalendarTheme } from "./src/features/calendar";
import { AdBanner, useAdsVisible } from "./src/monetization/AdBanner";
import { PremiumProvider, usePremium } from "./src/monetization/premium";
import { PremiumSheet } from "./src/monetization/PremiumSheet";

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
      <PremiumProvider>
        <StatusBar style="auto" />
        <Main />
      </PremiumProvider>
    </SafeAreaProvider>
  );
}

function Main() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const showingAds = useAdsVisible();
  const openSheet = () => setSheetOpen(true);

  return (
    <View style={styles.fill}>
      <View style={styles.fill}>
        <CalendarScreen
          apiBaseUrl={API_BASE_URL}
          bottomInset={showingAds ? 0 : undefined}
          footer={<AdFreeLink onPress={openSheet} />}
        />
      </View>
      <AdBanner onRemoveAds={openSheet} />
      <PremiumSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

// Quiet link at the end of the list, so subscribing and "Restore purchase"
// are always reachable even when no ad happens to be loaded.
function AdFreeLink({ onPress }: { onPress: () => void }) {
  const theme = useCalendarTheme();
  const { available, isPremium } = usePremium();
  if (!available) return null;
  return (
    <Pressable onPress={onPress} style={styles.footer} accessibilityRole="button">
      <Text style={[styles.footerText, { color: theme.muted }]}>
        {isPremium ? "★ Ad-free — thanks for your support" : "Go ad-free · Restore purchase"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  footer: { alignItems: "center", paddingVertical: 18 },
  footerText: { fontSize: 13, fontWeight: "600" },
});

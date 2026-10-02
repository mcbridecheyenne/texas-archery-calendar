// Root of the app: shared providers plus the screens that slide over the tabs.
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/lib/auth";
import { InboxProvider } from "../src/features/marketplace/inbox";
import { PremiumProvider } from "../src/monetization/premium";
import { PremiumSheetHost } from "../src/monetization/PremiumSheet";
import { useTheme } from "../src/ui";

// Show reminder banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <PremiumProvider>
        <AuthProvider>
          <InboxProvider>
            <StatusBar style="auto" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: t.background },
                headerTintColor: t.primary,
                headerTitleStyle: { color: t.text, fontWeight: "700" },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: t.background },
                headerBackTitle: "Back",
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="listing/[id]" options={{ title: "" }} />
              <Stack.Screen name="listing/new" options={{ title: "Sell gear", presentation: "modal" }} />
              <Stack.Screen name="listing/edit/[id]" options={{ title: "Edit listing", presentation: "modal" }} />
              <Stack.Screen name="chat/[id]" options={{ title: "Messages" }} />
              <Stack.Screen name="sign-in" options={{ title: "Sign in", presentation: "modal" }} />
              <Stack.Screen name="setup-profile" options={{ title: "Your profile", presentation: "modal" }} />
              <Stack.Screen name="blocked" options={{ title: "Blocked people" }} />
            </Stack>
            <PremiumSheetHost />
          </InboxProvider>
        </AuthProvider>
      </PremiumProvider>
    </SafeAreaProvider>
  );
}

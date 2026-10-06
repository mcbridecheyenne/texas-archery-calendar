// Root of the app: shared providers plus the screens that slide over the tabs.
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/lib/auth";
import { HomeStateProvider } from "../src/lib/homeState";
import { CommunityProvider } from "../src/features/community";
import { FriendsProvider } from "../src/features/friends";
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

// Tapping a "Still selling …?" reminder opens that listing, where the seller can renew it.
// This also works when the tap is what started the app.
function useOpenListingFromReminder() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const listingId = response.notification.request.content.data?.listingId;
    const key = response.notification.request.identifier;
    if (typeof listingId !== "string" || handled.current === key) return;
    handled.current = key;
    router.push(`/listing/${listingId}`);
  }, [response, router]);
}

export default function RootLayout() {
  const t = useTheme();
  useOpenListingFromReminder();
  return (
    <SafeAreaProvider>
      <PremiumProvider>
        <AuthProvider>
          <HomeStateProvider>
            <InboxProvider>
              <FriendsProvider>
                <CommunityProvider>
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
                    <Stack.Screen name="friends" options={{ title: "Friends" }} />
                    <Stack.Screen name="add-friend/[code]" options={{ title: "Add friend" }} />
                    <Stack.Screen name="tournament/new" options={{ title: "Add a tournament", presentation: "modal" }} />
                    <Stack.Screen name="tournament/edit/[id]" options={{ title: "Edit tournament", presentation: "modal" }} />
                  </Stack>
                  <PremiumSheetHost />
                </CommunityProvider>
              </FriendsProvider>
            </InboxProvider>
          </HomeStateProvider>
        </AuthProvider>
      </PremiumProvider>
    </SafeAreaProvider>
  );
}

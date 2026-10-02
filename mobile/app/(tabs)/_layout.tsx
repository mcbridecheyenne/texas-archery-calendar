// The tab bar. New features (scores, clubs, results…) become new tabs here.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useInbox } from "../../src/features/marketplace/inbox";
import { AdBanner } from "../../src/monetization/AdBanner";
import { usePremium } from "../../src/monetization/premium";
import { useTheme } from "../../src/ui";

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  const t = useTheme();
  const { unreadCount } = useInbox();
  const { openSheet } = usePremium();

  return (
    <Tabs
      // The banner sits right above the tab bar, on every tab, and never covers content.
      tabBar={(props) => (
        <View>
          <AdBanner onRemoveAds={openSheet} padBottom={false} />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.background },
        headerTitleStyle: { color: t.text, fontWeight: "700" },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: t.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Tournaments", headerShown: false, tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="market" options={{ title: "Marketplace", tabBarIcon: icon("pricetags-outline") }} />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Messages",
          tabBarIcon: icon("chatbubbles-outline"),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: t.primary, color: t.onPrimary },
        }}
      />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("person-circle-outline") }} />
    </Tabs>
  );
}

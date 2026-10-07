// The tab bar. New features (scores, clubs, results…) become new tabs here.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useFriends } from "../../src/features/friends";
import { useInbox } from "../../src/features/marketplace/inbox";
import { useTheme } from "../../src/ui";

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  const t = useTheme();
  const { unreadCount } = useInbox();
  const { incoming } = useFriends();

  return (
    <Tabs
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
      {/* Messages live inside the Marketplace (button at the top right), so its badge shows unread messages. */}
      <Tabs.Screen
        name="market"
        options={{
          title: "Marketplace",
          tabBarIcon: icon("pricetags-outline"),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: t.primary, color: t.onPrimary },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: icon("person-circle-outline"),
          tabBarBadge: incoming.length > 0 ? incoming.length : undefined,
          tabBarBadgeStyle: { backgroundColor: t.primary, color: t.onPrimary },
        }}
      />
    </Tabs>
  );
}

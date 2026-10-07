// Messages: every conversation about a listing, newest first. Opened from the Marketplace tab.
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { timeAgo } from "../src/features/marketplace/helpers";
import { useInbox } from "../src/features/marketplace/inbox";
import { isUnread, type Conversation } from "../src/features/marketplace/types";
import { useAuth } from "../src/lib/auth";
import { askForPushNotifications } from "../src/lib/push";
import { Button, Empty, useTheme } from "../src/ui";

export default function MessagesScreen() {
  const t = useTheme();
  const router = useRouter();
  const { enabled, userId, profile } = useAuth();
  const { conversations, refresh, loading } = useInbox();
  const [refreshing, setRefreshing] = useState(false);

  // First time they open Messages, ask to send notifications for new messages.
  useEffect(() => {
    if (profile) askForPushNotifications(userId);
  }, [userId, profile]);

  if (!enabled) return <Empty title="Messages" body="Messaging opens with the marketplace." />;
  if (!userId)
    return (
      <Empty
        title="Message buyers and sellers"
        body="Sign in to chat about gear on the marketplace."
        action={<Button title="Sign in" onPress={() => router.push("/sign-in")} />}
      />
    );
  if (!profile)
    return (
      <Empty title="Finish your profile" body="Pick a name so people know who they're talking to." action={<Button title="Set up profile" onPress={() => router.push("/setup-profile")} />} />
    );

  return (
    <FlatList
      style={{ backgroundColor: t.background }}
      data={conversations}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <Row c={item} me={userId} onPress={() => router.push(`/chat/${item.id}`, { dangerouslySingular: true })} />}
      ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.border }]} />}
      ListEmptyComponent={
        loading ? null : <Empty title="No messages yet" body="When you message a seller, or someone asks about your gear, it shows up here." />
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
          tintColor={t.primary}
          colors={[t.primary]}
        />
      }
    />
  );
}

function Row({ c, me, onPress }: { c: Conversation; me: string; onPress: () => void }) {
  const t = useTheme();
  const other = me === c.buyer_id ? c.seller : c.buyer;
  const unread = isUnread(c, me);
  const role = me === c.seller_id ? "Buyer" : "Seller";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.subtle : t.background }]} accessibilityRole="button">
      <View style={[styles.avatar, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.onPrimary, fontWeight: "800", fontSize: 18 }}>{(other?.display_name ?? "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.topLine}>
          <Text style={[styles.name, { color: t.text, fontWeight: unread ? "800" : "600" }]} numberOfLines={1}>
            {other?.display_name ?? "Archer"} <Text style={{ color: t.muted, fontWeight: "500", fontSize: 13 }}>· {role}</Text>
          </Text>
          {c.last_message_at ? <Text style={[styles.time, { color: t.muted }]}>{timeAgo(c.last_message_at)}</Text> : null}
        </View>
        <Text style={[styles.listing, { color: t.primary }]} numberOfLines={1}>
          {c.listing_title}
        </Text>
        <Text style={[styles.preview, { color: unread ? t.text : t.muted, fontWeight: unread ? "600" : "400" }]} numberOfLines={1}>
          {c.last_sender_id === me ? "You: " : ""}
          {c.last_message_preview}
        </Text>
      </View>
      {unread ? <View style={[styles.dot, { backgroundColor: t.primary }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 72 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  topLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 16 },
  time: { fontSize: 12 },
  listing: { fontSize: 13, fontWeight: "600" },
  preview: { fontSize: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

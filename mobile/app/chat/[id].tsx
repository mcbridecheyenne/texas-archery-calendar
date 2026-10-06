// One conversation about a listing, updating live.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchConversation,
  fetchMessages,
  markRead,
  sendMessage,
  subscribeToMessages,
} from "../../src/features/marketplace/api";
import { askToReport, timeAgo } from "../../src/features/marketplace/helpers";
import { useInbox } from "../../src/features/marketplace/inbox";
import { checkMessageText, looksLikeScam } from "../../src/features/marketplace/moderation";
import type { Conversation, Message } from "../../src/features/marketplace/types";
import { useAuth } from "../../src/lib/auth";
import { askForPushNotifications, setOpenChat } from "../../src/lib/push";
import { Empty, confirm, errorText, showMenu, useTheme } from "../../src/ui";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { userId, block, blocked } = useAuth();
  const { refresh: refreshInbox } = useInbox();
  const [conversation, setConversation] = useState<Conversation | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const other = conversation && userId ? (userId === conversation.buyer_id ? conversation.seller : conversation.buyer) : null;
  const otherId = conversation && userId ? (userId === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id) : null;
  const isBlocked = !!otherId && blocked.has(otherId);

  // Load, then listen for new messages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, m] = await Promise.all([fetchConversation(id), fetchMessages(id)]);
        if (cancelled) return;
        setConversation(c);
        setMessages(m);
      } catch {
        if (!cancelled) setConversation(null);
      }
    })();
    const unsubscribe = subscribeToMessages(id, (m) => {
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id]);

  // While this chat is on screen, new messages in it don't pop up a banner.
  useFocusEffect(
    useCallback(() => {
      setOpenChat(id);
      return () => setOpenChat(null);
    }, [id])
  );

  // Mark read when opened and whenever a new message arrives while open.
  useEffect(() => {
    if (conversation && userId && messages.length) markRead(conversation, userId).then(refreshInbox).catch(() => {});
  }, [conversation, userId, messages.length, refreshInbox]);

  const openMenu = useCallback(() => {
    if (!conversation || !otherId) return;
    showMenu(other?.display_name ?? "Conversation", [
      ...(conversation.listing_id ? [{ label: "View listing", onPress: () => router.push(`/listing/${conversation.listing_id}`) }] : []),
      { label: "Report", onPress: () => askToReport(userId, { userId: otherId, listingId: conversation.listing_id ?? undefined }) },
      {
        label: `Block ${other?.display_name ?? "this person"}`,
        destructive: true,
        onPress: () =>
          confirm("Block this person?", "They won't be able to message you, and you won't see their listings.", "Block", async () => {
            try {
              await block(otherId);
              router.back();
            } catch (e) {
              Alert.alert("Couldn't block", errorText(e));
            }
          }),
      },
    ]);
  }, [conversation, other, otherId, userId, block, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: other?.display_name ?? "Messages",
      headerRight: () =>
        conversation ? (
          <Pressable onPress={openMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="Conversation options">
            <Ionicons name="ellipsis-horizontal-circle" size={26} color={t.primary} />
          </Pressable>
        ) : null,
    });
  }, [navigation, other, conversation, openMenu, t.primary]);

  async function send() {
    const body = draft.trim();
    if (!body || !userId || sending) return;
    const problem = checkMessageText(body);
    if (problem) {
      Alert.alert("Message not sent", problem);
      return;
    }
    setSending(true);
    try {
      const m = await sendMessage(id, userId, body);
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      setDraft("");
      askForPushNotifications(userId); // so they hear back even when the app is closed
    } catch (e) {
      const msg = errorText(e);
      Alert.alert(
        "Message not sent",
        /row-level security/i.test(msg) ? "You can't message this person right now." : msg
      );
    } finally {
      setSending(false);
    }
  }

  // Newest at the bottom: the list is inverted, so reverse the data.
  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const showScamWarning = useMemo(
    () => messages.some((m) => m.sender_id !== userId && looksLikeScam(m.body)),
    [messages, userId]
  );

  if (conversation === undefined) return <ActivityIndicator color={t.primary} style={{ marginTop: 60 }} />;
  if (!conversation) return <Empty title="Conversation not found" />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <Pressable
        onPress={() => conversation.listing_id && router.push(`/listing/${conversation.listing_id}`)}
        style={[styles.listingBar, { backgroundColor: t.card, borderBottomColor: t.border }]}
        accessibilityRole="link"
      >
        <Ionicons name="pricetag-outline" size={16} color={t.primary} />
        <Text style={[styles.listingTitle, { color: t.text }]} numberOfLines={1}>
          {conversation.listing_title}
        </Text>
        {conversation.listing_id ? <Ionicons name="chevron-forward" size={16} color={t.muted} /> : null}
      </Pressable>

      {showScamWarning ? (
        <View style={[styles.warning, { backgroundColor: t.warning + "22", borderColor: t.warning }]}>
          <Text style={[styles.warningText, { color: t.text }]}>
            ⚠️ Be careful: requests for gift cards, wire transfers, crypto or payment before you see the gear are common scams.
          </Text>
        </View>
      ) : null}

      <FlatList
        inverted
        data={reversed}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.messages}
        renderItem={({ item, index }) => {
          const mine = item.sender_id === userId;
          const older = reversed[index + 1];
          const showTime = !older || new Date(item.created_at).getTime() - new Date(older.created_at).getTime() > 30 * 60 * 1000;
          return (
            <View>
              {showTime ? <Text style={[styles.time, { color: t.muted }]}>{timeAgo(item.created_at)}</Text> : null}
              <Pressable
                onLongPress={() =>
                  !mine && showMenu("Message", [{ label: "Report message", onPress: () => askToReport(userId, { messageId: item.id, userId: item.sender_id }) }])
                }
                style={[
                  styles.bubble,
                  mine
                    ? { alignSelf: "flex-end", backgroundColor: t.primary, borderBottomRightRadius: 4 }
                    : { alignSelf: "flex-start", backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 4 },
                ]}
              >
                <Text style={{ color: mine ? t.onPrimary : t.text, fontSize: 16, lineHeight: 21 }}>{item.body}</Text>
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          <Text style={[styles.tip, { color: t.muted }]}>
            Tip: meet up at a tournament or another public place, and check the gear before paying.
          </Text>
        }
      />

      {isBlocked ? (
        <Text style={[styles.blocked, { color: t.muted, paddingBottom: insets.bottom + 12 }]}>You've blocked this person.</Text>
      ) : (
        <View style={[styles.composer, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor={t.muted}
            style={[styles.input, { color: t.text, backgroundColor: t.background, borderColor: t.border }]}
            multiline
            maxLength={2000}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            style={[styles.send, { backgroundColor: draft.trim() ? t.primary : t.border }]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            {sending ? <ActivityIndicator color={t.onPrimary} size="small" /> : <Ionicons name="arrow-up" size={20} color={t.onPrimary} />}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  listingBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  listingTitle: { flex: 1, fontSize: 14, fontWeight: "600" },
  warning: { margin: 12, marginBottom: 0, padding: 10, borderRadius: 10, borderWidth: 1 },
  warningText: { fontSize: 13, lineHeight: 18 },
  messages: { padding: 12, gap: 6 },
  time: { textAlign: "center", fontSize: 12, marginVertical: 8 },
  bubble: { maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  tip: { textAlign: "center", fontSize: 12, marginVertical: 12, paddingHorizontal: 20 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, maxHeight: 120, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, fontSize: 16 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  blocked: { textAlign: "center", paddingTop: 12, fontSize: 14 },
});

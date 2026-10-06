// One listing: photos, details, seller, and Message / Edit actions.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtRange } from "../../src/features/calendar/dates";
import { deleteListing, fetchListing, openConversation, renewListing, setListingStatus } from "../../src/features/marketplace/api";
import { expiryLabel, isExpired } from "../../src/features/marketplace/expiry";
import { PhotoCarousel } from "../../src/features/marketplace/components/PhotoCarousel";
import { askToReport, memberSince, timeAgo, useRequireMember } from "../../src/features/marketplace/helpers";
import { categoryLabel, conditionLabel, formatPrice, type Listing } from "../../src/features/marketplace/types";
import { useAuth } from "../../src/lib/auth";
import { Button, Empty, confirm, errorText, showMenu, useTheme } from "../../src/ui";

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const requireMember = useRequireMember();
  const { userId, block } = useAuth();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setListing(await fetchListing(id));
    } catch (e) {
      setListing(null);
      Alert.alert("Couldn't load this listing", errorText(e));
    }
  }, [id]);

  // Reload when returning from the edit screen.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const mine = !!listing && listing.seller_id === userId;

  const openMenu = useCallback(() => {
    if (!listing) return;
    if (mine) return;
    showMenu("Listing", [
      { label: "Report listing", onPress: () => askToReport(userId, { listingId: listing.id, userId: listing.seller_id }) },
      {
        label: `Block ${listing.seller?.display_name ?? "seller"}`,
        destructive: true,
        onPress: () => {
          if (!requireMember()) return;
          confirm(
            "Block this person?",
            "You won't see their listings, and they won't be able to message you.",
            "Block",
            async () => {
              try {
                await block(listing.seller_id);
                router.back();
              } catch (e) {
                Alert.alert("Couldn't block", errorText(e));
              }
            }
          );
        },
      },
    ]);
  }, [listing, mine, userId, requireMember, block, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        listing && !mine ? (
          <Pressable onPress={openMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options">
            <Ionicons name="ellipsis-horizontal-circle" size={26} color={t.primary} />
          </Pressable>
        ) : null,
    });
  }, [navigation, listing, mine, openMenu, t.primary]);

  async function message() {
    if (!listing || !requireMember()) return;
    setBusy("message");
    try {
      const conversationId = await openConversation(listing, userId!);
      router.push(`/chat/${conversationId}`);
    } catch (e) {
      Alert.alert("Couldn't start a message", errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleSold() {
    if (!listing) return;
    const next = listing.status === "sold" ? "active" : "sold";
    setBusy("sold");
    try {
      await setListingStatus(listing, next);
      setListing({ ...listing, status: next });
    } catch (e) {
      Alert.alert("Couldn't update", errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function renew() {
    if (!listing) return;
    setBusy("renew");
    try {
      const renewedAt = await renewListing(listing);
      setListing({ ...listing, renewed_at: renewedAt });
    } catch (e) {
      Alert.alert("Couldn't renew", errorText(e));
    } finally {
      setBusy(null);
    }
  }

  function remove() {
    if (!listing) return;
    confirm("Delete this listing?", "It and its photos will be removed for good.", "Delete", async () => {
      setBusy("delete");
      try {
        await deleteListing(listing);
        router.back();
      } catch (e) {
        setBusy(null);
        Alert.alert("Couldn't delete", errorText(e));
      }
    });
  }

  if (listing === undefined) return <ActivityIndicator color={t.primary} style={{ marginTop: 60 }} />;
  if (listing === null) return <Empty title="Listing not found" body="It may have been sold or removed." />;

  return (
    <View style={[styles.fill, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <PhotoCarousel photos={listing.photos} />
        <View style={styles.content}>
          {listing.status !== "active" ? (
            <View style={[styles.statusPill, { backgroundColor: t.text }]}>
              <Text style={{ color: t.background, fontWeight: "800", fontSize: 12 }}>
                {listing.status === "sold" ? "SOLD" : "REMOVED BY MODERATOR"}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.price, { color: t.text }]}>{formatPrice(listing.price_cents)}</Text>
          <Text style={[styles.title, { color: t.text }]}>{listing.title}</Text>
          <Text style={[styles.meta, { color: t.muted }]}>
            {[conditionLabel(listing.condition), categoryLabel(listing.category), listing.city, `listed ${timeAgo(listing.created_at)} ago`]
              .filter(Boolean)
              .join(" · ")}
          </Text>

          {listing.handoff_event_name ? (
            <View style={[styles.handoff, { backgroundColor: t.source.ASA.soft, borderColor: t.border }]}>
              <Text style={[styles.handoffTitle, { color: t.text }]}>🤝 Can hand off at a shoot</Text>
              <Text style={[styles.handoffBody, { color: t.text }]}>
                {listing.handoff_event_name}
                {listing.handoff_event_date ? ` · ${fmtRange(listing.handoff_event_date, listing.handoff_event_date)}` : ""}
              </Text>
            </View>
          ) : null}

          {mine && listing.status === "active" ? (
            // Only the seller sees this. Listings drop out of the market 60 days after
            // they're posted or renewed; renewing starts the 60 days over.
            <View style={[styles.expiry, { backgroundColor: t.card, borderColor: isExpired(listing) ? t.warning : t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.handoffTitle, { color: isExpired(listing) ? t.warning : t.text }]}>{expiryLabel(listing)}</Text>
                <Text style={[styles.meta, { color: t.muted }]}>
                  {isExpired(listing) ? "Buyers can't see it right now." : "Listings leave the market after 60 days."}
                </Text>
              </View>
              <Button title="Still for sale? Renew" kind="secondary" small onPress={renew} busy={busy === "renew"} />
            </View>
          ) : null}

          {listing.description ? <Text style={[styles.description, { color: t.text }]}>{listing.description}</Text> : null}

          {listing.seller ? (
            <View style={[styles.seller, { borderColor: t.border }]}>
              <View style={[styles.avatar, { backgroundColor: t.primary }]}>
                <Text style={{ color: t.onPrimary, fontWeight: "800", fontSize: 18 }}>
                  {listing.seller.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sellerName, { color: t.text }]}>{listing.seller.display_name}</Text>
                <Text style={[styles.meta, { color: t.muted }]}>
                  {[listing.seller.city, memberSince(listing.seller.created_at)].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={[styles.safety, { color: t.muted }]}>
            Local pickup only, no shipping. Stay safe: meet in a public place (a tournament is perfect), inspect gear
            before you pay, and never pay with gift cards or wire transfers.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bar, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: insets.bottom + 10 }]}>
        {mine ? (
          <View style={styles.ownerRow}>
            <View style={{ flex: 1 }}>
              <Button title="Edit" kind="secondary" onPress={() => router.push(`/listing/edit/${listing.id}`)} disabled={listing.status === "removed"} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={listing.status === "sold" ? "Mark available" : "Mark sold"}
                onPress={toggleSold}
                busy={busy === "sold"}
                disabled={listing.status === "removed"}
              />
            </View>
            <Pressable onPress={remove} hitSlop={8} style={styles.trash} accessibilityRole="button" accessibilityLabel="Delete listing">
              {busy === "delete" ? <ActivityIndicator color={t.danger} /> : <Ionicons name="trash-outline" size={24} color={t.danger} />}
            </Pressable>
          </View>
        ) : listing.status === "active" ? (
          <Button title="Message seller" onPress={message} busy={busy === "message"} />
        ) : (
          <Text style={[styles.meta, { color: t.muted, textAlign: "center" }]}>This item is no longer available.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 8 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  price: { fontSize: 28, fontWeight: "800" },
  title: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  meta: { fontSize: 13 },
  handoff: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginTop: 8, gap: 2 },
  handoffTitle: { fontSize: 14, fontWeight: "700" },
  handoffBody: { fontSize: 14 },
  expiry: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginTop: 8 },
  description: { fontSize: 16, lineHeight: 23, marginTop: 8 },
  seller: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14, marginTop: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sellerName: { fontSize: 16, fontWeight: "700" },
  safety: { fontSize: 12, lineHeight: 17, marginTop: 12 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  ownerRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  trash: { paddingHorizontal: 8, height: 50, justifyContent: "center" },
});

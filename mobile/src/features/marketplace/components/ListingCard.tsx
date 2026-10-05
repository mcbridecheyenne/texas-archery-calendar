import { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { photoUrl } from "../../../lib/supabase";
import { useTheme } from "../../../ui";
import { fmtDayLong } from "../../calendar/dates";
import { formatPrice, type Listing } from "../types";

export const ListingCard = memo(function ListingCard({
  listing,
  miles,
  onPress,
}: {
  listing: Listing;
  miles?: number | null; // from the archer, when both locations are known
  onPress: (l: Listing) => void;
}) {
  const away = miles == null ? "" : miles < 5 ? "Under 5 mi" : `${Math.round(miles)} mi`;
  const t = useTheme();
  const cover = listing.photos[0];
  return (
    <Pressable
      onPress={() => onPress(listing)}
      style={({ pressed }) => [styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.8 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${formatPrice(listing.price_cents)}`}
    >
      <View style={[styles.photo, { backgroundColor: t.subtle }]}>
        {cover ? <Image source={{ uri: photoUrl(cover) }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        {listing.status === "sold" ? (
          <View style={[styles.sold, { backgroundColor: t.text }]}>
            <Text style={{ color: t.background, fontWeight: "800", fontSize: 11 }}>SOLD</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={[styles.price, { color: t.text }]}>{formatPrice(listing.price_cents)}</Text>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
          {listing.title}
        </Text>
        {listing.handoff_event_name ? (
          <Text style={[styles.meta, { color: t.primary }]} numberOfLines={1}>
            🤝 {listing.handoff_event_date ? fmtDayLong(listing.handoff_event_date) : listing.handoff_event_name}
          </Text>
        ) : listing.city || away ? (
          <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
            {[listing.city, away].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", margin: 5 },
  photo: { aspectRatio: 1, width: "100%" },
  sold: { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  body: { padding: 10, gap: 2 },
  price: { fontSize: 16, fontWeight: "800" },
  title: { fontSize: 14, lineHeight: 18 },
  meta: { fontSize: 12, marginTop: 2 },
});

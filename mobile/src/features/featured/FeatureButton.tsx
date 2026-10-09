// In a shoot's details: the "Featured · promoted by" line when it's featured right now, and a
// "Feature this shoot" button for any upcoming shoot. Buying needs an account (the purchase
// record keeps who bought it), so signed-out archers are sent to sign in first.
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { usePremium } from "../../monetization/premium";
import { useTheme } from "../../ui";
import { stateName, type TournamentEvent } from "../calendar";
import { daysUntil } from "../calendar/dates";
import { useFeatured } from "./FeaturedProvider";

export function FeatureButton({ event, close }: { event: TournamentEvent; close: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const { userId, profile } = useAuth();
  const { featureProducts } = usePremium();
  const { enabled, forEvent, openSheet } = useFeatured();
  if (!enabled) return null;

  const live = forEvent(event);
  const mine = live.filter((f) => !!userId && f.buyerId === userId);
  const upcoming = daysUntil(event.endDate) >= 0;

  function start() {
    close();
    if (!userId) {
      setTimeout(() => router.push("/sign-in"), 350);
      return;
    }
    if (!profile) {
      setTimeout(() => router.push("/setup-profile"), 350);
      return;
    }
    setTimeout(() => openSheet(event), 350);
  }

  return (
    <View style={styles.wrap}>
      {live.length ? (
        <Text style={[styles.promo, { color: t.primary }]}>
          ★ Featured · promoted by {[...new Set(live.map((f) => f.buyerName))].join(", ")}
        </Text>
      ) : null}
      {mine.map((f) => (
        <Text key={f.id} style={[styles.stats, { color: t.muted }]}>
          {f.spot === "ALL" ? "All states" : stateName(f.spot) ?? f.spot}: shown {f.shownCount.toLocaleString()} times · {f.openedCount.toLocaleString()} opened
        </Text>
      ))}
      {upcoming && featureProducts.length ? (
        <Pressable onPress={start} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.btn, { borderColor: t.primary, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.btnText, { color: t.primary }]}>{live.length ? "Feature it somewhere else" : "Feature this shoot"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 6, alignItems: "center" },
  promo: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  stats: { fontSize: 13, textAlign: "center" },
  btn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { fontSize: 15, fontWeight: "700" },
});

// Account tab: profile, my listings, ad-free, privacy, sign out and delete account.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PRIVACY_URL, RULES_URL } from "../../config";
import { fetchMyListings } from "../../src/features/marketplace/api";
import { formatPrice, type Listing } from "../../src/features/marketplace/types";
import { useAuth } from "../../src/lib/auth";
import { photoUrl } from "../../src/lib/supabase";
import { usePremium } from "../../src/monetization/premium";
import { Button, SectionLabel, confirm, errorText, useTheme } from "../../src/ui";
import { memberSince } from "../../src/features/marketplace/helpers";

export default function AccountTab() {
  const t = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const premium = usePremium();
  const [mine, setMine] = useState<Listing[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (auth.userId && auth.profile) fetchMyListings(auth.userId).then(setMine).catch(() => setMine([]));
      else setMine(null);
    }, [auth.userId, auth.profile])
  );

  function deleteAccount() {
    confirm(
      "Delete your account?",
      "This permanently deletes your profile, listings, photos and messages. Your ad-free subscription is separate: cancel it in your App Store or Google Play settings.",
      "Delete everything",
      async () => {
        setDeleting(true);
        try {
          await auth.deleteAccount();
          Alert.alert("Account deleted", "Your account and everything in it have been removed.");
        } catch (e) {
          Alert.alert("Couldn't delete your account", errorText(e));
        } finally {
          setDeleting(false);
        }
      }
    );
  }

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.content}>
      {auth.enabled ? (
        !auth.userId ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.h, { color: t.text }]}>Sell gear and message archers</Text>
            <Text style={[styles.p, { color: t.muted }]}>An account is only needed for the marketplace.</Text>
            <Button title="Sign in" onPress={() => router.push("/sign-in")} />
          </View>
        ) : auth.loading ? (
          <ActivityIndicator color={t.primary} style={{ marginVertical: 24 }} />
        ) : !auth.profile ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.h, { color: t.text }]}>Finish your profile</Text>
            <Button title="Set up profile" onPress={() => router.push("/setup-profile")} />
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => router.push("/setup-profile")}
              style={[styles.profile, { backgroundColor: t.card, borderColor: t.border }]}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <View style={[styles.avatar, { backgroundColor: t.primary }]}>
                <Text style={{ color: t.onPrimary, fontWeight: "800", fontSize: 22 }}>{auth.profile.display_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.h, { color: t.text }]}>{auth.profile.display_name}</Text>
                <Text style={[styles.p, { color: t.muted }]}>
                  {[auth.profile.city, memberSince(auth.profile.created_at)].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text style={{ color: t.primary, fontWeight: "600" }}>Edit</Text>
            </Pressable>

            <SectionLabel>My listings</SectionLabel>
            {mine === null ? (
              <ActivityIndicator color={t.primary} />
            ) : mine.length === 0 ? (
              <Button title="Sell gear" kind="secondary" onPress={() => router.push("/listing/new")} />
            ) : (
              <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>
                {mine.map((l, i) => (
                  <Pressable
                    key={l.id}
                    onPress={() => router.push(`/listing/${l.id}`)}
                    style={[styles.listingRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}
                  >
                    <View style={[styles.thumb, { backgroundColor: t.subtle }]}>
                      {l.photos[0] ? <Image source={{ uri: photoUrl(l.photos[0]) }} style={StyleSheet.absoluteFill} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: t.text }]} numberOfLines={1}>
                        {l.title}
                      </Text>
                      <Text style={[styles.p, { color: l.status === "active" ? t.muted : t.warning }]}>
                        {formatPrice(l.price_cents)} · {l.status === "active" ? "Active" : l.status === "sold" ? "Sold" : "Removed by moderator"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={t.muted} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )
      ) : null}

      <SectionLabel>App</SectionLabel>
      <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>
        {premium.available || premium.isPremium ? (
          <Row
            icon="sparkles-outline"
            label={premium.isPremium ? "Ad-free — thank you!" : "Go ad-free"}
            onPress={premium.openSheet}
            first
          />
        ) : null}
        {auth.profile ? <Row icon="hand-left-outline" label="Blocked people" onPress={() => router.push("/blocked")} first={!premium.available && !premium.isPremium} /> : null}
        <Row icon="document-text-outline" label="Marketplace rules" onPress={() => Linking.openURL(RULES_URL)} first={!premium.available && !premium.isPremium && !auth.profile} />
        <Row icon="lock-closed-outline" label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
      </View>

      {auth.userId ? (
        <View style={{ gap: 10, marginTop: 24 }}>
          <Button title="Sign out" kind="secondary" onPress={() => auth.signOut()} />
          <Button title="Delete account" kind="danger" onPress={deleteAccount} busy={deleting} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function Row({ icon, label, onPress, first }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; first?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }, pressed && { backgroundColor: t.subtle }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={t.primary} />
      <Text style={[styles.rowTitle, { color: t.text, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  h: { fontSize: 18, fontWeight: "700" },
  p: { fontSize: 13, lineHeight: 18 },
  group: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  listingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10 },
  thumb: { width: 48, height: 48, borderRadius: 8, overflow: "hidden" },
});

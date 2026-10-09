// Account tab: profile, my listings, ad-free, privacy, sign out and delete account.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { PRIVACY_URL, RULES_URL, SUPPORT_URL } from "../../config";
import { StatePicker, stateName, useCalendarTheme } from "../../src/features/calendar";
import { fetchMyListings, renewListing } from "../../src/features/marketplace/api";
import { expiryLabel, isExpired, syncExpiryReminders } from "../../src/features/marketplace/expiry";
import { formatPrice, type Listing } from "../../src/features/marketplace/types";
import { useShowFeatured } from "../../src/features/featured";
import { useFriends } from "../../src/features/friends";
import { useAuth } from "../../src/lib/auth";
import { useHomeState } from "../../src/lib/homeState";
import { photoUrl } from "../../src/lib/supabase";
import { usePremium } from "../../src/monetization/premium";
import { ScholarshipNote } from "../../src/monetization/ScholarshipNote";
import { Button, SectionLabel, confirm, errorText, useTheme } from "../../src/ui";
import { memberSince } from "../../src/features/marketplace/helpers";

export default function AccountTab() {
  const t = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const [showFeatured, setShowFeatured] = useShowFeatured();
  const premium = usePremium();
  const friends = useFriends();
  const home = useHomeState();
  const calendarTheme = useCalendarTheme();
  const [pickingState, setPickingState] = useState(false);
  const [mine, setMine] = useState<Listing[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tipping, setTipping] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (auth.userId && auth.profile)
        fetchMyListings(auth.userId)
          .then((list) => {
            setMine(list);
            // Keep this phone's "still selling?" reminders in step with the listings.
            syncExpiryReminders(list);
          })
          .catch(() => setMine([]));
      else setMine(null);
    }, [auth.userId, auth.profile])
  );

  // "Still for sale? Renew": gives the listing another 60 days in the market.
  async function renew(l: Listing) {
    setRenewing(l.id);
    try {
      const renewedAt = await renewListing(l);
      setMine((list) => list?.map((x) => (x.id === l.id ? { ...x, renewed_at: renewedAt } : x)) ?? list);
    } catch (e) {
      Alert.alert("Couldn't renew", errorText(e));
    } finally {
      setRenewing(null);
    }
  }

  // Works signed out (saved on the phone); signed in, it's saved to the profile too.
  async function pickHomeState(code: string) {
    setPickingState(false);
    await home.setHomeState(code);
    const p = auth.profile;
    if (p) await auth.saveProfile(p.display_name, p.city ?? "", p.archery_class ?? "", undefined, { homeState: code }).catch((e) => Alert.alert("Couldn't save", errorText(e)));
  }

  function deleteAccount() {
    confirm(
      "Delete your account?",
      `This permanently deletes your profile, listings, photos and messages${Platform.OS === "ios" ? ". If you signed in with Apple, Apple asks you to confirm and the app is removed from your Apple ID" : ""}. Your ad-free subscription is separate: cancel it in your ${Platform.select({ ios: "App Store", default: "Google Play" })} settings.`,
      "Delete everything",
      async () => {
        setDeleting(true);
        try {
          if ((await auth.deleteAccount()) === "deleted") {
            Alert.alert("Account deleted", "Your account and everything in it have been removed.");
          }
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
            <Text style={[styles.h, { color: t.text }]}>Friends, tournaments and gear</Text>
            <Text style={[styles.p, { color: t.muted }]}>
              Sign in to add friends, see who's going to which shoots, add tournaments, and buy or sell gear. The schedule works without an account.
            </Text>
            <Button title="Sign in" onPress={() => router.push("/sign-in")} />
          </View>
        ) : auth.loading ? (
          <ActivityIndicator color={t.primary} style={{ marginVertical: 24 }} />
        ) : auth.loadError && !auth.profile ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.h, { color: t.text }]}>Couldn't load your account</Text>
            <Text style={[styles.p, { color: t.muted }]}>Check your signal and try again.</Text>
            <Button title="Try again" onPress={auth.retryLoad} />
          </View>
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
                  {[auth.profile.archery_class, auth.profile.city, memberSince(auth.profile.created_at)].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text style={{ color: t.primary, fontWeight: "600" }}>Edit</Text>
            </Pressable>

            <SectionLabel>Friends</SectionLabel>
            <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>
              <Row
                icon="people-outline"
                label={
                  friends.incoming.length
                    ? `Friends · ${friends.incoming.length} new request${friends.incoming.length > 1 ? "s" : ""}`
                    : `Friends${friends.friends.length ? ` (${friends.friends.length})` : ""}`
                }
                onPress={() => router.push("/friends")}
                first
              />
            </View>

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
                      <Text style={[styles.p, { color: l.status === "active" && !isExpired(l) ? t.muted : t.warning }]}>
                        {formatPrice(l.price_cents)} ·{" "}
                        {l.status === "active" ? expiryLabel(l) : l.status === "sold" ? "Sold" : "Removed by moderator"}
                      </Text>
                    </View>
                    {l.status === "active" ? (
                      <Button title="Still for sale? Renew" kind="secondary" small onPress={() => renew(l)} busy={renewing === l.id} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={t.muted} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )
      ) : null}

      {premium.tips.length ? (
        <>
          <SectionLabel>Support the app</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.h, { color: t.text }]}>❤️ Enjoying Archery in the USA?</Text>
            <Text style={[styles.p, { color: t.muted }]}>
              It's built by an archer in Texas. A tip helps keep the schedule updating and new features coming. Totally optional, and thank you!
            </Text>
            <View style={styles.tips}>
              {premium.tips.map((tip, i) => (
                <View key={tip.id} style={{ flex: 1 }}>
                  <Button
                    small
                    kind={i === 1 ? "primary" : "secondary"}
                    title={tip.price}
                    busy={tipping === tip.id}
                    onPress={async () => {
                      setTipping(tip.id);
                      const r = await premium.sendTip(tip);
                      setTipping(null);
                      if (r === "thanks") Alert.alert("Thank you! 🏹", "Your tip means a lot and helps keep the app going.");
                      else if (r === "failed") Alert.alert("Tip didn't go through", "Nothing was charged. Please try again later.");
                    }}
                  />
                </View>
              ))}
            </View>
            <ScholarshipNote />
          </View>
        </>
      ) : null}

      <SectionLabel>App</SectionLabel>
      <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>
        {premium.storeEnabled || premium.isPremium ? (
          <Row
            icon="sparkles-outline"
            label={premium.isPremium ? "Ad-free — thank you!" : "Go ad-free"}
            onPress={premium.openSheet}
            first
          />
        ) : null}
        {auth.profile ? <Row icon="hand-left-outline" label="Blocked people" onPress={() => router.push("/blocked")} first={!premium.storeEnabled && !premium.isPremium} /> : null}
        <Row icon="document-text-outline" label="Marketplace rules" onPress={() => Linking.openURL(RULES_URL)} first={!premium.storeEnabled && !premium.isPremium && !auth.profile} />
        <Row icon="lock-closed-outline" label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <Row icon="help-circle-outline" label="Help and contact" onPress={() => Linking.openURL(SUPPORT_URL)} />
        <Row icon="location-outline" label={`Home state: ${stateName(home.homeState) ?? "Choose your state"}`} onPress={() => setPickingState(true)} />
        <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
          <Ionicons name="star-outline" size={20} color={t.primary} />
          <Text style={[styles.rowTitle, { color: t.text, flex: 1 }]}>Show featured shoots</Text>
          <Switch
            value={showFeatured}
            onValueChange={setShowFeatured}
            trackColor={{ true: t.primary }}
            accessibilityLabel="Show featured shoots at the top of the Tournaments list"
          />
        </View>
      </View>

      {auth.userId ? (
        <View style={{ gap: 10, marginTop: 24 }}>
          <Button title="Sign out" kind="secondary" onPress={() => auth.signOut()} />
          <Button title="Delete account" kind="danger" onPress={deleteAccount} busy={deleting} />
        </View>
      ) : null}

      <StatePicker
        visible={pickingState}
        value={home.homeState}
        theme={calendarTheme}
        title="Your home state"
        onClose={() => setPickingState(false)}
        onPick={pickHomeState}
      />
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
  tips: { flexDirection: "row", gap: 10, marginTop: 4 },
  thumb: { width: 48, height: 48, borderRadius: 8, overflow: "hidden" },
});

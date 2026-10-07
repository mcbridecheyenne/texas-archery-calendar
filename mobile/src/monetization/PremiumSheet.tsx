// "Remove ads" screen. Apple requires the price, renewal period, a restore button,
// and links to the terms and privacy policy on this screen.
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIVACY_URL, TERMS_URL } from "../../config";
import { useCalendarTheme } from "../features/calendar";
import { usePremium, type Plan } from "./premium";
import { ScholarshipNote } from "./ScholarshipNote";

export function PremiumSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useCalendarTheme();
  const insets = useSafeAreaInsets();
  const { plans, isPremium, showAdsAnyway, setShowAdsAnyway, purchase, restore } = usePremium();
  const [busy, setBusy] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Plan | null>(null);

  useEffect(() => {
    // Preselect yearly (better value) when the sheet opens.
    if (visible) setChosen(plans.find((p) => p.period === "year") ?? plans[0] ?? null);
  }, [visible, plans]);

  const monthly = plans.find((p) => p.period === "month");

  async function buy() {
    if (!chosen) return;
    setBusy("buy");
    const result = await purchase(chosen);
    setBusy(null);
    if (result === "purchased") {
      onClose();
      Alert.alert("Thank you!", "Ads are gone. Enjoy the season.");
    } else if (result === "failed") {
      Alert.alert("That didn't go through", "Nothing was charged. Please try again in a bit.");
    }
  }

  async function doRestore() {
    setBusy("restore");
    const ok = await restore();
    setBusy(null);
    if (ok) {
      onClose();
      Alert.alert("Restored", "Your ad-free subscription is active on this phone.");
    } else {
      Alert.alert("Nothing to restore", `We couldn't find an active ad-free subscription for this ${Platform.select({ ios: "Apple ID", default: "Google account" })}.`);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={[styles.close, { color: theme.primary }]}>Not now</Text>
          </Pressable>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Go ad-free</Text>
        <Text style={[styles.lead, { color: theme.muted }]}>
          Remove the ads and help keep Archery in the USA running. Everything else stays free.
        </Text>

        {isPremium ? (
          <>
            <Text style={[styles.lead, { color: theme.primary, fontWeight: "700" }]}>You're already ad-free. Thank you!</Text>
            {/* Lets an ad-free archer (or the owner checking the app) see the ads again on this phone. */}
            <View style={[styles.plan, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 16 }]}>
              <Text style={[styles.planName, { color: theme.text, flex: 1 }]}>Show ads anyway</Text>
              <Switch
                value={showAdsAnyway}
                onValueChange={setShowAdsAnyway}
                trackColor={{ true: theme.primary }}
                accessibilityLabel="Show ads anyway"
              />
            </View>
          </>
        ) : plans.length === 0 ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.plans}>
            {plans.map((p) => {
              const active = chosen?.id === p.id;
              const saving =
                p.period === "year" && monthly ? savings(monthly.pkg, p.pkg) : null;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setChosen(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.plan,
                    { backgroundColor: theme.card, borderColor: active ? theme.primary : theme.border },
                    active && { borderWidth: 2 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: theme.text }]}>{p.period === "year" ? "Yearly" : "Monthly"}</Text>
                    {saving ? <Text style={[styles.save, { color: theme.primary }]}>{saving}</Text> : null}
                  </View>
                  <Text style={[styles.planPrice, { color: theme.text }]}>
                    {p.price}
                    <Text style={[styles.per, { color: theme.muted }]}> / {p.period}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ flex: 1 }} />

        <View style={{ marginBottom: 14 }}>
          <ScholarshipNote />
        </View>

        {!isPremium && plans.length > 0 ? (
          <>
            <Pressable
              onPress={buy}
              disabled={!!busy || !chosen}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cta, { backgroundColor: theme.primary, opacity: pressed || busy ? 0.8 : 1 }]}
            >
              {busy === "buy" ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={[styles.ctaText, { color: theme.onPrimary }]}>
                  Subscribe {chosen ? `for ${chosen.price}/${chosen.period}` : ""}
                </Text>
              )}
            </Pressable>
            <Text style={[styles.fine, { color: theme.muted }]}>
              Renews automatically each {chosen?.period ?? "period"} until you cancel. Cancel anytime in your
              {Platform.select({ ios: "App Store", default: "Google Play" })} subscriptions, at least 24 hours before it renews.
            </Text>
          </>
        ) : null}

        <View style={styles.links}>
          <Pressable onPress={doRestore} disabled={!!busy} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: theme.primary }]}>{busy === "restore" ? "Restoring…" : "Restore purchase"}</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8} accessibilityRole="link">
            <Text style={[styles.link, { color: theme.muted }]}>Terms</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8} accessibilityRole="link">
            <Text style={[styles.link, { color: theme.muted }]}>Privacy</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// "Save 16%" using the store's real prices, so it stays right if prices change.
function savings(monthlyPkg: any, yearlyPkg: any): string | null {
  const m = monthlyPkg?.product?.price;
  const y = yearlyPkg?.product?.price;
  if (typeof m !== "number" || typeof y !== "number" || m <= 0) return null;
  const pct = Math.round((1 - y / (m * 12)) * 100);
  return pct >= 5 ? `Save ${pct}%` : null;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: 22 },
  top: { alignItems: "flex-end", paddingVertical: 14 },
  close: { fontSize: 16, fontWeight: "600" },
  title: { fontSize: 30, fontWeight: "800", marginTop: 8 },
  lead: { fontSize: 16, lineHeight: 22, marginTop: 8 },
  plans: { gap: 10, marginTop: 24 },
  plan: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14, borderWidth: 1 },
  planName: { fontSize: 17, fontWeight: "700" },
  save: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  planPrice: { fontSize: 18, fontWeight: "700" },
  per: { fontSize: 14, fontWeight: "500" },
  cta: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  ctaText: { fontSize: 17, fontWeight: "700" },
  fine: { fontSize: 12, lineHeight: 16, textAlign: "center", marginTop: 10 },
  links: { flexDirection: "row", justifyContent: "center", gap: 22, marginTop: 16 },
  link: { fontSize: 14, fontWeight: "600" },
});

// Renders the sheet wherever the app opens it from (the "Remove ads" link on an ad, Account tab).
export function PremiumSheetHost() {
  const { sheetOpen, closeSheet } = usePremium();
  return <PremiumSheet visible={sheetOpen} onClose={closeSheet} />;
}

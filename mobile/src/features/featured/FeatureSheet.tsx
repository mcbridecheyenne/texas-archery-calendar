// "Feature this shoot": pick where (one state, or All states), how long (7, 14 or 30 days),
// see the store price, pay with Apple. The purchase is a one-time in-app purchase through
// RevenueCat; the feature-shoot function checks it and creates the feature, so it shows
// within a minute. Only lengths that fit before the shoot are offered.
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIVACY_URL, RULES_URL, TERMS_URL } from "../../../config";
import { useAuth } from "../../lib/auth";
import { useHomeState } from "../../lib/homeState";
import { usePremium, type FeatureProduct, type PurchaseReceipt } from "../../monetization/premium";
import { StatePicker, stateName, useCalendarTheme, type TournamentEvent } from "../calendar";
import { daysUntil, fmtDayLong, fmtRange, toIso } from "../calendar/dates";
import { grantFeature, savePending, clearPending } from "./api";
import { useFeatured } from "./FeaturedProvider";
import { dayAfter, nextStart, SPOT_SIZE } from "./types";

function fmtWhen(d: Date): string {
  return fmtDayLong(toIso(d));
}

export function FeatureSheet({ event, onClose }: { event: TournamentEvent | null; onClose: () => void }) {
  const theme = useCalendarTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { homeState } = useHomeState();
  const { featureProducts, storeEnabled, buyFeature } = usePremium();
  const { featured, refresh } = useFeatured();

  const [placement, setPlacement] = useState<"state" | "national">("state");
  const [state, setState] = useState<string>("TX");
  const [pickingState, setPickingState] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // A purchase that went through but hasn't been turned into a feature yet (no signal, say).
  const [unclaimed, setUnclaimed] = useState<{ receipt: PurchaseReceipt; product: FeatureProduct } | null>(null);

  useEffect(() => {
    if (!event) return;
    setPlacement("state");
    setState(event.state && /^[A-Z]{2}$/.test(event.state) ? event.state : homeState ?? "TX");
    setName(profile?.display_name ?? "");
    setDays(null);
    setUnclaimed(null);
  }, [event, homeState, profile?.display_name]);

  // Lengths that fit before the shoot; if none do, just the shortest (it ends when the shoot ends).
  const daysLeft = event ? Math.max(1, daysUntil(event.endDate) + 1) : 0;
  const options = useMemo(() => {
    const mine = featureProducts.filter((p) => p.placement === placement);
    const fit = mine.filter((p) => p.days <= daysLeft);
    return fit.length ? fit : mine.slice(0, 1);
  }, [featureProducts, placement, daysLeft]);
  const chosen = options.find((p) => p.days === days) ?? options[0] ?? null;

  const spot = placement === "national" ? "ALL" : state;
  const startsAt = useMemo(() => nextStart(featured.filter((f) => f.spot === spot)), [featured, spot]);
  const queued = startsAt.getTime() > Date.now() + 60_000;
  const endsAt = useMemo(() => {
    if (!chosen || !event) return null;
    const paid = new Date(startsAt.getTime() + chosen.days * 86400 * 1000);
    const over = dayAfter(event.endDate);
    return paid < over ? paid : over;
  }, [chosen, event, startsAt]);
  const tooLate = !!endsAt && endsAt <= startsAt;

  async function claim(receipt: PurchaseReceipt, product: FeatureProduct) {
    if (!event) return;
    const input = { product, receipt, state: product.placement === "state" ? state : null, buyerName: name.trim(), event };
    try {
      await savePending(input);
      const granted = await grantFeature(input);
      await clearPending();
      setUnclaimed(null);
      await refresh();
      onClose();
      const when = new Date(granted.startsAt).getTime() > Date.now() + 60_000 ? `It starts ${fmtWhen(new Date(granted.startsAt))} and` : "It's live now and";
      Alert.alert("Featured!", `${when} runs until ${fmtWhen(new Date(granted.endsAt))}.`);
    } catch (e: any) {
      setUnclaimed({ receipt, product });
      Alert.alert(
        "Paid, but not placed yet",
        `${e?.message ?? "Something went wrong."}\n\nYour purchase is saved on this phone. Tap "Try again" here, or open this sheet later and it will finish on its own.`
      );
    }
  }

  async function buy() {
    if (!chosen || !event) return;
    if (name.trim().length < 2) {
      Alert.alert("Who's promoting it?", "Enter your name or your club's name. It shows on the card.");
      return;
    }
    setBusy(true);
    const result = await buyFeature(chosen);
    if (result === "cancelled") {
      setBusy(false);
      return;
    }
    if (result === "failed") {
      setBusy(false);
      Alert.alert("That didn't go through", "Nothing was charged. Please try again in a bit.");
      return;
    }
    await claim(result, chosen);
    setBusy(false);
  }

  async function retry() {
    if (!unclaimed) return;
    setBusy(true);
    await claim(unclaimed.receipt, unclaimed.product);
    setBusy(false);
  }

  const price = chosen?.price ?? "";
  const noProducts = !storeEnabled || featureProducts.length === 0;

  return (
    <Modal visible={!!event} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {event ? (
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.top}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={[styles.close, { color: theme.primary }]}>Not now</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: theme.text }]}>Feature this shoot</Text>
            <Text style={[styles.lead, { color: theme.muted }]}>
              <Text style={{ fontWeight: "700", color: theme.text }}>{event.name}</Text> · {fmtRange(event.startDate, event.endDate)}
            </Text>
            <Text style={[styles.lead, { color: theme.muted }]}>
              Puts it at the top of the list with a "Featured" label, so more archers see it. The shoot's details stay exactly as they are.
            </Text>

            {noProducts ? (
              <Text style={[styles.lead, { color: theme.text, marginTop: 20 }]}>Featuring isn't available in this version yet.</Text>
            ) : (
              <>
                <Text style={[styles.section, { color: theme.muted }]}>WHERE</Text>
                <Choice
                  active={placement === "state"}
                  theme={theme}
                  title={`Top of the ${stateName(state) ?? state} list`}
                  note="Tap to pick a different state"
                  onPress={() => {
                    if (placement === "state") setPickingState(true);
                    else setPlacement("state");
                  }}
                />
                <Choice
                  active={placement === "national"}
                  theme={theme}
                  title="Top of the All states list"
                  note="Nationwide"
                  onPress={() => setPlacement("national")}
                />

                <Text style={[styles.section, { color: theme.muted }]}>HOW LONG</Text>
                {options.map((p) => (
                  <Choice
                    key={p.id}
                    active={chosen?.id === p.id}
                    theme={theme}
                    title={`${p.days} days`}
                    note={p.days > daysLeft ? `Ends when the shoot ends, ${fmtDayLong(event.endDate)}` : undefined}
                    price={p.price}
                    onPress={() => setDays(p.days)}
                  />
                ))}

                <Text style={[styles.section, { color: theme.muted }]}>PROMOTED BY</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name or club"
                  placeholderTextColor={theme.muted}
                  maxLength={60}
                  style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                  accessibilityLabel="Promoted by"
                />
                <Text style={[styles.fine, { color: theme.muted, textAlign: "left" }]}>Shows on the card as "Featured · promoted by {name.trim() || "…"}".</Text>

                {tooLate ? (
                  <Text style={[styles.warn, { color: theme.danger }]}>
                    This spot is full until after the shoot ({SPOT_SIZE} featured shoots run at a time). Pick a different state or All states.
                  </Text>
                ) : queued ? (
                  <Text style={[styles.warn, { color: theme.warning }]}>
                    This spot is full right now. Yours would start {fmtWhen(startsAt)} and run until {endsAt ? fmtWhen(endsAt) : ""}.
                  </Text>
                ) : endsAt ? (
                  <Text style={[styles.warn, { color: theme.muted }]}>Starts right away and runs until {fmtWhen(endsAt)}.</Text>
                ) : null}

                {unclaimed ? (
                  <Pressable onPress={retry} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.cta, { backgroundColor: theme.primary, opacity: pressed || busy ? 0.8 : 1 }]}>
                    {busy ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={[styles.ctaText, { color: theme.onPrimary }]}>Try again (already paid)</Text>}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={buy}
                    disabled={busy || !chosen || tooLate}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.cta, { backgroundColor: theme.primary, opacity: pressed || busy || tooLate ? 0.6 : 1 }]}
                  >
                    {busy ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={[styles.ctaText, { color: theme.onPrimary }]}>Pay {price}</Text>}
                  </Pressable>
                )}
                <Text style={[styles.fine, { color: theme.muted }]}>
                  One-time purchase through {Platform.select({ ios: "the App Store", default: "Google Play" })}. Featured shoots must follow the rules; a
                  featured shoot that's removed for breaking them isn't refunded by the app.
                </Text>
                <View style={styles.links}>
                  <Pressable onPress={() => Linking.openURL(RULES_URL)} hitSlop={8} accessibilityRole="link">
                    <Text style={[styles.link, { color: theme.muted }]}>Rules</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8} accessibilityRole="link">
                    <Text style={[styles.link, { color: theme.muted }]}>Terms</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8} accessibilityRole="link">
                    <Text style={[styles.link, { color: theme.muted }]}>Privacy</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
          <StatePicker
            visible={pickingState}
            value={state}
            theme={theme}
            title="Which state's list?"
            onClose={() => setPickingState(false)}
            onPick={(code) => {
              setState(code);
              setPlacement("state");
              setPickingState(false);
            }}
          />
        </View>
      ) : null}
    </Modal>
  );
}

function Choice({ active, theme, title, note, price, onPress }: { active: boolean; theme: ReturnType<typeof useCalendarTheme>; title: string; note?: string; price?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[styles.choice, { backgroundColor: theme.card, borderColor: active ? theme.primary : theme.border }, active && { borderWidth: 2 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceTitle, { color: theme.text }]}>{title}</Text>
        {note ? <Text style={[styles.choiceNote, { color: theme.muted }]}>{note}</Text> : null}
      </View>
      {price ? <Text style={[styles.price, { color: theme.text }]}>{price}</Text> : null}
    </Pressable>
  );
}

// Renders the sheet wherever the app opens it from (a shoot's details, right after adding a tournament).
export function FeatureSheetHost() {
  const { sheetEvent, closeSheet } = useFeatured();
  return <FeatureSheet event={sheetEvent} onClose={closeSheet} />;
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  top: { alignItems: "flex-end", paddingHorizontal: 22, paddingVertical: 14 },
  close: { fontSize: 16, fontWeight: "600" },
  content: { paddingHorizontal: 22 },
  title: { fontSize: 28, fontWeight: "800" },
  lead: { fontSize: 15, lineHeight: 21, marginTop: 8 },
  section: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginTop: 22, marginBottom: 8 },
  choice: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  choiceTitle: { fontSize: 16, fontWeight: "700" },
  choiceNote: { fontSize: 13, marginTop: 2 },
  price: { fontSize: 17, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  warn: { fontSize: 14, lineHeight: 20, marginTop: 16 },
  cta: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 16 },
  ctaText: { fontSize: 17, fontWeight: "700" },
  fine: { fontSize: 12, lineHeight: 16, textAlign: "center", marginTop: 10 },
  links: { flexDirection: "row", justifyContent: "center", gap: 22, marginTop: 12 },
  link: { fontSize: 14, fontWeight: "600" },
});

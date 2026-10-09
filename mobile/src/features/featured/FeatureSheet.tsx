// "Feature this shoot": pick where (a state or All states) and how long (7, 14 or 30 days),
// pay with Apple, and the shoot shows at the top of that list with a "Featured" label.
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { US_STATES, stateName, type TournamentEvent } from "../calendar";
import { fmtRange, parseISODate } from "../calendar/dates";
import { stateCode } from "../calendar/states";
import { buyFeature, loadFeatureProducts, type FeatureProduct } from "../../monetization/featured";
import { Button, Chip, errorText, useTheme } from "../../ui";
import { claimFeature, fetchAvailability } from "./api";

const LENGTHS = [7, 14, 30] as const;
const DAY = 86_400_000;

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** When the shoot is over: the morning after its last day. */
function shootOver(event: TournamentEvent): Date {
  const end = parseISODate(event.endDate);
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
}

export function FeatureSheet({
  event,
  visible,
  onClose,
  onFeatured,
  promoterName,
}: {
  event: TournamentEvent;
  visible: boolean;
  onClose: () => void;
  onFeatured: () => void;
  promoterName: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const ownState = stateCode(event.state);
  const [spot, setSpot] = useState<string>(ownState ?? "ALL");
  const [days, setDays] = useState<(typeof LENGTHS)[number]>(7);
  const [picking, setPicking] = useState(false);
  const [products, setProducts] = useState<Record<string, FeatureProduct> | null>(null);
  const [avail, setAvail] = useState<{ running: number; nextStart: Date } | null>(null);
  const [availError, setAvailError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    loadFeatureProducts().then(setProducts);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setAvail(null);
    setAvailError(false);
    fetchAvailability(spot)
      .then((a) => live && setAvail(a))
      .catch(() => live && setAvailError(true));
    return () => {
      live = false;
    };
  }, [visible, spot]);

  const scope = spot === "ALL" ? "all" : "state";
  const product = products?.[`feature_${scope}_${days}`] ?? null;
  const spotLabel = spot === "ALL" ? "All states" : stateName(spot) ?? spot;

  const plan = useMemo(() => {
    if (!avail) return null;
    const now = new Date();
    const start = avail.nextStart > now ? avail.nextStart : now;
    const over = shootOver(event);
    const full = new Date(start.getTime() + days * DAY);
    const end = full < over ? full : over;
    return { start, end, waits: start.getTime() - now.getTime() > 60_000, cutShort: full > over, noRoom: end.getTime() - start.getTime() < 3_600_000 };
  }, [avail, days, event]);

  async function buy() {
    if (!product || !plan || plan.noRoom) return;
    setBusy(true);
    try {
      const bought = await buyFeature(product);
      if (bought.status === "cancelled") return;
      if (bought.status === "failed") {
        Alert.alert("That didn't go through", "Nothing was charged. Please try again in a bit.");
        return;
      }
      const result = await claimFeature({
        productId: product.id,
        transactionId: bought.transactionId,
        appUserId: bought.appUserId,
        eventId: event.id,
        spot,
      });
      if (result.ok) {
        const start = new Date(result.startsAt);
        const waits = start.getTime() - Date.now() > 60_000;
        onFeatured();
        onClose();
        Alert.alert(
          "Your shoot is featured",
          waits
            ? `It starts at the top of ${spotLabel} on ${fmtDate(start)} and runs until ${fmtDate(new Date(result.endsAt))}.`
            : `It's at the top of ${spotLabel} until ${fmtDate(new Date(result.endsAt))}.`
        );
      } else if (result.retry) {
        onClose();
        Alert.alert("Payment received", `We'll finish featuring your shoot as soon as the app reconnects. (${result.message})`);
      } else {
        Alert.alert("Couldn't feature the shoot", result.message);
      }
    } catch (e) {
      Alert.alert("Couldn't feature the shoot", errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.close, { color: t.primary }]}>Not now</Text>
          </Pressable>
        </View>
        <Text style={[styles.title, { color: t.text }]}>Feature this shoot</Text>
        <Text style={[styles.lead, { color: t.muted }]}>
          {event.name} · {fmtRange(event.startDate, event.endDate)}
        </Text>
        <Text style={[styles.lead, { color: t.muted }]}>
          It shows at the top of the list with a “Featured · promoted by {promoterName}” label, so more archers see it.
        </Text>

        <Text style={[styles.label, { color: t.muted }]}>WHERE</Text>
        <View style={styles.chips}>
          {ownState ? <Chip label={stateName(ownState) ?? ownState} active={spot === ownState} onPress={() => setSpot(ownState)} /> : null}
          {spot !== "ALL" && spot !== ownState ? <Chip label={spotLabel} active onPress={() => setPicking(true)} /> : null}
          <Chip label="All states" active={spot === "ALL"} onPress={() => setSpot("ALL")} />
          <Chip label="Another state…" active={picking} onPress={() => setPicking((v) => !v)} />
        </View>
        {picking ? (
          <View style={styles.chips}>
            {US_STATES.map((s) => (
              <Chip
                key={s.code}
                label={s.name}
                active={spot === s.code}
                onPress={() => {
                  setSpot(s.code);
                  setPicking(false);
                }}
              />
            ))}
          </View>
        ) : null}

        <Text style={[styles.label, { color: t.muted }]}>HOW LONG</Text>
        {products === null ? (
          <ActivityIndicator color={t.primary} style={{ alignSelf: "flex-start" }} />
        ) : (
          LENGTHS.map((n) => {
            const p = products[`feature_${scope}_${n}`];
            const active = days === n;
            return (
              <Pressable
                key={n}
                onPress={() => setDays(n)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.plan, { backgroundColor: t.card, borderColor: active ? t.primary : t.border }, active && { borderWidth: 2 }]}
              >
                <Text style={[styles.planName, { color: t.text }]}>{n} days</Text>
                <Text style={[styles.planName, { color: p ? t.text : t.muted }]}>{p?.price ?? "Not available yet"}</Text>
              </Pressable>
            );
          })
        )}

        <View style={{ minHeight: 44, marginTop: 10 }}>
          {availError ? (
            <Text style={[styles.note, { color: t.danger }]}>Couldn't check open places. Check your connection.</Text>
          ) : !plan ? (
            <ActivityIndicator color={t.primary} style={{ alignSelf: "flex-start" }} />
          ) : plan.noRoom ? (
            <Text style={[styles.note, { color: t.danger }]}>
              All 3 featured places in {spotLabel} are taken until after this shoot. Try another state or All states.
            </Text>
          ) : (
            <Text style={[styles.note, { color: t.text }]}>
              {plan.waits
                ? `All 3 featured places in ${spotLabel} are taken. Yours would start ${fmtDate(plan.start)}`
                : `Starts right away (${avail!.running} of 3 featured places in ${spotLabel} taken)`}
              {plan.cutShort ? `, and ends when the shoot is over (${fmtDate(plan.end)}).` : ` and runs until ${fmtDate(plan.end)}.`}
            </Text>
          )}
        </View>

        <Button
          title={product ? `Feature for ${product.price}` : "Not available yet"}
          onPress={buy}
          busy={busy}
          disabled={!product || !plan || plan.noRoom || busy}
        />
        <Text style={[styles.fine, { color: t.muted }]}>
          One-time purchase through Apple. Featuring doesn't change the shoot's details. A featured shoot that breaks the
          marketplace rules can be removed.
        </Text>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 22, gap: 8 },
  top: { alignItems: "flex-end", paddingVertical: 14 },
  close: { fontSize: 16, fontWeight: "600" },
  title: { fontSize: 28, fontWeight: "800" },
  lead: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginTop: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  plan: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14 },
  planName: { fontSize: 16, fontWeight: "700" },
  note: { fontSize: 14, lineHeight: 20 },
  fine: { fontSize: 12, lineHeight: 17, marginTop: 8 },
});

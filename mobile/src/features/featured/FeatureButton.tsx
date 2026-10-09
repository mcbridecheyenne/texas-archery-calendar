// In a shoot's details: "Feature this shoot" (opens FeatureSheet), and for the archer who
// featured it, how it's doing ("Featured in Texas until Oct 20 · 1,240 views · 63 opened").
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { stateName, type TournamentEvent } from "../calendar";
import { useTheme } from "../../ui";
import { fetchMyFeatures, type MyFeature } from "./api";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** onFeature opens the FeatureSheet (from the screen, after this detail sheet closes). */
export function FeatureButton({ event, close, onFeature }: { event: TournamentEvent; close: () => void; onFeature: (event: TournamentEvent) => void }) {
  const t = useTheme();
  const router = useRouter();
  const { userId, profile } = useAuth();
  const [mine, setMine] = useState<MyFeature[]>([]);

  const load = useCallback(() => {
    if (!userId) return;
    fetchMyFeatures(userId, event.id, event.name).then(setMine, () => {});
  }, [userId, event.id, event.name]);
  useEffect(load, [load]);

  const today = new Date().toISOString().slice(0, 10);
  if (event.endDate < today) return null;

  function start() {
    if (!userId || !profile) {
      close();
      setTimeout(() => router.push(userId ? "/setup-profile" : "/sign-in"), 350);
      return;
    }
    close();
    setTimeout(() => onFeature(event), 350); // let the detail sheet slide away first
  }

  const now = Date.now();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      {mine.map((f) => {
        const where = f.spot === "ALL" ? "All states" : stateName(f.spot) ?? f.spot;
        const waiting = new Date(f.startsAt).getTime() > now;
        const done = new Date(f.endsAt).getTime() <= now;
        return (
          <Text key={f.id} style={[styles.p, { color: t.text }]}>
            {done
              ? `Was featured in ${where} until ${fmtDate(f.endsAt)}`
              : waiting
              ? `Featured in ${where} from ${fmtDate(f.startsAt)} to ${fmtDate(f.endsAt)}`
              : `Featured in ${where} until ${fmtDate(f.endsAt)}`}
            {waiting ? "" : ` · ${f.views.toLocaleString()} views · ${f.opens.toLocaleString()} opened`}
          </Text>
        );
      })}
      <Pressable onPress={start} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.link, { color: t.primary }]}>★ Feature this shoot</Text>
      </Pressable>
      <Text style={[styles.p, { color: t.muted }]}>Put it at the top of a state's list or all states for 7, 14 or 30 days.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  p: { fontSize: 13, lineHeight: 18 },
  link: { fontSize: 15, fontWeight: "700" },
});

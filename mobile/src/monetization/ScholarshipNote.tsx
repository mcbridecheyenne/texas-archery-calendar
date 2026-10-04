// "Donate to the Texas Field Archery Scholarship Fund" and the 10% line, on the ad-free
// sheet and the Support section. Shown only when the home state is Texas AND the phone is
// in Texas right now (approximate, while-in-use location the archer already allowed for
// the marketplace). If location is off or denied, both stay hidden. Other states can
// require charity registration for "% of proceeds" claims, so never widen this without
// re-checking (brief D5-D7, section 7).
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SCHOLARSHIP } from "../../config";
import { useCalendarTheme } from "../features/calendar";
import { approxHere } from "../lib/location";
import { useHomeState } from "../lib/homeState";

export const PROCEEDS_LINE =
  "10% of the app's net proceeds from ad-free subscriptions and tips is donated to the Texas Field Archery Scholarship Fund.";

// Checked once per app launch.
let inTexasCache: Promise<boolean> | null = null;

async function phoneIsInTexas(): Promise<boolean> {
  try {
    // Never asks: only uses permission the archer already gave.
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return false;
    const here = await approxHere();
    if (!here) return false;
    const [place] = await Location.reverseGeocodeAsync({ latitude: here.lat, longitude: here.lng });
    const region = (place?.region ?? "").trim().toUpperCase();
    return (place?.isoCountryCode ?? "US").toUpperCase() === "US" && (region === "TX" || region === "TEXAS");
  } catch {
    return false;
  }
}

export function useShowScholarship(): boolean {
  const { homeState } = useHomeState();
  const [inTexas, setInTexas] = useState(false);
  const eligible = SCHOLARSHIP.enabled && homeState === "TX";
  useEffect(() => {
    if (!eligible) return;
    let live = true;
    inTexasCache ??= phoneIsInTexas().then((v) => {
      if (!v) inTexasCache = null; // try again next time (they may allow location later)
      return v;
    });
    inTexasCache.then((v) => live && setInTexas(v));
    return () => {
      live = false;
    };
  }, [eligible]);
  return eligible && inTexas;
}

export function ScholarshipNote() {
  const theme = useCalendarTheme();
  const show = useShowScholarship();
  if (!show) return null;
  return (
    <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Text style={[styles.line, { color: theme.muted }]}>{PROCEEDS_LINE}</Text>
      {SCHOLARSHIP.donateUrl ? (
        <Pressable
          onPress={() => Linking.openURL(SCHOLARSHIP.donateUrl)}
          accessibilityRole="link"
          style={({ pressed }) => [styles.btn, { borderColor: theme.primary, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.btnText, { color: theme.primary }]}>Donate to the Texas Field Archery Scholarship Fund ↗</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 10 },
  line: { fontSize: 13, lineHeight: 18 },
  btn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  btnText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
});

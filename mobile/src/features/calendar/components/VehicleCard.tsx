// "Your vehicle" in the Account tab: miles per gallon and the gas price, used to work out
// what gas costs to get to each shoot (on the shoot's page and in My Season). Same settings
// as My Season's trip settings, saved on the phone. A blank gas price means the average in
// the archer's state (gas.ts).
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { driveState, gasPriceFor, useGasPrices } from "../gas";
import { useSeasonSettings } from "../season";
import { stateName } from "../states";
import type { CalendarTheme } from "../theme";

function num(v: string): number | null {
  const n = parseFloat(v.replace(/[$,\s]/g, ""));
  return isFinite(n) && n > 0 && n < 1000 ? n : null;
}

const money = (n: number | null) => (n != null ? n.toFixed(2) : "");

export function VehicleCard({ theme, apiBaseUrl, homeState }: { theme: CalendarTheme; apiBaseUrl?: string; homeState?: string | null }) {
  const [settings, change] = useSeasonSettings();
  const [mpg, setMpg] = useState(String(settings.mpg));
  const [gas, setGas] = useState(money(settings.gasPrice));
  const table = useGasPrices(apiBaseUrl);
  const state = driveState(settings.homeTown, homeState);
  const avg = gasPriceFor({ gasPrice: null }, table, state);
  const avgLabel =
    avg.kind === "state"
      ? `the ${stateName(avg.state) ?? avg.state} average ($${avg.price.toFixed(2)} today)`
      : avg.kind === "national"
      ? `the US average ($${avg.price.toFixed(2)} today)${state ? "" : ". Pick your home state below to use your state's"}`
      : "your state's average";
  // Follow changes made elsewhere (My Season's trip settings) and the first load.
  useEffect(() => setMpg(String(settings.mpg)), [settings.mpg]);
  useEffect(() => setGas(money(settings.gasPrice)), [settings.gasPrice]);

  const saveMpg = () => {
    const n = num(mpg);
    if (n) change({ mpg: Math.round(n * 10) / 10 });
    else setMpg(String(settings.mpg));
  };
  const saveGas = () => {
    // Blank: use the state average.
    if (!gas.trim()) return change({ gasPrice: null });
    const n = num(gas);
    if (n) change({ gasPrice: Math.round(n * 100) / 100 });
    else setGas(money(settings.gasPrice));
  };

  const box = [styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }];
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.text }]}>Miles per gallon</Text>
        <TextInput
          value={mpg}
          onChangeText={setMpg}
          onEndEditing={saveMpg}
          onBlur={saveMpg}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={5}
          style={box}
          accessibilityLabel="Your vehicle's miles per gallon"
        />
      </View>
      <View style={[styles.row, styles.divider, { borderTopColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.text }]}>Gas price ($ a gallon)</Text>
        <TextInput
          value={gas}
          onChangeText={setGas}
          onEndEditing={saveGas}
          onBlur={saveGas}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={6}
          placeholder={avg.kind === "guess" ? "" : avg.price.toFixed(2)}
          placeholderTextColor={theme.muted}
          clearButtonMode="while-editing"
          style={box}
          accessibilityLabel="Gas price in dollars a gallon"
        />
      </View>
      <Text style={[styles.hint, { color: theme.muted }]}>
        Used to work out the gas cost of the round trip to each shoot. You'll see it on the shoot's page and in My Season.{" "}
        {settings.gasPrice == null ? `No gas price entered, so it uses ${avgLabel}.` : `Clear the gas price to use ${avgLabel}.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  label: { flex: 1, fontSize: 16 },
  input: { width: 84, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, textAlign: "right" },
  hint: { fontSize: 13, lineHeight: 18, paddingBottom: 8, paddingTop: 2 },
});

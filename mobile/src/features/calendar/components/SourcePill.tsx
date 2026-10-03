import { StyleSheet, Text, View } from "react-native";
import type { CalendarTheme } from "../theme";
import { sourceLabel, type EventSource } from "../types";

const OOS_COLORS = { solid: "#8A5A2B", soft: "#F1E4D3" };

/** Pass `outOfState` (the two-letter state) for archer-added tournaments outside Texas. */
export function SourcePill({ source, theme, outOfState }: { source: EventSource; theme: CalendarTheme; outOfState?: string | null }) {
  const oos = source === "USER" && !!outOfState;
  const c = oos ? (theme.dark ? { solid: "#D9A66B", soft: "#3A2A1A" } : OOS_COLORS) : theme.source[source];
  return (
    <View style={[styles.pill, { backgroundColor: c.soft, borderColor: c.solid + "40" }]}>
      <Text style={[styles.text, { color: c.solid }]}>{oos ? `OUT OF STATE · ${outOfState!.toUpperCase()}` : source === "USER" ? "ADDED BY ARCHER" : sourceLabel(source).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
});

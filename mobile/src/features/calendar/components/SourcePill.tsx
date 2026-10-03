import { StyleSheet, Text, View } from "react-native";
import type { CalendarTheme } from "../theme";
import { sourceLabel, type EventSource } from "../types";

export function SourcePill({ source, theme }: { source: EventSource; theme: CalendarTheme }) {
  const c = theme.source[source];
  return (
    <View style={[styles.pill, { backgroundColor: c.soft, borderColor: c.solid + "40" }]}>
      <Text style={[styles.text, { color: c.solid }]}>{source === "USER" ? "ADDED BY ARCHER" : sourceLabel(source).toUpperCase()}</Text>
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

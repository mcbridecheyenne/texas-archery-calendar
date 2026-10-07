import { StyleSheet, Text, View } from "react-native";
import type { CalendarTheme } from "../theme";
import { isOutOfState, sourceLabel, type TournamentEvent } from "../types";

/** The colored label on a tournament: who lists it, plus the state when it isn't Texas. */
export function SourcePill({ event, theme }: { event: Pick<TournamentEvent, "source" | "organization" | "state">; theme: CalendarTheme }) {
  const { source } = event;
  const c = theme.source[source] ?? theme.source.OTHER;
  const label =
    source === "USER" || source === "CLUB" ? "Added by archer" : source === "OTHER" && event.organization ? event.organization : sourceLabel(source);
  const state = isOutOfState(event) ? event.state!.trim().toUpperCase() : null;
  return (
    <View style={[styles.pill, { backgroundColor: c.soft, borderColor: c.solid + "40" }]}>
      <Text style={[styles.text, { color: c.solid }]}>{state ? `${label} · ${state}`.toUpperCase() : label.toUpperCase()}</Text>
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

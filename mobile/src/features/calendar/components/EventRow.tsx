import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fmtRange, monthShort, parseISODate } from "../dates";
import { fmtMiles } from "../distances";
import type { CalendarTheme } from "../theme";
import type { TournamentEvent } from "../types";
import { SourcePill } from "./SourcePill";

interface Props {
  event: TournamentEvent;
  theme: CalendarTheme;
  going: boolean;
  note?: string | null;
  /** Miles from the archer, when both places are known. */
  miles?: number | null;
  onPress: (event: TournamentEvent) => void;
  onToggleGoing: (event: TournamentEvent) => void;
}

export const EventRow = memo(function EventRow({ event, theme, going, note, miles, onPress, onToggleGoing }: Props) {
  const d = parseISODate(event.startDate);
  return (
    <Pressable
      onPress={() => onPress(event)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${fmtRange(event.startDate, event.endDate)}`}
    >
      <View style={[styles.badge, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <Text style={[styles.badgeMonth, { color: theme.muted }]}>{monthShort(d.getMonth()).toUpperCase()}</Text>
        <Text style={[styles.badgeDay, { color: theme.text }]}>{d.getDate()}</Text>
      </View>
      <View style={styles.body}>
        <SourcePill event={event} theme={theme} />
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {event.name}
        </Text>
        <Text style={[styles.meta, { color: theme.muted }]}>
          {fmtRange(event.startDate, event.endDate)}
          {miles != null ? ` · ${fmtMiles(miles)}` : ""}
        </Text>
        {event.location ? (
          <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
            📍 {event.location}
          </Text>
        ) : null}
        {note ? (
          <Text style={[styles.note, { color: theme.primary }]} numberOfLines={1}>
            👥 {note}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => onToggleGoing(event)}
        hitSlop={12}
        style={styles.star}
        accessibilityRole="button"
        accessibilityLabel={going ? "Remove from Going" : "Mark as Going"}
        accessibilityState={{ selected: going }}
      >
        <Text style={[styles.starText, { color: going ? theme.primary : theme.muted }]}>{going ? "★" : "☆"}</Text>
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  badge: {
    width: 52,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeMonth: { fontSize: 10, fontWeight: "600", letterSpacing: 0.8 },
  badgeDay: { fontSize: 22, fontWeight: "600", marginTop: 2 },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: "600", marginTop: 2 },
  meta: { fontSize: 13 },
  note: { fontSize: 13, fontWeight: "600", marginTop: 1 },
  star: { paddingLeft: 4, paddingTop: 2 },
  starText: { fontSize: 24 },
});

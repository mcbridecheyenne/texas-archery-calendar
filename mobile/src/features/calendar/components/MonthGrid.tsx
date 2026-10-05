// Month view sized for a phone: each day shows a small label per shoot (who runs it and
// the town), and tapping a day lists that day's shoots below.
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { addMonths, currentYM, fmtMonthYear, monthGridDays, toIso, type YM } from "../dates";
import type { CalendarTheme } from "../theme";
import { organizationOf, type TournamentEvent } from "../types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_LABELS = 2;

// Day cells are narrow, so long organization names get a short form.
const SHORT_ORG: Record<string, string> = {
  "Texas ASA": "ASA",
  "USA Archery": "USAA",
  "World Archery": "WA",
  "Club shoots": "Club",
  "Added by archers": "Archer",
};

function shortOrg(e: TournamentEvent): string {
  const o = organizationOf(e);
  return SHORT_ORG[o] ?? o;
}

interface Props {
  month: YM;
  onMonthChange: (ym: YM) => void;
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
  eventsByDay: Map<string, TournamentEvent[]>;
  theme: CalendarTheme;
}

export function MonthGrid({ month, onMonthChange, selectedDay, onSelectDay, eventsByDay, theme }: Props) {
  const days = useMemo(() => monthGridDays(month), [month]);
  const todayIso = toIso(new Date());

  const weeks: Date[][] = [];
  for (let i = 0; i < 42; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          {fmtMonthYear(month)}
        </Text>
        <View style={styles.nav}>
          <NavButton label="‹" a11y="Previous month" onPress={() => onMonthChange(addMonths(month, -1))} theme={theme} />
          <NavButton label="Today" a11y="Go to this month" onPress={() => onMonthChange(currentYM())} theme={theme} />
          <NavButton label="›" a11y="Next month" onPress={() => onMonthChange(addMonths(month, 1))} theme={theme} />
        </View>
      </View>

      <View style={[styles.weekRow, { borderBottomColor: theme.border }]}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={[styles.weekday, { color: theme.muted }]}>
            {w}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((d) => {
            const iso = toIso(d);
            const inMonth = d.getMonth() === month.month;
            const dayEvents = eventsByDay.get(iso) ?? [];
            const isToday = iso === todayIso;
            const isSelected = iso === selectedDay;
            return (
              <Pressable
                key={iso}
                onPress={() => onSelectDay(iso)}
                style={[
                  styles.cell,
                  !inMonth && { backgroundColor: theme.subtle },
                  isSelected && { borderColor: theme.primary, borderWidth: 2 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${iso}, ${dayEvents.length} tournament${dayEvents.length === 1 ? "" : "s"}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[styles.dayNum, isToday && { backgroundColor: theme.primary }]}>
                  <Text
                    style={[
                      styles.dayText,
                      { color: isToday ? theme.onPrimary : inMonth ? theme.text : theme.muted },
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                <View style={styles.labels}>
                  {dayEvents.slice(0, MAX_LABELS).map((ev) => {
                    const c = theme.source[ev.source] ?? theme.source.OTHER;
                    const place = ev.city || ev.location;
                    return (
                      <View key={ev.id} style={[styles.label, { backgroundColor: c.soft, borderLeftColor: c.solid }]}>
                        <Text numberOfLines={1} style={[styles.labelOrg, { color: theme.text }]}>
                          {shortOrg(ev)}
                        </Text>
                        {place ? (
                          <Text numberOfLines={1} style={[styles.labelPlace, { color: theme.text }]}>
                            {place}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                  {dayEvents.length > MAX_LABELS ? (
                    <Text style={[styles.more, { color: theme.muted }]}>+{dayEvents.length - MAX_LABELS} more</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function NavButton({ label, a11y, onPress, theme }: { label: string; a11y: string; onPress: () => void; theme: CalendarTheme }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.navBtn, { backgroundColor: pressed ? theme.subtle : "transparent" }]}
    >
      <Text style={[label.length > 1 ? styles.navText : styles.navArrow, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", paddingBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
  title: { fontSize: 19, fontWeight: "700" },
  nav: { flexDirection: "row", alignItems: "center", gap: 2 },
  navBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, minHeight: 32, justifyContent: "center" },
  navArrow: { fontSize: 24, lineHeight: 26 },
  navText: { fontSize: 14, fontWeight: "600" },
  weekRow: { flexDirection: "row", borderBottomWidth: 0 },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", paddingVertical: 6 },
  cell: {
    flex: 1,
    minHeight: 84,
    margin: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    paddingTop: 3,
  },
  dayNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 13, fontWeight: "600" },
  labels: { alignSelf: "stretch", marginTop: 2, marginHorizontal: 1, gap: 2 },
  label: { borderLeftWidth: 2, borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1 },
  labelOrg: { fontSize: 9, fontWeight: "700", lineHeight: 11 },
  labelPlace: { fontSize: 8, lineHeight: 10 },
  more: { fontSize: 8, fontWeight: "600", textAlign: "center" },
});

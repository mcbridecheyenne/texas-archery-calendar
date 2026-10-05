// Month view sized for a phone: each shoot is one bar (who runs it and the town) that
// stretches across its days, wrapping onto the next week row, and tapping a day lists
// that day's shoots below.
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { addMonths, currentYM, fmtMonthYear, monthGridDays, toIso, type YM } from "../dates";
import type { CalendarTheme } from "../theme";
import { organizationOf, type TournamentEvent } from "../types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_LANES = 2;
const DAY_TOP = 30; // below the day number
const LANE_H = 26;

interface Segment {
  ev: TournamentEvent;
  start: number; // first column (0-6) in this week
  end: number; // last column
  lane: number;
  fromPrev: boolean; // started in an earlier week
  toNext: boolean; // carries on into the next week
}

// Lays out the shoots that touch one week: longest first, each in the lowest free lane,
// so overlapping shoots stack instead of colliding.
function weekSegments(weekIsos: string[], events: TournamentEvent[]): Segment[] {
  const first = weekIsos[0];
  const last = weekIsos[6];
  const segs = events
    .filter((ev) => ev.startDate <= last && ev.endDate >= first)
    .map((ev) => {
      const start = ev.startDate < first ? 0 : weekIsos.indexOf(ev.startDate);
      const end = ev.endDate > last ? 6 : weekIsos.indexOf(ev.endDate);
      return { ev, start, end, lane: 0, fromPrev: ev.startDate < first, toNext: ev.endDate > last };
    })
    .filter((s) => s.start >= 0 && s.end >= s.start)
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.ev.name.localeCompare(b.ev.name));
  const laneEnds: number[] = [];
  for (const seg of segs) {
    let lane = laneEnds.findIndex((end) => end < seg.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = seg.end;
    seg.lane = lane;
  }
  return segs;
}

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
  /** The shoots to draw (already filtered). */
  events: TournamentEvent[];
  onMonthChange: (ym: YM) => void;
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
  eventsByDay: Map<string, TournamentEvent[]>;
  theme: CalendarTheme;
}

export function MonthGrid({ month, events, onMonthChange, selectedDay, onSelectDay, eventsByDay, theme }: Props) {
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

      {weeks.map((week, wi) => {
        const isos = week.map(toIso);
        const segs = weekSegments(isos, events);
        const shown = segs.filter((sg) => sg.lane < MAX_LANES);
        const lanes = Math.min(MAX_LANES, Math.max(0, ...segs.map((sg) => sg.lane + 1)));
        const hidden = isos.map((iso) => (eventsByDay.get(iso)?.length ?? 0) - shown.filter((sg) => sg.ev.startDate <= iso && sg.ev.endDate >= iso).length);
        const rowHeight = Math.max(84, DAY_TOP + lanes * LANE_H + (hidden.some((n) => n > 0) ? 14 : 4));
        return (
          <View key={wi} style={styles.weekRow}>
            {week.map((d, di) => {
              const iso = isos[di];
              const inMonth = d.getMonth() === month.month;
              const dayCount = eventsByDay.get(iso)?.length ?? 0;
              const isToday = iso === todayIso;
              const isSelected = iso === selectedDay;
              return (
                <Pressable
                  key={iso}
                  onPress={() => onSelectDay(iso)}
                  style={[
                    styles.cell,
                    { minHeight: rowHeight },
                    !inMonth && { backgroundColor: theme.subtle },
                    isSelected && { borderColor: theme.primary, borderWidth: 2 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${iso}, ${dayCount} tournament${dayCount === 1 ? "" : "s"}`}
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
                  {hidden[di] > 0 ? (
                    <Text style={[styles.more, { color: theme.muted }]}>+{hidden[di]} more</Text>
                  ) : null}
                </Pressable>
              );
            })}

            {/* The bars sit on top of the day cells; taps fall through to the day. */}
            {shown.map((sg) => {
              const c = theme.source[sg.ev.source] ?? theme.source.OTHER;
              const place = sg.ev.city || sg.ev.location;
              const wide = sg.end > sg.start;
              return (
                <View
                  key={sg.ev.id}
                  pointerEvents="none"
                  style={[
                    styles.barSlot,
                    {
                      left: `${(sg.start / 7) * 100}%`,
                      width: `${((sg.end - sg.start + 1) / 7) * 100}%`,
                      top: DAY_TOP + sg.lane * LANE_H,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.bar,
                      { backgroundColor: c.soft, borderLeftColor: c.solid },
                      sg.fromPrev && styles.barFromPrev,
                      sg.toNext && styles.barToNext,
                    ]}
                  >
                    {wide ? (
                      <Text numberOfLines={1} style={[styles.labelOrg, { color: theme.text }]}>
                        {shortOrg(sg.ev)}
                        {place ? <Text style={styles.labelPlaceInline}>{`  ${place}`}</Text> : null}
                      </Text>
                    ) : (
                      <>
                        <Text numberOfLines={1} style={[styles.labelOrg, { color: theme.text }]}>
                          {shortOrg(sg.ev)}
                        </Text>
                        {place ? (
                          <Text numberOfLines={1} style={[styles.labelPlace, { color: theme.text }]}>
                            {place}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
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
  weekRow: { flexDirection: "row", borderBottomWidth: 0, position: "relative" },
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
  barSlot: { position: "absolute", height: LANE_H - 2, paddingHorizontal: 2 },
  // Square on the stripe side: a rounded colored edge read as "(" next to the text.
  bar: {
    flex: 1,
    justifyContent: "center",
    borderLeftWidth: 2,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    paddingHorizontal: 3,
  },
  barFromPrev: { borderLeftWidth: 0 }, // continues from last week's row
  barToNext: { borderTopRightRadius: 0, borderBottomRightRadius: 0 }, // continues on the next row
  labelOrg: { fontSize: 9, fontWeight: "700", lineHeight: 11 },
  labelPlace: { fontSize: 8, lineHeight: 10 },
  labelPlaceInline: { fontSize: 9, fontWeight: "400" },
  more: { position: "absolute", bottom: 2, fontSize: 8, fontWeight: "600", textAlign: "center" },
});

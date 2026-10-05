// The whole calendar experience in one component.
// Standalone app: <CalendarScreen apiBaseUrl="..." />
// Inside another app's tab bar: <CalendarScreen apiBaseUrl="..." showHeader={false} />
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EventDetail } from "./components/EventDetail";
import { EventRow } from "./components/EventRow";
import { MonthGrid } from "./components/MonthGrid";
import { currentYM, daysInRange, fmtDayLong, fmtMonthYear, fmtRelative, parseISODate, toIso, type YM } from "./dates";
import { useCalendarTheme, type CalendarTheme } from "./theme";
import { normalizeEvent } from "./api";
import { StatePicker } from "./components/StatePicker";
import { stateName } from "./states";
import { organizationOf, organizationsOf, statesOf, type CalendarSocial, type OrgFilter, type StateFilter, type TournamentEvent } from "./types";
import { useShareCard, type ShareCardInfo } from "./components/ShareCard";
import { shootsMessage } from "./share";
import { useEvents } from "./useEvents";
import { useGoing } from "./useGoing";

export interface CalendarScreenProps {
  apiBaseUrl: string;
  /** Hide the built-in title bar when a host app (like a tab navigator) shows its own. */
  showHeader?: boolean;
  /** Title in the built-in header. */
  title?: string;
  /** Space to leave at the bottom. Defaults to the phone's safe area; pass 0 when the host
   *  puts something (like a tab bar or banner) under this screen that already handles it. */
  bottomInset?: number;
  /** Extra content shown at the very end of the list, e.g. a "Go ad-free" link. */
  footer?: ReactNode;
  /** Added to the end of shared shoots, e.g. "Get the Archery in the USA app: <link>". */
  sharePlug?: string;
  /** Name and class printed on shared shoot pictures. */
  shareAs?: ShareCardInfo;
  /** Optional friends/sharing/archer-added tournaments, supplied by the host app. */
  social?: CalendarSocial;
  /** The archer's home state; the state filter starts on it (all states when null). */
  homeState?: string | null;
}

// Club shoots and archer-added tournaments go after the governing bodies.
const LAST_ORGS = ["Other", "Club shoots", "Added by archers"];

export function CalendarScreen({ apiBaseUrl, showHeader = true, title = "Archery in the USA", bottomInset, footer, social, sharePlug, shareAs, homeState }: CalendarScreenProps) {
  const card = useShareCard();
  const theme = useCalendarTheme();
  const insets = useSafeAreaInsets();
  const bottom = bottomInset ?? insets.bottom;
  const { data, loading, refreshing, error, refresh: refreshOfficial } = useEvents(apiBaseUrl);
  const { going, isGoing, toggle } = useGoing();

  const [filter, setFilter] = useState<OrgFilter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>(homeState || "ALL");
  const [pickingState, setPickingState] = useState(false);
  // Follow the home state when it loads or changes.
  useEffect(() => {
    setStateFilter(homeState || "ALL");
    setFilter("all");
  }, [homeState]);
  const [view, setView] = useState<"list" | "calendar" | "mine">("list");
  const [month, setMonth] = useState<YM>(currentYM());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<TournamentEvent | null>(null);
  const [toast, showToast] = useToast();

  const todayIso = toIso(new Date());
  const extraEvents = social?.extraEvents;
  const allEvents = useMemo(() => {
    const official = data?.events ?? [];
    if (!extraEvents?.length) return official;
    return [...official, ...extraEvents.map(normalizeEvent)].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name)
    );
  }, [data, extraEvents]);
  // Upcoming tournaments in the picked state; the organization chips and counts come from these.
  const inState = useMemo(
    () => allEvents.filter((e) => e.endDate >= todayIso && (stateFilter === "ALL" || statesOf(e).includes(stateFilter))),
    [allEvents, stateFilter, todayIso]
  );
  const stateCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of allEvents) if (e.endDate >= todayIso) for (const st of statesOf(e)) c[st] = (c[st] ?? 0) + 1;
    return c;
  }, [allEvents, todayIso]);
  // Organizations with upcoming tournaments here, busiest first, each with the color of its source.
  const orgs = useMemo(() => {
    const m = new Map<string, { count: number; color: string }>();
    for (const e of inState) {
      for (const listing of [e, ...(e.alsoListed ?? [])]) {
        const o = organizationOf(listing);
        const cur = m.get(o);
        if (cur) cur.count++;
        else m.set(o, { count: 1, color: (theme.source[listing.source] ?? theme.source.OTHER).solid });
      }
    }
    if (extraEvents && !m.has("Added by archers")) m.set("Added by archers", { count: 0, color: theme.source.USER.solid });
    return [...m.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => LAST_ORGS.indexOf(a.name) - LAST_ORGS.indexOf(b.name) || b.count - a.count || a.name.localeCompare(b.name));
  }, [inState, extraEvents, theme]);
  const onRefresh = social?.onRefresh;
  const refresh = useCallback(() => {
    onRefresh?.();
    return refreshOfficial();
  }, [onRefresh, refreshOfficial]);

  // Past tournaments stay in for the month grid; the list below only shows upcoming ones.
  const filtered = useMemo(
    () =>
      allEvents.filter(
        (e) =>
          (stateFilter === "ALL" || statesOf(e).includes(stateFilter)) &&
          (filter === "all" ? true : filter === "going" ? going.has(e.id) : organizationsOf(e).includes(filter))
      ),
    [allEvents, filter, stateFilter, going]
  );
  const upcoming = useMemo(() => filtered.filter((e) => e.endDate >= todayIso), [filtered, todayIso]);
  // "My Shoots": every upcoming tournament marked Going, whatever filter is picked.
  const myShoots = useMemo(() => allEvents.filter((e) => going.has(e.id) && e.endDate >= todayIso), [allEvents, going, todayIso]);

  const counts = useMemo(() => ({ all: inState.length, going: myShoots.length }), [inState, myShoots]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, TournamentEvent[]>();
    for (const ev of filtered) {
      for (const iso of daysInRange(ev.startDate, ev.endDate)) {
        const arr = map.get(iso);
        if (arr) arr.push(ev);
        else map.set(iso, [ev]);
      }
    }
    return map;
  }, [filtered]);

  // On first load, open the calendar on the month of the next upcoming shoot.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !data) return;
    jumped.current = true;
    const next = data.events.find((e) => e.endDate >= todayIso);
    if (next) {
      const d = parseISODate(next.startDate);
      setMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [data, todayIso]);

  const changeMonth = useCallback((ym: YM) => {
    setMonth(ym);
    setSelectedDay(null);
  }, []);

  const beforeGoing = social?.beforeGoing;
  const onGoingChange = social?.onGoingChange;
  const onToggleGoing = useCallback(
    async (event: TournamentEvent) => {
      const adding = !isGoing(event.id);
      if (adding && beforeGoing && !(await beforeGoing(event))) return;
      const msg = await toggle(event);
      onGoingChange?.(event, adding);
      if (msg) showToast(msg);
    },
    [toggle, showToast, isGoing, beforeGoing, onGoingChange]
  );

  // Events listed under the month grid: the tapped day, or everything in the visible month.
  const belowGrid = useMemo(() => {
    if (selectedDay) return eventsByDay.get(selectedDay) ?? [];
    const first = toIso(new Date(month.year, month.month, 1));
    const last = toIso(new Date(month.year, month.month + 1, 0));
    return filtered.filter((e) => e.startDate <= last && e.endDate >= first);
  }, [selectedDay, eventsByDay, filtered, month]);

  const sections = useMemo(() => {
    const out: { title: string; data: TournamentEvent[] }[] = [];
    for (const ev of view === "mine" ? myShoots : upcoming) {
      const d = parseISODate(ev.startDate);
      const title = fmtMonthYear({ year: d.getFullYear(), month: d.getMonth() });
      const last = out[out.length - 1];
      if (last && last.title === title) last.data.push(ev);
      else out.push({ title, data: [ev] });
    }
    return out;
  }, [upcoming, myShoots, view]);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} colors={[theme.primary]} />
  );

  const renderRow = (ev: TournamentEvent) => (
    <EventRow
      key={ev.id}
      event={ev}
      theme={theme}
      going={isGoing(ev.id)}
      note={social?.rowNote?.(ev) ?? null}
      onPress={setOpenEvent}
      onToggleGoing={onToggleGoing}
    />
  );

  const segment = (
    <View style={[styles.segment, { backgroundColor: theme.subtle }]}>
      {(["list", "calendar", "mine"] as const).map((v) => (
        <Pressable
          key={v}
          onPress={() => setView(v)}
          style={[styles.segmentBtn, view === v && { backgroundColor: theme.card }]}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === v }}
        >
          <Text style={[styles.segmentText, { color: view === v ? theme.text : theme.muted }]}>
            {v === "list" ? "Upcoming" : v === "calendar" ? "Calendar" : `★ My Shoots${counts.going ? ` ${counts.going}` : ""}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const stateLabel = stateFilter === "ALL" ? "All states" : stateName(stateFilter) ?? stateFilter;

  const mineHeader = (
    <View style={styles.controls}>
      {segment}
      {myShoots.length ? (
        <Pressable
          onPress={() => card.shareCard(myShoots, shareAs ?? {}, shootsMessage(myShoots, sharePlug)).catch(() => {})}
          style={({ pressed }) => [styles.shareBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.shareText, { color: theme.onPrimary }]}>Share my shoots</Text>
          <Text style={[styles.shareSub, { color: theme.onPrimary }]}>Text, Facebook, Instagram, WhatsApp and more</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const controls = (
    <View style={styles.controls}>
      {segment}
      <Pressable
        onPress={() => setPickingState(true)}
        style={({ pressed }) => [styles.stateBtn, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`State: ${stateLabel}. Change state`}
      >
        <Text style={[styles.stateText, { color: theme.text }]}>📍 {stateLabel}</Text>
        <Text style={[styles.stateChange, { color: theme.primary }]}>Change ▾</Text>
      </Pressable>
      {/* Wraps onto a second line instead of scrolling sideways, so every organization is visible. */}
      <View style={styles.chips}>
        <Chip label={`All ${counts.all}`} active={filter === "all"} onPress={() => setFilter("all")} theme={theme} />
        {orgs.map((o) => (
          <Chip
            key={o.name}
            label={`${o.name} ${o.count}`}
            dot={o.color}
            active={filter === o.name}
            onPress={() => setFilter(o.name)}
            theme={theme}
          />
        ))}
      </View>
      {social?.onAddEvent ? (
        <Pressable
          onPress={social.onAddEvent}
          style={({ pressed }) => [styles.addBtn, { borderColor: theme.source.USER.solid, opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.addText, { color: theme.source.USER.solid }]}>＋ Add a tournament</Text>
        </Pressable>
      ) : null}
      <StatusNotes data={data} error={error} theme={theme} onRetry={refresh} />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {showHeader ? (
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[styles.headerSub, { color: theme.muted }]}>
            {data ? `${stateLabel} · updated ${fmtRelative(data.lastUpdated)}` : stateLabel}
          </Text>
        </View>
      ) : null}

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
          <Text style={[styles.centerText, { color: theme.muted }]}>Loading the schedule…</Text>
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={[styles.centerTitle, { color: theme.text }]}>Couldn't load the schedule</Text>
          <Text style={[styles.centerText, { color: theme.muted }]}>{error}</Text>
          <Pressable onPress={refresh} style={[styles.retry, { backgroundColor: theme.primary }]} accessibilityRole="button">
            <Text style={{ color: theme.onPrimary, fontWeight: "700" }}>Try again</Text>
          </Pressable>
        </View>
      ) : view === "calendar" ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottom + 24 }]} refreshControl={refreshControl}>
          {controls}
          <MonthGrid
            month={month}
            onMonthChange={changeMonth}
            selectedDay={selectedDay}
            onSelectDay={(iso) => setSelectedDay((cur) => (cur === iso ? null : iso))}
            events={filtered}
            eventsByDay={eventsByDay}
            theme={theme}
          />
          <View style={styles.belowHeader}>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              {selectedDay ? fmtDayLong(selectedDay).toUpperCase() : `ALL OF ${fmtMonthYear(month).toUpperCase()}`}
            </Text>
            {selectedDay ? (
              <Pressable onPress={() => setSelectedDay(null)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.link, { color: theme.primary }]}>Whole month</Text>
              </Pressable>
            ) : null}
          </View>
          {belowGrid.length ? (
            belowGrid.map(renderRow)
          ) : (
            <Empty theme={theme} text={selectedDay ? "No tournaments on this day." : "No tournaments this month."} />
          )}
          {footer}
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(ev) => ev.id}
          renderItem={({ item }) => renderRow(item)}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, styles.listSection, { color: theme.muted, backgroundColor: theme.background }]}>
              {section.title.toUpperCase()}
            </Text>
          )}
          ListHeaderComponent={view === "mine" ? mineHeader : controls}
          ListFooterComponent={footer ? <>{footer}</> : null}
          ListEmptyComponent={
            <Empty
              theme={theme}
              text={
                view === "mine" || filter === "going"
                  ? "Tap ☆ on a tournament to add it to My Shoots. Then you can share them with friends."
                  : filter === "Added by archers"
                  ? "No tournaments added by archers here yet. Know of one? Tap Add a tournament."
                  : stateFilter !== "ALL" && filter === "all"
                  ? `No upcoming tournaments in ${stateLabel} yet. Know of one? Add it, or pick another state.`
                  : "No upcoming tournaments match."
              }
            />
          }
          contentContainerStyle={[styles.scroll, { paddingBottom: bottom + 24 }]}
          refreshControl={refreshControl}
          stickySectionHeadersEnabled
        />
      )}

      <EventDetail
        event={openEvent}
        going={openEvent ? isGoing(openEvent.id) : false}
        theme={theme}
        onClose={() => setOpenEvent(null)}
        onToggleGoing={onToggleGoing}
        extra={social?.renderDetail}
        sharePlug={sharePlug}
        shareAs={shareAs}
      />

      {card.element}

      <StatePicker
        visible={pickingState}
        value={stateFilter}
        theme={theme}
        title="Show tournaments in"
        allLabel="All states"
        counts={stateCounts}
        onClose={() => setPickingState(false)}
        onPick={(code) => {
          setStateFilter(code);
          setFilter("all");
          setPickingState(false);
        }}
      />

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { bottom: bottom + 20, backgroundColor: theme.text, opacity: toast.opacity }]}
        >
          <Text style={[styles.toastText, { color: theme.background }]}>{toast.text}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function StatusNotes({
  data,
  error,
  theme,
  onRetry,
}: {
  data: { lastUpdated: string; sources: { name: string; status: string }[] } | null;
  error: string | null;
  theme: CalendarTheme;
  onRetry: () => void;
}) {
  if (!data) return null;
  const down = data.sources
    .filter((s) => s.status !== "ok")
    .map((s) => (s.name === "ASA" ? "Texas ASA" : s.name === "Manual" ? "The national list" : s.name));
  if (!error && !down.length) return null;
  return (
    <View style={[styles.notice, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {error ? (
        <Pressable onPress={onRetry} accessibilityRole="button">
          <Text style={[styles.noticeText, { color: theme.warning }]}>
            Offline — showing the schedule from {fmtRelative(data.lastUpdated)}. Pull down to retry.
          </Text>
        </Pressable>
      ) : null}
      {down.length ? (
        <Text style={[styles.noticeText, { color: theme.muted }]}>
          {down.join(" and ")} didn't fully update this time, so some of their events may be missing.
        </Text>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  theme,
  dot,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: CalendarTheme;
  dot?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        active ? { backgroundColor: theme.text, borderColor: theme.text } : { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipText, { color: active ? theme.background : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text, theme }: { text: string; theme: CalendarTheme }) {
  return (
    <View style={[styles.empty, { borderColor: theme.border }]}>
      <Text style={[styles.centerText, { color: theme.muted }]}>{text}</Text>
    </View>
  );
}

function useToast(): [{ text: string; opacity: Animated.Value } | null, (text: string) => void] {
  const [text, setText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = useCallback(
    (t: string) => {
      setText(t);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setText(null));
      }, 2600);
    },
    [opacity]
  );
  return [text ? { text, opacity } : null, show];
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerSub: { fontSize: 12, marginTop: 2 },
  scroll: { padding: 16 },
  controls: { gap: 10, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stateText: { fontSize: 15, fontWeight: "700" },
  stateChange: { fontSize: 14, fontWeight: "600" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  segment: { flexDirection: "row", borderRadius: 10, padding: 3 },
  addBtn: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  addText: { fontSize: 14, fontWeight: "700" },
  segmentBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  segmentText: { fontSize: 14, fontWeight: "600" },
  shareBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center", gap: 2 },
  shareText: { fontSize: 16, fontWeight: "800" },
  shareSub: { fontSize: 12, opacity: 0.9 },
  notice: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 4 },
  noticeText: { fontSize: 13 },
  belowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  listSection: { paddingVertical: 8 },
  link: { fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  centerTitle: { fontSize: 18, fontWeight: "700" },
  centerText: { fontSize: 14, textAlign: "center" },
  retry: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, padding: 24, marginTop: 4 },
  toast: { position: "absolute", left: 24, right: 24, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});

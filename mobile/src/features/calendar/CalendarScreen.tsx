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
  TextInput,
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
import { stateCode, stateName } from "./states";
import { organizationOf, organizationsOf, statesOf, type CalendarSocial, type OrgFilter, type StateFilter, type TournamentEvent } from "./types";
import { NEIGHBORS, isNationalChampionship, matchesSearch, searchText, searchWords, statesAround } from "./browse";
import { useDistances } from "./distances";
import type { FlightsConfig } from "./flights";
import { useCityPrices, type HotelsConfig } from "./hotels";
import { clashes, openStretches, seasonTotals, tripFor, useSeasonSettings } from "./season";
import { SeasonPlan, TripLine } from "./components/SeasonPlan";
import { readJSON, writeJSON } from "./storage";
import { approxHere, placeCoords, regionAt, type Coords } from "../../lib/location";
import { useShareCard, type ShareCardInfo } from "./components/ShareCard";
import { shootsMessage } from "./share";
import { useEvents } from "./useEvents";
import { useGoing } from "./useGoing";
import { checkStarsAgainst } from "./goingStore";

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
  /** "Hotels near the shoot" in each shoot's details (price range + search link). */
  hotels?: HotelsConfig;
  /** "Flights to the shoot" in each shoot's details (Expedia search link). */
  flights?: FlightsConfig;
  /** Something shown in the Upcoming list after every `adEvery` shoots, e.g. an ad card.
   *  `slot` counts them from 0 down the list. Return null to show nothing there. */
  listAd?: (slot: number) => ReactNode;
  adEvery?: number;
}

// Club shoots and archer-added tournaments go after the governing bodies.
const LAST_ORGS = ["Other", "Club shoots", "Added by archers"];

// "Near me" distances, the same as the Marketplace tab. The last choice is kept on the phone.
const NEAR_MILES = [25, 50, 100, 250] as const;
const NEAR_KEY = "nearMe";
// Outside "Near me", miles are looked up for the first this-many shoots in the list (the ones
// people actually scroll to), so picking "All states" doesn't look up every town in the country.
const MILES_FOR_FIRST = 80;

export function CalendarScreen({ apiBaseUrl, showHeader = true, title = "Archery in the USA", bottomInset, footer, social, sharePlug, shareAs, homeState, hotels, flights, listAd, adEvery = 8 }: CalendarScreenProps) {
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

  // Search box: what's typed, and what's applied after a short pause (like the Marketplace).
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  const clearSearch = useCallback(() => {
    setSearch("");
    setQuery("");
  }, []);
  const words = useMemo(() => searchWords(query), [query]);
  const searching = words.length > 0;
  // Starting or clearing a search goes back to every organization, so an old chip can't hide matches.
  useEffect(() => {
    setFilter("all");
  }, [searching]);

  // "Near me": a distance in miles instead of a state. null = picking by state, as before.
  const [near, setNear] = useState<number | null>(null);
  const [origin, setOrigin] = useState<Coords | null>(null); // the phone's rough location
  const [originState, setOriginState] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationOff, setLocationOff] = useState(false); // they said no, or the phone can't tell

  // ask = false only works if the phone already allows location; it never pops up a question.
  const locate = useCallback(async (ask: boolean) => {
    setLocating(true);
    const here = await approxHere({ ask });
    setLocating(false);
    if (!here) {
      if (ask) setLocationOff(true);
      return;
    }
    setLocationOff(false);
    setOrigin(here);
    setOriginState(stateCode(await regionAt(here)));
  }, []);

  // On opening: bring back last time's "Near me" choice. Either way, if the phone already
  // allows location (say, from the Marketplace), find it quietly so shoots can show miles.
  useEffect(() => {
    (async () => {
      const saved = await readJSON<{ miles: number | null }>(NEAR_KEY);
      const miles = NEAR_MILES.find((m) => m === saved?.miles) ?? null;
      setNear(miles);
      locate(miles !== null);
    })();
  }, [locate]);

  const pickNear = useCallback(
    (miles: number) => {
      setNear(miles);
      writeJSON(NEAR_KEY, { miles });
      setFilter("all");
      setPickingState(false);
      if (!origin) locate(true);
    },
    [origin, locate]
  );
  const pickState = useCallback((code: string) => {
    setNear(null);
    writeJSON(NEAR_KEY, { miles: null });
    setStateFilter(code);
    setFilter("all");
    setPickingState(false);
  }, []);

  const todayIso = toIso(new Date());
  const extraEvents = social?.extraEvents;
  const allEvents = useMemo(() => {
    const official = data?.events ?? [];
    if (!extraEvents?.length) return official;
    return [...official, ...extraEvents.map(normalizeEvent)].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name)
    );
  }, [data, extraEvents]);
  const upcomingAll = useMemo(() => allEvents.filter((e) => e.endDate >= todayIso), [allEvents, todayIso]);
  const inPickedState = useCallback(
    (e: TournamentEvent) => stateFilter === "ALL" || statesOf(e).includes(stateFilter),
    [stateFilter]
  );
  // Each shoot's searchable text, worked out once per schedule load and only while searching.
  const searchIndex = useMemo(
    () => (searching ? new Map(allEvents.map((e) => [e.id, searchText(e)])) : null),
    [allEvents, searching]
  );
  const matches = useCallback(
    (e: TournamentEvent) => !searchIndex || matchesSearch(searchIndex.get(e.id) ?? "", words),
    [searchIndex, words]
  );

  // The picked state has nothing coming up: show shoots next door and the nationals instead.
  const stateHasNone = stateFilter !== "ALL" && !upcomingAll.some(inPickedState);
  const neighborStates = useMemo(() => new Set(stateFilter === "ALL" ? [] : NEIGHBORS[stateFilter] ?? []), [stateFilter]);
  const nextDoor = useMemo(
    () => (stateHasNone ? upcomingAll.filter((e) => statesOf(e).some((st) => neighborStates.has(st))) : []),
    [stateHasNone, upcomingAll, neighborStates]
  );

  // States close enough to matter for "Near me": next door for 25–50 miles, two states over
  // for more. Unknown (no state for the phone or the archer) means look everywhere.
  const center = originState ?? homeState ?? null;
  const nearStates = useMemo(
    () => (near !== null && center ? statesAround(center, near >= 100 ? 2 : 1) : null),
    [near, center]
  );
  // The shoots whose towns get looked up for miles, most important first.
  const wanted = useMemo(() => {
    if (!origin) return [];
    if (near !== null) {
      if (!nearStates) return upcomingAll;
      const ring = (e: TournamentEvent) => Math.min(...statesOf(e).map((st) => nearStates.get(st) ?? 99), 99);
      return upcomingAll
        .map((e) => ({ e, r: ring(e) }))
        .filter((x) => x.r < 99)
        .sort((a, b) => a.r - b.r) // closest states first; same-state shoots stay in date order
        .map((x) => x.e);
    }
    const shown = upcomingAll.filter((e) => (searching ? matches(e) : inPickedState(e))).slice(0, MILES_FOR_FIRST);
    return [...shown, ...nextDoor.slice(0, MILES_FOR_FIRST)];
  }, [origin, near, nearStates, upcomingAll, searching, matches, inPickedState, nextDoor]);
  const distances = useDistances(allEvents, origin, wanted);
  const nearOn = near !== null && origin !== null;

  // Where a shoot has to be to show: anywhere while searching, else within the "Near me"
  // distance, else in the picked state. Without a location, "Near me" falls back to the state.
  const inPlace = useCallback(
    (e: TournamentEvent) => {
      if (searching) return true;
      if (nearOn) return (distances.miles.get(e.id) ?? Infinity) <= (near ?? 0);
      return inPickedState(e);
    },
    [searching, nearOn, distances.miles, near, inPickedState]
  );

  // Upcoming tournaments in the picked place (and matching the search); the organization
  // chips and counts come from these.
  const inState = useMemo(() => upcomingAll.filter((e) => inPlace(e) && matches(e)), [upcomingAll, inPlace, matches]);
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
    () => allEvents.filter((e) => inPlace(e) && matches(e) && (filter === "all" || organizationsOf(e).includes(filter))),
    [allEvents, filter, inPlace, matches]
  );
  const upcoming = useMemo(() => filtered.filter((e) => e.endDate >= todayIso), [filtered, todayIso]);

  // Each time the schedule loads: if a starred shoot changed its date or place (which gives
  // it a new id), move the star and its reminders to the new listing.
  useEffect(() => {
    if (data) checkStarsAgainst(allEvents, data).catch(() => {});
  }, [allEvents, data]);
  // "My Shoots": every upcoming tournament marked Going, whatever filter is picked.
  const myShoots = useMemo(() => allEvents.filter((e) => going.has(e.id) && e.endDate >= todayIso), [allEvents, going, todayIso]);

  const counts = useMemo(() => ({ all: inState.length, going: myShoots.length }), [inState, myShoots]);

  // ---- My Season: trip costs, clashes and open stretches for the starred shoots ----
  const [season, changeSeason] = useSeasonSettings();
  // Miles in the season plan are from the archer's home town when they set one, else from the phone.
  const [homeCoords, setHomeCoords] = useState<Coords | null>(null);
  useEffect(() => {
    let live = true;
    setHomeCoords(null);
    if (season.homeTown) placeCoords(season.homeTown).then((c) => live && setHomeCoords(c));
    return () => {
      live = false;
    };
  }, [season.homeTown]);
  const seasonOrigin = season.homeTown ? homeCoords : origin;
  // Shoots worth suggesting for open stretches: in the archer's state and the states around it.
  const seasonCenter = homeState ?? originState ?? null;
  const roughGaps = useMemo(() => openStretches(myShoots, [], new Map(), todayIso), [myShoots, todayIso]);
  const gapCandidates = useMemo(() => {
    if (!roughGaps.length) return [];
    const around = seasonCenter ? statesAround(seasonCenter, 1) : null;
    return upcomingAll
      .filter((e) => !going.has(e.id) && roughGaps.some((g) => e.startDate >= g.from && e.endDate <= g.to))
      .filter((e) => !around || statesOf(e).some((st) => around.has(st)))
      .slice(0, 60);
  }, [roughGaps, seasonCenter, upcomingAll, going]);
  const seasonWanted = useMemo(() => (view === "mine" ? [...myShoots, ...gapCandidates] : myShoots), [view, myShoots, gapCandidates]);
  const seasonMiles = useDistances(allEvents, seasonOrigin, seasonWanted);
  const cityPrices = useCityPrices(view === "mine" ? hotels?.pricesUrl : undefined);
  const trips = useMemo(
    () => new Map(myShoots.map((e) => [e.id, tripFor(e, seasonMiles.miles.get(e.id), season, cityPrices)])),
    [myShoots, seasonMiles.miles, season, cityPrices]
  );
  const totals = useMemo(() => seasonTotals([...trips.values()]), [trips]);
  const seasonClashes = useMemo(() => clashes(myShoots), [myShoots]);
  const clashName = useMemo(() => {
    const m = new Map<string, string>();
    for (const [a, b] of seasonClashes) {
      if (!m.has(a.id)) m.set(a.id, b.name);
      if (!m.has(b.id)) m.set(b.id, a.name);
    }
    return m;
  }, [seasonClashes]);
  const gaps = useMemo(
    () => (view === "mine" ? openStretches(myShoots, gapCandidates, seasonMiles.miles, todayIso) : []),
    [view, myShoots, gapCandidates, seasonMiles.miles, todayIso]
  );

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
      const msg = await toggle(event, adding);
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

  // Where each shoot sits in the Upcoming list (counting across months), for placing listAd.
  const listPosition = useMemo(() => new Map(upcoming.map((e, i) => [e.id, i])), [upcoming]);
  const adAfter = (ev: TournamentEvent): ReactNode => {
    if (!listAd || view !== "list" || adEvery < 1) return null;
    const pos = listPosition.get(ev.id);
    if (pos === undefined || (pos + 1) % adEvery !== 0 || pos === upcoming.length - 1) return null;
    return listAd((pos + 1) / adEvery - 1);
  };

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
      miles={distances.miles.get(ev.id)}
    />
  );
  // My Season rows carry their trip line (cost, registration deadline, hotel button).
  const renderSeasonRow = (ev: TournamentEvent) => (
    <EventRow
      key={ev.id}
      event={ev}
      theme={theme}
      going={isGoing(ev.id)}
      note={social?.rowNote?.(ev) ?? null}
      onPress={setOpenEvent}
      onToggleGoing={onToggleGoing}
      miles={seasonMiles.miles.get(ev.id)}
      extra={<TripLine trip={trips.get(ev.id)} theme={theme} hotels={hotels} clashWith={clashName.get(ev.id)} />}
    />
  );

  // Instead of a blank page when the picked state (or distance) has nothing coming up:
  // the closest shoots next door and the national championships.
  const stillMeasuring = nearOn && distances.pending > 0 && !distances.stuck;
  const showNothingHere = !searching && (nearOn ? !inState.length && !stillMeasuring : stateHasNone);
  const nearestNextDoor = useMemo(() => {
    if (!showNothingHere || nearOn) return [];
    const far = (e: TournamentEvent) => distances.miles.get(e.id) ?? Infinity;
    // Closest first when the phone knows where it is, otherwise soonest first.
    return (origin ? [...nextDoor].sort((a, b) => far(a) - far(b)) : nextDoor).slice(0, 8);
  }, [showNothingHere, nearOn, nextDoor, origin, distances.miles]);
  const nationals = useMemo(
    () =>
      showNothingHere
        ? upcomingAll.filter((e) => isNationalChampionship(e) && !nearestNextDoor.includes(e)).slice(0, 6)
        : [],
    [showNothingHere, upcomingAll, nearestNextDoor]
  );
  const nothingHere = showNothingHere ? (
    <View>
      <Empty
        theme={theme}
        title={nearOn ? `Nothing within ${near} miles yet` : `Nothing listed in ${stateName(stateFilter) ?? stateFilter} yet`}
        text={
          (social?.onAddEvent ? "Know of a shoot? Tap Add a tournament above. " : "") +
          (nearOn ? "Try a bigger distance, or pick a state." : "Here's what's coming up close by.")
        }
      />
      {nearestNextDoor.length ? (
        <>
          <Text style={[styles.sectionTitle, styles.suggestTitle, { color: theme.muted }]}>CLOSEST SHOOTS IN NEIGHBORING STATES</Text>
          {nearestNextDoor.map(renderRow)}
        </>
      ) : null}
      {nationals.length ? (
        <>
          <Text style={[styles.sectionTitle, styles.suggestTitle, { color: theme.muted }]}>NATIONAL CHAMPIONSHIPS</Text>
          {nationals.map(renderRow)}
        </>
      ) : null}
    </View>
  ) : null;

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
            {v === "list" ? "Upcoming" : v === "calendar" ? "Calendar" : `★ My Season${counts.going ? ` ${counts.going}` : ""}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const stateLabel = stateFilter === "ALL" ? "All states" : stateName(stateFilter) ?? stateFilter;
  // What the place button and header say: the distance when "Near me" is working, else the state.
  const placeLabel = nearOn ? `Within ${near} mi of you` : stateLabel;

  // One short line under the place button about search or "Near me", when there's something to say.
  const placeNote = searching
    ? `Searching every state: ${inState.length} upcoming ${inState.length === 1 ? "shoot matches" : "shoots match"}.`
    : near !== null && !origin && locating
    ? "Finding where you are…"
    : near !== null && !origin && locationOff
    ? `Couldn't tell where you are, so this shows ${stateLabel}. To use Near me, turn on location for this app in your phone's Settings.`
    : stillMeasuring
    ? `Working out how far away shoots are (${distances.pending} ${distances.pending === 1 ? "town" : "towns"} to go). More will show up in a moment.`
    : nearOn && distances.stuck
    ? "Couldn't look up every town right now, so a few shoots may be missing. They'll be tried again next time."
    : null;

  const mineHeader = (
    <View style={styles.controls}>
      {segment}
      <SeasonPlan
        theme={theme}
        shoots={myShoots}
        totals={totals}
        settings={season}
        onSettings={changeSeason}
        hasOrigin={!!seasonOrigin}
        measuring={!!seasonOrigin && seasonMiles.pending > 0 && !seasonMiles.stuck}
        clashes={seasonClashes}
        gaps={gaps}
        miles={seasonMiles.miles}
        isGoing={isGoing}
        onOpen={setOpenEvent}
        onToggleGoing={onToggleGoing}
        onShare={() => card.shareCard(myShoots, shareAs ?? {}, shootsMessage(myShoots, sharePlug)).catch(() => {})}
      />
    </View>
  );

  const controls = (
    <View style={styles.controls}>
      {segment}
      <Pressable
        onPress={() => setPickingState(true)}
        style={({ pressed }) => [styles.stateBtn, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`Showing: ${placeLabel}. Change state or pick Near me`}
      >
        <Text style={[styles.stateText, { color: theme.text }]}>📍 {placeLabel}</Text>
        <Text style={[styles.stateChange, { color: theme.primary }]}>Change ▾</Text>
      </Pressable>
      <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.searchIcon, { color: theme.muted }]}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search shoots, towns, states, clubs…"
          placeholderTextColor={theme.muted}
          style={[styles.searchInput, { color: theme.text }]}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search tournaments"
        />
        {search ? (
          <Pressable onPress={clearSearch} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <Text style={[styles.searchClear, { color: theme.muted }]}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      {placeNote ? <Text style={[styles.placeNote, { color: theme.muted }]}>{placeNote}</Text> : null}
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
            {data ? `${placeLabel} · updated ${fmtRelative(data.lastUpdated)}` : placeLabel}
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
          {belowGrid.length ? belowGrid.map(renderRow) : null}
          {!belowGrid.length && !nothingHere ? (
            <Empty
              theme={theme}
              text={
                searching
                  ? `Nothing ${selectedDay ? "on this day" : "this month"} matches “${query}”.`
                  : selectedDay
                  ? "No tournaments on this day."
                  : "No tournaments this month."
              }
            />
          ) : null}
          {nothingHere}
          {footer}
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(ev) => ev.id}
          renderItem={({ item }) =>
            view === "mine" ? (
              renderSeasonRow(item)
            ) : (
              <>
                {renderRow(item)}
                {adAfter(item)}
              </>
            )
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, styles.listSection, { color: theme.muted, backgroundColor: theme.background }]}>
              {section.title.toUpperCase()}
            </Text>
          )}
          ListHeaderComponent={view === "mine" ? mineHeader : controls}
          ListFooterComponent={footer ? <>{footer}</> : null}
          ListEmptyComponent={
            view !== "mine" && nothingHere ? (
              nothingHere
            ) : view !== "mine" && searching ? (
              <Empty
                theme={theme}
                title={`No shoots match “${query}”`}
                text="Check the spelling, or try a town, state, club or organization. Tap ✕ to clear the search."
              />
            ) : (
              <Empty
                theme={theme}
                text={
                  view === "mine"
                    ? "Tap ☆ on the shoots you want to make this season. Your season plan shows up here: trip costs, clashing dates, open weekends and shoots to fill them."
                    : stillMeasuring
                    ? "Working out how far away shoots are…"
                    : filter === "Added by archers"
                    ? "No tournaments added by archers here yet. Know of one? Tap Add a tournament."
                    : "No upcoming tournaments match."
                }
              />
            )
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
        hotels={hotels}
        flights={flights}
      />

      {card.element}

      <StatePicker
        visible={pickingState}
        value={near !== null ? null : stateFilter}
        theme={theme}
        title="Show tournaments in"
        allLabel="All states"
        counts={stateCounts}
        onClose={() => setPickingState(false)}
        onPick={pickState}
        nearMiles={NEAR_MILES}
        nearValue={near}
        nearNote={
          locationOff
            ? "Location is off for this app. Turn it on in your phone's Settings to use Near me."
            : "Uses your phone's rough location, only while the app is open."
        }
        onPickNear={pickNear}
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

function Empty({ text, theme, title }: { text: string; theme: CalendarTheme; title?: string }) {
  return (
    <View style={[styles.empty, { borderColor: theme.border }]}>
      {title ? <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text> : null}
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
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, padding: 24, marginTop: 4, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  suggestTitle: { marginTop: 18, marginBottom: 8 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 9 },
  searchClear: { fontSize: 16, fontWeight: "700", paddingHorizontal: 2 },
  placeNote: { fontSize: 13, lineHeight: 18 },
  toast: { position: "absolute", left: 24, right: 24, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});

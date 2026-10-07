// The top of "My Season": the season's trip costs, the archer's goal and budget, shoots that
// clash, open stretches with shoots that could fill them, and buttons to add every shoot to
// the phone's calendar, share the season and change the trip settings. The shoots themselves
// are listed below it by CalendarScreen, each with its own TripLine.
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addAllToPhoneCalendar, openUrl } from "../actions";
import { fmtDayLong, fmtRange, monthShort, parseISODate, toIso } from "../dates";
import { fmtMiles } from "../distances";
import { hotelSearchUrl, type HotelsConfig } from "../hotels";
import { fmtCount, fmtMoney, ROAD_FACTOR, type Gap, type SeasonSettings, type SeasonTotals, type Trip } from "../season";
import type { CalendarTheme } from "../theme";
import type { TournamentEvent } from "../types";

interface Props {
  theme: CalendarTheme;
  shoots: TournamentEvent[];
  totals: SeasonTotals;
  settings: SeasonSettings;
  onSettings: (change: Partial<SeasonSettings>) => void;
  /** False when neither the phone's location nor a home town is known, so there are no miles. */
  hasOrigin: boolean;
  /** Still looking up towns for miles. */
  measuring: boolean;
  clashes: [TournamentEvent, TournamentEvent][];
  gaps: Gap[];
  miles: Map<string, number>;
  isGoing: (id: string) => boolean;
  onOpen: (event: TournamentEvent) => void;
  onToggleGoing: (event: TournamentEvent) => void;
  onShare: () => void;
}

export function SeasonPlan(p: Props) {
  const { theme, shoots, totals, settings } = p;
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  if (!shoots.length) return null;

  async function addAll() {
    setAdding(true);
    try {
      const result = await addAllToPhoneCalendar(shoots);
      if (result) {
        const { added, already } = result;
        Alert.alert(
          added ? "Added to your calendar" : "Already in your calendar",
          added
            ? `${added} ${added === 1 ? "shoot was" : "shoots were"} added to your phone's calendar.` +
                (already ? ` ${already} ${already === 1 ? "was" : "were"} already there.` : "")
            : "Every shoot in your season is already in your phone's calendar."
        );
      }
    } catch {
      Alert.alert("Couldn't add them", "Something went wrong adding your shoots to the calendar. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  const overBudget = settings.budget != null && totals.total > settings.budget;
  const goalPct = settings.goal ? Math.min(1, shoots.length / settings.goal) : 0;
  const budgetPct = settings.budget ? Math.min(1, totals.total / settings.budget) : 0;

  return (
    <View style={styles.wrap}>
      {/* Summary */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.kicker, { color: theme.muted }]}>YOUR SEASON</Text>
        <View style={styles.statRow}>
          <Stat theme={theme} value={String(totals.shoots)} label={totals.shoots === 1 ? "shoot" : "shoots"} />
          <Stat theme={theme} value={p.hasOrigin && totals.miles ? fmtCount(totals.miles) : "–"} label="miles driving" />
          <Stat theme={theme} value={p.hasOrigin ? `~${fmtMoney(totals.total)}` : "–"} label="travel cost" />
        </View>
        {p.hasOrigin ? (
          <Text style={[styles.small, { color: theme.muted }]}>
            Gas {fmtMoney(totals.gas)} · Hotels {fmtMoney(totals.hotel)}
            {totals.nights ? ` (${totals.nights} ${totals.nights === 1 ? "night" : "nights"})` : ""} · entry fees not included
          </Text>
        ) : (
          <Text style={[styles.small, { color: theme.muted }]}>
            Set where you drive from (Trip settings), or turn on location, to see miles and costs.
          </Text>
        )}
        {p.measuring ? (
          <Text style={[styles.small, { color: theme.muted }]}>Working out how far each shoot is…</Text>
        ) : p.hasOrigin && totals.partial ? (
          <Text style={[styles.small, { color: theme.muted }]}>
            {totals.partial} {totals.partial === 1 ? "shoot isn't" : "shoots aren't"} fully counted: the town or its hotel prices
            aren't known yet.
          </Text>
        ) : null}

        {settings.goal ? (
          <Meter
            theme={theme}
            label={`Goal: ${shoots.length} of ${settings.goal} shoots planned`}
            pct={goalPct}
            color={theme.primary}
            done={shoots.length >= settings.goal ? "Goal reached 🎯" : null}
          />
        ) : null}
        {settings.budget != null && p.hasOrigin ? (
          <Meter
            theme={theme}
            label={`Budget: ~${fmtMoney(totals.total)} of ${fmtMoney(settings.budget)}`}
            pct={budgetPct}
            color={overBudget ? theme.danger : theme.source.ASA.solid}
            done={overBudget ? `About ${fmtMoney(totals.total - settings.budget)} over` : null}
          />
        ) : null}
        {!settings.goal || settings.budget == null ? (
          <Pressable onPress={() => setEditing(true)} hitSlop={6} accessibilityRole="button">
            <Text style={[styles.link, { color: theme.primary }]}>
              {!settings.goal && settings.budget == null ? "Set a goal or budget" : !settings.goal ? "Set a goal" : "Set a budget"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <Button theme={theme} label={adding ? "" : "Add all to Calendar"} onPress={addAll} busy={adding} />
        <Button theme={theme} label="Trip settings" onPress={() => setEditing(true)} />
      </View>
      <Pressable
        onPress={p.onShare}
        style={({ pressed }) => [styles.shareBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.shareText, { color: theme.onPrimary }]}>Share my season</Text>
        <Text style={[styles.shareSub, { color: theme.onPrimary }]}>Text, Facebook, Instagram, WhatsApp and more</Text>
      </Pressable>

      {/* Clashes */}
      {p.clashes.map(([a, b]) => (
        <View key={`${a.id}|${b.id}`} style={[styles.warn, { borderColor: theme.warning, backgroundColor: theme.card }]}>
          <Text style={[styles.warnTitle, { color: theme.warning }]}>⚠ Same dates</Text>
          <Text style={[styles.small, { color: theme.text }]}>
            <Text style={styles.bold} onPress={() => p.onOpen(a)}>{a.name}</Text> ({fmtRange(a.startDate, a.endDate)}) and{" "}
            <Text style={styles.bold} onPress={() => p.onOpen(b)}>{b.name}</Text> ({fmtRange(b.startDate, b.endDate)}) overlap. You can
            only make one.
          </Text>
        </View>
      ))}

      {/* Open stretches */}
      {p.gaps.map((g) => (
        <View key={g.from} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.gapTitle, { color: theme.text }]}>
            {g.weekends} {g.weekends === 1 ? "weekend" : "weekends"} free: {fmtDayLong(g.from)} – {fmtDayLong(g.to)}
          </Text>
          {g.suggestions.length ? (
            <>
              <Text style={[styles.small, { color: theme.muted }]}>Shoots that would fill it:</Text>
              {g.suggestions.map((e) => (
                <Suggestion
                  key={e.id}
                  event={e}
                  theme={theme}
                  miles={p.miles.get(e.id)}
                  going={p.isGoing(e.id)}
                  onOpen={p.onOpen}
                  onToggleGoing={p.onToggleGoing}
                />
              ))}
            </>
          ) : (
            <Text style={[styles.small, { color: theme.muted }]}>Nothing listed nearby in that stretch yet.</Text>
          )}
        </View>
      ))}

      <Text style={[styles.kicker, styles.listTitle, { color: theme.muted }]}>YOUR SHOOTS</Text>

      <SettingsSheet visible={editing} theme={theme} settings={settings} onClose={() => setEditing(false)} onSave={p.onSettings} />
    </View>
  );
}

/** Under each shoot in "My Season": its trip cost, when registration closes, and a hotel button. */
export function TripLine({
  trip,
  theme,
  hotels,
  clashWith,
}: {
  trip: Trip | undefined;
  theme: CalendarTheme;
  hotels?: HotelsConfig;
  clashWith?: string | null;
}) {
  if (!trip) return null;
  const e = trip.event;
  const parts: string[] = [];
  if (trip.miles != null) {
    parts.push(`${fmtMiles(trip.miles * ROAD_FACTOR)} drive`);
    if (trip.gas != null) parts.push(`gas ~${fmtMoney(trip.gas)}`);
    if (trip.nights) parts.push(`${trip.nights} ${trip.nights === 1 ? "night" : "nights"}${trip.hotel != null ? ` ~${fmtMoney(trip.hotel)}` : ""}`);
    else parts.push("day trip");
  }
  const regClose = e.registrationEnd && e.registrationEnd < e.startDate && e.registrationEnd >= toIso(new Date()) ? e.registrationEnd : null;
  const hotelUrl = trip.nights && hotels?.enabled ? hotelSearchUrl(e, hotels) : null;
  if (!parts.length && !regClose && !hotelUrl && !clashWith) return null;
  return (
    <View style={[styles.trip, { borderTopColor: theme.border }]}>
      {parts.length ? <Text style={[styles.tripText, { color: theme.text }]}>🚗 {parts.join(" · ")}</Text> : null}
      {regClose ? (
        <Text style={[styles.tripText, { color: theme.warning }]}>📝 Register by {fmtDayLong(regClose)}</Text>
      ) : null}
      {clashWith ? <Text style={[styles.tripText, { color: theme.warning }]}>⚠ Same dates as {clashWith}</Text> : null}
      {hotelUrl ? (
        <Pressable onPress={() => openUrl(hotelUrl)} hitSlop={6} accessibilityRole="link">
          <Text style={[styles.tripLink, { color: theme.primary }]}>🏨 Book a hotel{trip.nightly ? ` (about $${trip.nightly}/night)` : ""}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Suggestion({
  event,
  theme,
  miles,
  going,
  onOpen,
  onToggleGoing,
}: {
  event: TournamentEvent;
  theme: CalendarTheme;
  miles?: number;
  going: boolean;
  onOpen: (e: TournamentEvent) => void;
  onToggleGoing: (e: TournamentEvent) => void;
}) {
  const d = parseISODate(event.startDate);
  return (
    <Pressable
      onPress={() => onOpen(event)}
      style={({ pressed }) => [styles.sug, { borderTopColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${fmtRange(event.startDate, event.endDate)}`}
    >
      <Text style={[styles.sugDate, { color: theme.muted }]}>
        {monthShort(d.getMonth()).toUpperCase()} {d.getDate()}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sugName, { color: theme.text }]} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
          {[event.city, event.state].filter(Boolean).join(", ")}
          {miles != null ? ` · ${fmtMiles(miles)}` : ""}
        </Text>
      </View>
      <Pressable
        onPress={() => onToggleGoing(event)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={going ? "Remove from Going" : "Mark as Going"}
      >
        <Text style={[styles.sugStar, { color: going ? theme.primary : theme.muted }]}>{going ? "★" : "☆"}</Text>
      </Pressable>
    </Pressable>
  );
}

function Stat({ theme, value, label }: { theme: CalendarTheme; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function Meter({ theme, label, pct, color, done }: { theme: CalendarTheme; label: string; pct: number; color: string; done: string | null }) {
  return (
    <View style={styles.meter}>
      <View style={styles.meterTop}>
        <Text style={[styles.small, { color: theme.text, fontWeight: "600" }]}>{label}</Text>
        {done ? <Text style={[styles.small, { color, fontWeight: "700" }]}>{done}</Text> : null}
      </View>
      <View style={[styles.track, { backgroundColor: theme.subtle }]}>
        <View style={[styles.fill, { backgroundColor: color, width: `${Math.round(pct * 100)}%` }]} />
      </View>
    </View>
  );
}

function Button({ theme, label, onPress, busy }: { theme: CalendarTheme; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
    >
      {busy ? <ActivityIndicator color={theme.primary} /> : <Text style={[styles.btnText, { color: theme.text }]}>{label}</Text>}
    </Pressable>
  );
}

// "Trip settings": the car, gas price, when to stay overnight, where they drive from, goal, budget.
function SettingsSheet({
  visible,
  theme,
  settings,
  onClose,
  onSave,
}: {
  visible: boolean;
  theme: CalendarTheme;
  settings: SeasonSettings;
  onClose: () => void;
  onSave: (change: Partial<SeasonSettings>) => void;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<Record<keyof SeasonSettings, string>>(toForm(settings));
  useEffect(() => {
    if (visible) setForm(toForm(settings));
  }, [visible, settings]);

  const set = (k: keyof SeasonSettings) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    const num = (v: string) => {
      const n = parseFloat(v.replace(/[$,\s]/g, ""));
      return isFinite(n) && n > 0 ? n : null;
    };
    onSave({
      mpg: num(form.mpg) ?? settings.mpg,
      gasPrice: num(form.gasPrice) ?? settings.gasPrice,
      overnightMiles: num(form.overnightMiles) ?? settings.overnightMiles,
      homeTown: form.homeTown.trim(),
      goal: num(form.goal) != null ? Math.round(num(form.goal)!) : null,
      budget: num(form.budget),
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.sheetTop, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.sheetBtn, { color: theme.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Trip settings</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.sheetBtn, { color: theme.primary, fontWeight: "700" }]}>Save</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.sheetBody, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Field theme={theme} label="Drive from" hint="Your town, e.g. Abilene, TX. Leave blank to use your phone's location." value={form.homeTown} onChange={set("homeTown")} />
          <Field theme={theme} label="Miles per gallon" value={form.mpg} onChange={set("mpg")} numeric />
          <Field theme={theme} label="Gas price ($ a gallon)" value={form.gasPrice} onChange={set("gasPrice")} numeric />
          <Field
            theme={theme}
            label="Stay in a hotel when the shoot is at least (miles away)"
            hint="Closer shoots count as day trips."
            value={form.overnightMiles}
            onChange={set("overnightMiles")}
            numeric
          />
          <Field theme={theme} label="Season goal (number of shoots)" hint="Leave blank for no goal." value={form.goal} onChange={set("goal")} numeric />
          <Field theme={theme} label="Travel budget ($)" hint="Gas and hotels for the season. Leave blank for no budget." value={form.budget} onChange={set("budget")} numeric />
          <Text style={[styles.small, { color: theme.muted, marginTop: 8 }]}>
            Costs are rough: driving miles are estimated from the straight-line distance, and hotel costs use the town's average
            nightly price when the app has it. Entry fees aren't included.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function toForm(s: SeasonSettings): Record<keyof SeasonSettings, string> {
  return {
    mpg: String(s.mpg),
    gasPrice: String(s.gasPrice),
    overnightMiles: String(s.overnightMiles),
    homeTown: s.homeTown,
    goal: s.goal != null ? String(s.goal) : "",
    budget: s.budget != null ? String(s.budget) : "",
  };
}

function Field({
  theme,
  label,
  hint,
  value,
  onChange,
  numeric,
}: {
  theme: CalendarTheme;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCorrect={false}
        style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
        placeholderTextColor={theme.muted}
        accessibilityLabel={label}
      />
      {hint ? <Text style={[styles.small, { color: theme.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 10 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  listTitle: { marginTop: 8 },
  statRow: { flexDirection: "row", gap: 8, marginVertical: 4 },
  stat: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 12 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: "700" },
  link: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  meter: { gap: 4, marginTop: 6 },
  meterTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  buttons: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, alignItems: "center", minHeight: 44, justifyContent: "center" },
  btnText: { fontSize: 15, fontWeight: "600" },
  shareBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center", gap: 2 },
  shareText: { fontSize: 16, fontWeight: "800" },
  shareSub: { fontSize: 12, opacity: 0.9 },
  warn: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  warnTitle: { fontSize: 14, fontWeight: "700" },
  gapTitle: { fontSize: 15, fontWeight: "700" },
  sug: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  sugDate: { width: 50, fontSize: 12, fontWeight: "700" },
  sugName: { fontSize: 15, fontWeight: "600" },
  sugStar: { fontSize: 22 },
  trip: { marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, gap: 3 },
  tripText: { fontSize: 13 },
  tripLink: { fontSize: 13, fontWeight: "700" },
  sheetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  sheetBtn: { fontSize: 16 },
  sheetBody: { padding: 18, gap: 16 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 15, fontWeight: "600" },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});

// Full-screen list of states. Used by the calendar's state filter (which also offers
// "Near me" distances at the top), the first-launch "Where do you shoot?" screen and the
// profile's home state.
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { US_STATES } from "../states";
import type { CalendarTheme } from "../theme";

export function StatePicker({
  visible,
  value,
  onPick,
  onClose,
  theme,
  title = "Pick a state",
  allLabel,
  counts,
  nearMiles,
  nearValue = null,
  nearNote,
  onPickNear,
}: {
  visible: boolean;
  value: string | null;
  onPick: (code: string) => void;
  onClose: () => void;
  theme: CalendarTheme;
  title?: string;
  /** Adds an "All states" row at the top (value "ALL") with this label. */
  allLabel?: string;
  /** Upcoming tournaments per state, shown on the right. */
  counts?: Record<string, number>;
  /** Adds a "Near me" row of distance choices at the top, e.g. [25, 50, 100, 250]. */
  nearMiles?: readonly number[];
  /** The distance picked now, when "Near me" is on. */
  nearValue?: number | null;
  /** A short line under the distances, e.g. why location is off. */
  nearNote?: string | null;
  onPickNear?: (miles: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const rows = allLabel ? [{ code: "ALL", name: allLabel }, ...US_STATES] : US_STATES;
  const near =
    nearMiles?.length && onPickNear ? (
      <View style={[styles.near, { borderBottomColor: theme.border }]}>
        <Text style={[styles.nearTitle, { color: theme.text }]}>📍 Near me</Text>
        <View style={styles.nearChips}>
          {nearMiles.map((m) => {
            const active = m === nearValue;
            return (
              <Pressable
                key={m}
                onPress={() => onPickNear(m)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Within ${m} miles of me`}
                style={[
                  styles.nearChip,
                  active ? { backgroundColor: theme.text, borderColor: theme.text } : { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.nearChipText, { color: active ? theme.background : theme.text }]}>{m} mi</Text>
              </Pressable>
            );
          })}
        </View>
        {nearNote ? <Text style={[styles.nearNote, { color: theme.muted }]}>{nearNote}</Text> : null}
        <Text style={[styles.orState, { color: theme.muted }]}>OR PICK A STATE</Text>
      </View>
    ) : null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={[styles.top, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.close, { color: theme.primary }]}>Cancel</Text>
          </Pressable>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(s) => s.code}
          ListHeaderComponent={near}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          renderItem={({ item }) => {
            const active = item.code === value;
            const n = counts && item.code !== "ALL" ? counts[item.code] ?? 0 : null;
            return (
              <Pressable
                onPress={() => onPick(item.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.row, { borderBottomColor: theme.border, backgroundColor: pressed ? theme.subtle : "transparent" }]}
              >
                <Text style={[styles.name, { color: theme.text, fontWeight: active ? "800" : "500" }]}>{item.name}</Text>
                {n !== null ? <Text style={[styles.count, { color: theme.muted }]}>{n || ""}</Text> : null}
                {active ? <Text style={[styles.check, { color: theme.primary }]}>✓</Text> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  name: { flex: 1, fontSize: 16 },
  count: { fontSize: 14 },
  check: { fontSize: 16, fontWeight: "900" },
  near: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  nearTitle: { fontSize: 16, fontWeight: "700" },
  nearChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nearChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  nearChipText: { fontSize: 14, fontWeight: "600" },
  nearNote: { fontSize: 13, lineHeight: 18 },
  orState: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, marginTop: 6 },
});

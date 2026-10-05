// Full-screen list of states. Used by the calendar's state filter, the first-launch
// "Where do you shoot?" screen and the profile's home state.
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
}) {
  const insets = useSafeAreaInsets();
  const rows = allLabel ? [{ code: "ALL", name: allLabel }, ...US_STATES] : US_STATES;
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
});

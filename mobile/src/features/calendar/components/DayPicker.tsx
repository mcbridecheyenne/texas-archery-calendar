// "Which days are you going?" for a shoot of more than one day. A checkbox per day, all
// ticked to start with, so tapping Save right away means every day (like before).
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtDayLong, pickableDays } from "../dates";
import type { CalendarTheme } from "../theme";
import type { TournamentEvent } from "../types";

interface Props {
  /** The shoot to ask about; null hides the picker. */
  event: TournamentEvent | null;
  /** Days ticked when it opens. Undefined means every day. */
  initial?: string[];
  theme: CalendarTheme;
  /** "I'm going" when adding the shoot, "Save" when changing the days. */
  saveLabel: string;
  onSave: (days: string[]) => void;
  onCancel: () => void;
}

export function DayPicker({ event, initial, theme, saveLabel, onSave, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const all = event ? pickableDays(event.startDate, event.endDate) : [];
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Start fresh each time it opens.
  const key = event ? `${event.id}|${(initial ?? []).join(",")}` : "";
  useEffect(() => {
    if (!event) return;
    const days = pickableDays(event.startDate, event.endDate);
    const start = initial?.length ? days.filter((d) => initial.includes(d)) : days;
    setPicked(new Set(start.length ? start : days));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const flip = (day: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  const none = picked.size === 0;

  return (
    <Modal visible={!!event} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Cancel">
        {/* Taps on the card itself shouldn't close it. */}
        <Pressable
          style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border, marginBottom: insets.bottom + 16 }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: theme.text }]}>Which days are you going?</Text>
          {event ? (
            <Text style={[styles.sub, { color: theme.muted }]} numberOfLines={2}>
              {event.name}
            </Text>
          ) : null}

          <View style={styles.list}>
            {all.map((day) => {
              const on = picked.has(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => flip(day)}
                  style={({ pressed }) => [styles.row, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={fmtDayLong(day)}
                >
                  <View
                    style={[
                      styles.box,
                      { borderColor: theme.primary, backgroundColor: on ? theme.primary : "transparent" },
                    ]}
                  >
                    {on ? <Text style={[styles.tick, { color: theme.onPrimary }]}>✓</Text> : null}
                  </View>
                  <Text style={[styles.day, { color: theme.text }]}>{fmtDayLong(day)}</Text>
                </Pressable>
              );
            })}
          </View>

          {none ? <Text style={[styles.sub, { color: theme.warning }]}>Pick at least one day.</Text> : null}

          <View style={styles.buttons}>
            <Pressable onPress={onCancel} hitSlop={8} style={styles.btn} accessibilityRole="button">
              <Text style={[styles.btnText, { color: theme.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => !none && onSave(all.filter((d) => picked.has(d)))}
              disabled={none}
              style={[styles.btn, styles.save, { backgroundColor: theme.primary, opacity: none ? 0.4 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: none }}
            >
              <Text style={[styles.btnText, { color: theme.onPrimary }]}>{saveLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", paddingHorizontal: 16 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 6 },
  title: { fontSize: 18, fontWeight: "700" },
  sub: { fontSize: 14 },
  list: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  tick: { fontSize: 15, fontWeight: "800" },
  day: { fontSize: 16, fontWeight: "600" },
  buttons: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  save: {},
  btnText: { fontSize: 16, fontWeight: "700" },
});

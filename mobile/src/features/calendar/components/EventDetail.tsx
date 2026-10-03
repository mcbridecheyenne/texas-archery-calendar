import type { ReactNode } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addToPhoneCalendar, callHost, emailHost, openDirections, openUrl } from "../actions";
import { daysUntil, fmtRange } from "../dates";
import type { CalendarTheme } from "../theme";
import { sourceLabel, type TournamentEvent } from "../types";
import { shareShoot, shootMessage } from "../share";
import { useShareCard, type ShareCardInfo } from "./ShareCard";
import { SourcePill } from "./SourcePill";

interface Props {
  event: TournamentEvent | null;
  going: boolean;
  theme: CalendarTheme;
  onClose: () => void;
  onToggleGoing: (event: TournamentEvent) => void;
  /** Host-supplied content under the Going button (friends going, etc.). */
  extra?: (event: TournamentEvent, going: boolean, close: () => void) => ReactNode;
  sharePlug?: string;
  shareAs?: ShareCardInfo;
}

function countdown(event: TournamentEvent): string | null {
  const n = daysUntil(event.startDate);
  if (n > 1) return `In ${n} days`;
  if (n === 1) return "Tomorrow";
  if (n === 0) return "Today";
  if (daysUntil(event.endDate) >= 0) return "Happening now";
  return null;
}

export function EventDetail({ event, going, theme, onClose, onToggleGoing, extra, sharePlug, shareAs }: Props) {
  const card = useShareCard();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!event} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {event ? (
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
            <SourcePill source={event.source} theme={theme} />
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={[styles.done, { color: theme.primary }]}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={[styles.title, { color: theme.text }]}>{event.name}</Text>
            <Text style={[styles.when, { color: theme.text }]}>{fmtRange(event.startDate, event.endDate)}</Text>
            {countdown(event) ? (
              <Text style={[styles.countdown, { color: theme.primary }]}>{countdown(event)}</Text>
            ) : null}

            {event.source === "USER" ? (
              <View style={[styles.userNote, { backgroundColor: theme.source.USER.soft, borderColor: theme.source.USER.solid + "55" }]}>
                <Text style={[styles.userNoteText, { color: theme.text }]}>
                  Added by <Text style={{ fontWeight: "700" }}>{event.addedBy ?? "an archer"}</Text>. This isn't from an official
                  association schedule, so confirm the details with the host.
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => onToggleGoing(event)}
              style={({ pressed }) => [
                styles.goingBtn,
                going
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: "transparent", borderColor: theme.primary },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: going }}
            >
              <Text style={[styles.goingText, { color: going ? theme.onPrimary : theme.primary }]}>
                {going ? "★  Going" : "☆  I'm going"}
              </Text>
            </Pressable>

            {extra ? extra(event, going, onClose) : null}

            <View style={styles.actions}>
              <Action
                label="Add to Calendar"
                theme={theme}
                onPress={() =>
                  addToPhoneCalendar(event).catch(() =>
                    Alert.alert("Couldn't add it", "Something went wrong adding this to your calendar.")
                  )
                }
              />
              {event.location || event.city ? (
                <Action label="Directions" theme={theme} onPress={() => openDirections(event)} />
              ) : null}
              <Action label="Share" theme={theme} onPress={() =>
                  (going
                    ? card.shareCard([event], shareAs ?? {}, shootMessage(event, true, sharePlug))
                    : shareShoot(event, false, sharePlug)
                  ).catch(() => {})
                }
              />
            </View>

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {event.location ? <Row label="Where" value={event.location} theme={theme} /> : null}
              {event.registrationStart && event.registrationEnd ? (
                <Row
                  label="Registration"
                  value={fmtRange(event.registrationStart, event.registrationEnd)}
                  theme={theme}
                />
              ) : null}
              {event.contact ? <Row label="Contact" value={event.contact} theme={theme} /> : null}
              {event.phone ? (
                <Row label="Phone" value={event.phone} theme={theme} link onPress={() => callHost(event.phone!)} />
              ) : null}
              {event.email ? (
                <Row label="Email" value={event.email} theme={theme} link onPress={() => emailHost(event.email!, event)} />
              ) : null}
              {event.source === "USER" ? (
                event.sourceUrl ? (
                  <Row label="Website or flyer" value={event.sourceUrl} theme={theme} link onPress={() => openUrl(event.sourceUrl)} last />
                ) : (
                  <Row label="Added by" value={event.addedBy ?? "An archer"} theme={theme} last />
                )
              ) : (
                <Row
                  label="Source"
                  value={`View on the ${sourceLabel(event.source)} schedule`}
                  theme={theme}
                  link
                  onPress={() => openUrl(event.sourceUrl)}
                  last
                />
              )}
            </View>

            {event.details ? (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, paddingVertical: 12 }]}>
                <Text style={[styles.rowLabel, { color: theme.muted }]}>DETAILS</Text>
                <Text style={[styles.rowValue, { color: theme.text, marginTop: 4 }]}>{event.details}</Text>
              </View>
            ) : null}

            <Text style={[styles.note, { color: theme.muted }]}>
              Always confirm dates and details with the host club before you travel.
            </Text>
          </ScrollView>
          {card.element}
        </View>
      ) : null}
    </Modal>
  );
}

function Action({ label, onPress, theme }: { label: string; onPress: () => void; theme: CalendarTheme }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.actionText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function Row({
  label,
  value,
  theme,
  link,
  onPress,
  last,
}: {
  label: string;
  value: string;
  theme: CalendarTheme;
  link?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  const body = (
    <View style={[styles.row, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.rowLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: link ? theme.primary : theme.text }]}>{value}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="link">
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  done: { fontSize: 17, fontWeight: "600" },
  content: { padding: 18, gap: 6 },
  title: { fontSize: 26, fontWeight: "700", lineHeight: 32 },
  when: { fontSize: 17, marginTop: 4 },
  countdown: { fontSize: 14, fontWeight: "600" },
  goingBtn: { marginTop: 14, borderRadius: 12, borderWidth: 1.5, paddingVertical: 13, alignItems: "center" },
  goingText: { fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  action: { flex: 1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, alignItems: "center" },
  actionText: { fontSize: 15, fontWeight: "600" },
  card: { marginTop: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  row: { paddingVertical: 12, gap: 2 },
  rowLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4 },
  rowValue: { fontSize: 15 },
  note: { fontSize: 12, marginTop: 14, textAlign: "center" },
  userNote: { marginTop: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  userNoteText: { fontSize: 14, lineHeight: 19 },
});

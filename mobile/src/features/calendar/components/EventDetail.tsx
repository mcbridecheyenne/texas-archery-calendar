import { useState, type ReactNode } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addToPhoneCalendar, callHost, emailHost, openDirections, openUrl } from "../actions";
import { daysUntil, fmtDayLong, fmtRange } from "../dates";
import type { CalendarTheme } from "../theme";
import { listedBy, type TournamentEvent } from "../types";
import { hotelPlace, hotelPrices, hotelSearchUrl, useCityPrices, type HotelsConfig } from "../hotels";
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
  /** Shows "Hotels near the shoot" with a price range and a search link. */
  hotels?: HotelsConfig;
}

function countdown(event: TournamentEvent): string | null {
  const n = daysUntil(event.startDate);
  if (n > 1) return `In ${n} days`;
  if (n === 1) return "Tomorrow";
  if (n === 0) return "Today";
  if (daysUntil(event.endDate) >= 0) return "Happening now";
  return null;
}

export function EventDetail({ event, going, theme, onClose, onToggleGoing, extra, sharePlug, shareAs, hotels }: Props) {
  const card = useShareCard();
  const [flyerOpen, setFlyerOpen] = useState(false);
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!event} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {event ? (
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
            <SourcePill event={event} theme={theme} />
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
                  value={
                    event.source === "CLUB"
                      ? "Host club's page"
                      : event.source === "OTHER"
                      ? `Details & registration on ${listedBy(event)}` // hand-entered: facts only, details stay on their site
                      : `View on the ${listedBy(event)} schedule`
                  }
                  theme={theme}
                  link
                  onPress={() => openUrl(event.sourceUrl)}
                  last={!event.alsoListed?.length}
                />
              )}
              {event.alsoListed?.length ? (
                <Row label="Also listed by" value={[...new Set(event.alsoListed.map(listedBy))].join(", ")} theme={theme} last />
              ) : null}
            </View>

            {hotels?.enabled ? <HotelCard event={event} config={hotels} theme={theme} /> : null}

            {event.flyerUrl ? (
              <Pressable
                onPress={() => setFlyerOpen(true)}
                style={[styles.flyerCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                accessibilityRole="imagebutton"
                accessibilityLabel="Tournament flyer. Tap to view full screen."
              >
                <Text style={[styles.rowLabel, { color: theme.muted }]}>FLYER · TAP TO ENLARGE</Text>
                <Image source={{ uri: event.flyerUrl }} style={styles.flyerThumb} resizeMode="contain" />
              </Pressable>
            ) : null}

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

          {event.flyerUrl ? (
            <Modal visible={flyerOpen} animationType="fade" onRequestClose={() => setFlyerOpen(false)} supportedOrientations={["portrait", "landscape"]}>
              <View style={styles.viewer}>
                {/* Pinch to zoom on iPhone; the flyer fits the screen to start. */}
                <ScrollView
                  maximumZoomScale={5}
                  minimumZoomScale={1}
                  centerContent
                  contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <Image source={{ uri: event.flyerUrl }} style={{ width: win.width, height: win.height * 0.85 }} resizeMode="contain" />
                </ScrollView>
                <Pressable onPress={() => setFlyerOpen(false)} style={[styles.viewerClose, { top: insets.top + 12 }]} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close flyer">
                  <Text style={styles.viewerCloseText}>Done</Text>
                </Pressable>
              </View>
            </Modal>
          ) : null}
        </View>
      ) : null}
    </Modal>
  );
}

// Typical nightly prices near the shoot (an estimate) and a button that searches hotels
// for the shoot's dates. Hidden for shoots that are over or have no place.
function HotelCard({ event, config, theme }: { event: TournamentEvent; config: HotelsConfig; theme: CalendarTheme }) {
  const table = useCityPrices(config.pricesUrl);
  const url = hotelSearchUrl(event, config);
  if (!url) return null;
  const prices = hotelPrices(event, table);
  const place = hotelPlace(event);
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, paddingVertical: 12, gap: 6 }]}>
      <Text style={[styles.rowLabel, { color: theme.muted }]}>HOTELS NEAR THE SHOOT</Text>
      {prices ? (
        <>
          <Text style={[styles.hotelPrice, { color: theme.text }]}>
            ${prices.low} – ${prices.high}
            <Text style={[styles.hotelPer, { color: theme.muted }]}> a night</Text>
          </Text>
          <Text style={[styles.rowValue, { color: theme.text }]}>About ${prices.typical} a night on average</Text>
          <Text style={[styles.hotelNote, { color: theme.muted }]}>
            {prices.scope === "city"
              ? `${pricesWhen(prices)} They change with dates and go up on big shoot weekends, so book early.`
              : `Typical for ${prices.place}, not prices for this town. Prices go up on big shoot weekends, so book early.`}
          </Text>
        </>
      ) : null}
      <Pressable
        onPress={() => openUrl(url)}
        accessibilityRole="link"
        accessibilityLabel={`Find hotels near ${place ?? "the shoot"}`}
        style={({ pressed }) => [styles.hotelBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.hotelBtnText, { color: theme.onPrimary }]}>Find hotels{place ? ` near ${place}` : ""}</Text>
      </Pressable>
    </View>
  );
}

// "Hotel prices in Brownwood, TX for Fri, Nov 6 to Sun, Nov 8, checked today."
function pricesWhen(p: { place: string; checked: string; checkin?: string; checkout?: string }): string {
  const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? fmtDayLong(iso) : iso);
  const nights = p.checkin ? ` for ${day(p.checkin)}${p.checkout ? ` to ${day(p.checkout)}` : ""}` : "";
  const checked = daysUntil(p.checked) === 0 ? "today" : day(p.checked);
  return `Hotel prices in ${p.place}${nights}, checked ${checked}.`;
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
  flyerCard: { marginTop: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  flyerThumb: { width: "100%", height: 320, borderRadius: 8 },
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerClose: { position: "absolute", right: 16, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  viewerCloseText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hotelPrice: { fontSize: 22, fontWeight: "700" },
  hotelPer: { fontSize: 15, fontWeight: "400" },
  hotelNote: { fontSize: 12, lineHeight: 16 },
  hotelBtn: { marginTop: 6, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, alignItems: "center" },
  hotelBtnText: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  userNote: { marginTop: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  userNoteText: { fontSize: 14, lineHeight: 19 },
});

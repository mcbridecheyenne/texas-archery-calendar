// The "Featured" block at the top of the Upcoming list: up to three paid cards for the spot
// being looked at (a state, or All states). Each is labeled "Featured · promoted by <name>"
// so nobody mistakes it for an association's own ranking. Hidden while searching, when the
// archer turned featured shoots off, and when the shoot isn't on the calendar any more.
import { useEffect, useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { photoUrl } from "../../lib/supabase";
import { fmtRange, monthShort, parseISODate } from "../calendar/dates";
import type { CalendarTheme } from "../calendar/theme";
import type { TournamentEvent } from "../calendar";
import { countFeatured } from "./api";
import { useFeatured } from "./FeaturedProvider";
import { matchEvent, spotFor, type FeaturedShoot } from "./types";

interface Props {
  theme: CalendarTheme;
  stateFilter: string; // "ALL" or a two-letter state
  searching: boolean;
  events: TournamentEvent[]; // everything the calendar knows, to find each featured shoot
  onOpen: (event: TournamentEvent) => void;
}

const counted = new Set<string>();

export function FeaturedCards({ theme, stateFilter, searching, events, onOpen }: Props) {
  const { live, hidden, order, setHidden } = useFeatured();
  const spot = spotFor(stateFilter);

  const cards = useMemo(() => {
    if (hidden || searching) return [];
    const inSpot = order(live.filter((f) => f.spot === spot));
    const out: { feature: FeaturedShoot; event: TournamentEvent }[] = [];
    for (const feature of inSpot) {
      const event = matchEvent(feature, events);
      if (event && !out.some((o) => o.event.id === event.id)) out.push({ feature, event });
    }
    return out.slice(0, 3);
  }, [hidden, searching, order, live, spot, events]);

  // "Shown N times": once per feature per launch.
  useEffect(() => {
    const fresh = cards.map((c) => c.feature.id).filter((id) => !counted.has(id));
    fresh.forEach((id) => counted.add(id));
    countFeatured(fresh, "shown");
  }, [cards]);

  if (!cards.length) return null;

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: theme.muted }]}>FEATURED</Text>
        <Pressable onPress={() => setHidden(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Hide featured shoots">
          <Text style={[styles.hide, { color: theme.muted }]}>Hide</Text>
        </Pressable>
      </View>
      {cards.map(({ feature, event }) => {
        const d = parseISODate(event.startDate);
        const flyer = event.flyerUrl ?? (feature.eventFlyerPath ? photoUrl(feature.eventFlyerPath) : null);
        return (
          <Pressable
            key={feature.id}
            onPress={() => {
              countFeatured([feature.id], "opened");
              onOpen(event);
            }}
            style={({ pressed }) => [styles.card, { backgroundColor: theme.card, borderColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`Featured: ${event.name}, ${fmtRange(event.startDate, event.endDate)}, promoted by ${feature.buyerName}`}
          >
            <View style={[styles.badge, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Text style={[styles.badgeMonth, { color: theme.muted }]}>{monthShort(d.getMonth()).toUpperCase()}</Text>
              <Text style={[styles.badgeDay, { color: theme.text }]}>{d.getDate()}</Text>
            </View>
            <View style={styles.body}>
              <Text style={[styles.promo, { color: theme.primary }]} numberOfLines={1}>
                ★ Featured · promoted by {feature.buyerName}
              </Text>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                {event.name}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>{fmtRange(event.startDate, event.endDate)}</Text>
              {event.location || event.city ? (
                <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
                  📍 {event.location ?? [event.city, event.state].filter(Boolean).join(", ")}
                </Text>
              ) : null}
            </View>
            {flyer ? <Image source={{ uri: flyer }} style={[styles.thumb, { backgroundColor: theme.subtle }]} resizeMode="cover" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  hide: { fontSize: 12, fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  badge: { width: 52, alignItems: "center", paddingVertical: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  badgeMonth: { fontSize: 10, fontWeight: "600", letterSpacing: 0.8 },
  badgeDay: { fontSize: 22, fontWeight: "600", marginTop: 2 },
  body: { flex: 1, gap: 3 },
  promo: { fontSize: 12, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13 },
  thumb: { width: 56, height: 72, borderRadius: 8 },
});

// A picture of "who's going to which shoots" for sharing by text or social media.
// The card is drawn off-screen at 360×450 and saved at 1080×1350 (Instagram's 4:5 size),
// then handed to the phone's share sheet. It always uses the light brand colors so it
// looks the same for everyone who receives it.
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Platform, Share, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { fmtRange, monthShort, parseISODate } from "../dates";
import { sourceLabel, type EventSource, type TournamentEvent } from "../types";

const C = {
  bg: "#F7F2EA",
  card: "#FBF8F3",
  border: "#E3D9CC",
  text: "#30231A",
  muted: "#73604F",
  accent: "#BE4F17",
  onAccent: "#FBF7F1",
  dark: "#30231A",
  source: { TFAA: "#BE4F17", ASA: "#295B42", TSAA: "#275A91", CLUB: "#8A6512", USER: "#6B4C9A" } as Record<EventSource, string>,
};

const MAX_ROWS = 5;

export interface ShareCardInfo {
  /** Archer's name, e.g. "Cheyenne M."; leave empty for "I'm going to". */
  name?: string | null;
  /** Their archery class, e.g. "Known 50". */
  archeryClass?: string | null;
}

function Card({ events, info }: { events: TournamentEvent[]; info: ShareCardInfo }) {
  const shown = events.slice(0, MAX_ROWS);
  const more = events.length - shown.length;
  return (
    <View style={s.card} collapsable={false}>
      <View style={s.top}>
        <Text style={s.brand}>🏹  ARCHERY IN TEXAS</Text>
      </View>

      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>
          {info.name ? info.name : "I'm going!"}
        </Text>
        {info.archeryClass ? <Text style={s.klass}>Shoots {info.archeryClass}</Text> : null}
        <Text style={s.lead}>{info.name ? (events.length === 1 ? "is going to" : "is going to these shoots") : events.length === 1 ? "Here's my next shoot" : "Here are my next shoots"}</Text>

        <View style={s.list}>
          {shown.map((e) => {
            const d = parseISODate(e.startDate);
            return (
              <View key={e.id} style={s.row}>
                <View style={[s.date, { borderColor: C.source[e.source] }]}>
                  <Text style={[s.month, { color: C.source[e.source] }]}>{monthShort(d.getMonth()).toUpperCase()}</Text>
                  <Text style={s.day}>{d.getDate()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.event} numberOfLines={2}>
                    {e.name}
                  </Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {[e.city, e.startDate !== e.endDate ? fmtRange(e.startDate, e.endDate) : null, e.source === "USER" ? null : sourceLabel(e.source)]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </Text>
                </View>
              </View>
            );
          })}
          {more > 0 ? <Text style={s.more}>+ {more} more shoot{more > 1 ? "s" : ""}</Text> : null}
        </View>
      </View>

      <View style={s.foot}>
        <Text style={s.footTitle}>Come shoot with {info.name ? "me" : "us"}!</Text>
        <Text style={s.footSub}>Find archery shoots & see who's going — free Archery in the USA app</Text>
      </View>
    </View>
  );
}

/**
 * Renders the (hidden) card and returns a function that turns events into a picture and
 * opens the share sheet. Put `element` somewhere inside the screen that's on display.
 */
export function useShareCard(): {
  element: ReactNode;
  shareCard: (events: TournamentEvent[], info: ShareCardInfo, message: string) => Promise<void>;
} {
  const ref = useRef<View>(null);
  const [state, setState] = useState<{ events: TournamentEvent[]; info: ShareCardInfo } | null>(null);

  const shareCard = useCallback(async (events: TournamentEvent[], info: ShareCardInfo, message: string) => {
    if (!events.length) return;
    setState({ events, info });
    // Give React a moment to draw the card before taking its picture.
    await new Promise((r) => setTimeout(r, 120));
    try {
      const uri = await captureRef(ref, { format: "png", width: 1080, height: 1350, result: "tmpfile" });
      if (Platform.OS === "ios") {
        // Messages gets the picture and the text; Instagram, Facebook etc. take the picture.
        await Share.share({ url: uri, message });
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your shoots" });
      } else {
        await Share.share({ message });
      }
    } catch {
      // If the picture can't be made, still let them share the text.
      await Share.share({ message });
    } finally {
      setState(null);
    }
  }, []);

  const element = state ? (
    <View pointerEvents="none" style={s.offscreen}>
      <View ref={ref} collapsable={false}>
        <Card events={state.events} info={state.info} />
      </View>
    </View>
  ) : null;

  return { element, shareCard };
}

const s = StyleSheet.create({
  offscreen: { position: "absolute", left: -10000, top: 0, width: 360 },
  card: { width: 360, height: 450, backgroundColor: C.bg, overflow: "hidden" },
  top: { backgroundColor: C.accent, paddingVertical: 12, paddingHorizontal: 18 },
  brand: { color: C.onAccent, fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  body: { flex: 1, paddingHorizontal: 18, paddingTop: 16 },
  name: { color: C.text, fontSize: 28, fontWeight: "800" },
  klass: { color: C.accent, fontSize: 14, fontWeight: "700", marginTop: 2 },
  lead: { color: C.muted, fontSize: 15, marginTop: 4, marginBottom: 10 },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 7,
  },
  date: { width: 42, alignItems: "center", borderRadius: 7, borderWidth: 1.5, paddingVertical: 3, backgroundColor: C.bg },
  month: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  day: { color: C.text, fontSize: 18, fontWeight: "800", marginTop: -1 },
  event: { color: C.text, fontSize: 14, fontWeight: "700", lineHeight: 17 },
  meta: { color: C.muted, fontSize: 11, marginTop: 2 },
  more: { color: C.muted, fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 2 },
  foot: { backgroundColor: C.dark, paddingVertical: 12, paddingHorizontal: 18 },
  footTitle: { color: C.onAccent, fontSize: 16, fontWeight: "800" },
  footSub: { color: "#D9CBB8", fontSize: 11, marginTop: 2 },
});

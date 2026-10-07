// Ads sit inside the shoot list: a small card marked "Ad" after every few shoots, scrolling
// with the list and never covering anything. No pop-ups, no video, and
// only non-personalized ads, so the app never asks to track people across other apps.
// Hidden for ad-free subscribers and while the subscription check is still running.
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ADS } from "../../config";
import { useCalendarTheme } from "../features/calendar";
import { usePremium } from "./premium";

// Not available in Expo Go; the app just runs without ads there.
let Ads: any = null;
try {
  Ads = require("react-native-google-mobile-ads");
} catch {
  Ads = null;
}

let startup: Promise<boolean> | null = null;
function startAds(): Promise<boolean> {
  if (!startup) {
    startup = (async () => {
      try {
        // Shows Google's consent form only where the law requires it (EU/UK); a no-op in the US.
        const consent = await Ads.AdsConsent.gatherConsent().catch(() => null);
        if (consent && consent.canRequestAds === false) return false;
        await Ads.default().initialize();
        return true;
      } catch {
        return false;
      }
    })();
  }
  return startup;
}

export function useAdsVisible(): boolean {
  const { isPremium, ready } = usePremium();
  return !!Ads && ADS.enabled && ready && !isPremium;
}

// The list's side padding (CalendarScreen styles.scroll) and the card's own padding.
const LIST_PADDING = 16;
const CARD_PADDING = 8;
const MAX_AD_HEIGHT = 120;

// One ad card in the shoot list. Takes no space until an ad has actually loaded (the ad
// has no height until then), and disappears if none comes, so the list never shows an
// empty box. The ad itself is never hidden or clipped, as AdMob's rules require.
export function ListAd({ onRemoveAds }: { onRemoveAds: () => void }) {
  const theme = useCalendarTheme();
  const { width } = useWindowDimensions();
  const { available } = usePremium();
  const visible = useAdsVisible();
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  useEffect(() => {
    if (visible) startAds().then(setStarted);
  }, [visible]);

  if (!visible || !started || state === "failed") return null;

  const unitId = __DEV__
    ? Ads.TestIds.ADAPTIVE_BANNER
    : Platform.select({ ios: ADS.iosBannerId, android: ADS.androidBannerId, default: "" });
  const loaded = state === "loaded";

  return (
    <View
      style={loaded ? [styles.card, { backgroundColor: theme.card, borderColor: theme.border }] : styles.waiting}
    >
      {loaded ? (
        <View style={styles.top}>
          <Text style={[styles.label, { color: theme.muted }]}>AD</Text>
          {available ? (
            <Pressable onPress={onRemoveAds} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.remove, { color: theme.primary }]}>Remove ads</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Ads.BannerAd
        unitId={unitId}
        size={Ads.BannerAdSize.INLINE_ADAPTIVE_BANNER}
        width={Math.floor(width - LIST_PADDING * 2 - CARD_PADDING * 2)}
        maxHeight={MAX_AD_HEIGHT}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setState("loaded")}
        onAdFailedToLoad={() => setState("failed")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: CARD_PADDING,
    paddingTop: 4,
    marginBottom: 8,
  },
  waiting: { alignItems: "center", paddingHorizontal: CARD_PADDING },
  top: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", paddingBottom: 4 },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  remove: { fontSize: 11, fontWeight: "600" },
});

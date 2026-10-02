// One small banner pinned under the calendar. No pop-ups, no video, and only
// non-personalized ads, so the app never asks to track people across other apps.
// Hidden for ad-free subscribers and while the subscription check is still running.
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

export function AdBanner({ onRemoveAds }: { onRemoveAds: () => void }) {
  const theme = useCalendarTheme();
  const insets = useSafeAreaInsets();
  const { available } = usePremium();
  const visible = useAdsVisible();
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (visible) startAds().then(setStarted);
  }, [visible]);

  if (!visible) return null;

  const unitId = __DEV__
    ? Ads.TestIds.ADAPTIVE_BANNER
    : Platform.select({ ios: ADS.iosBannerId, android: ADS.androidBannerId, default: "" });

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom },
      ]}
    >
      {loaded && available ? (
        <Pressable onPress={onRemoveAds} hitSlop={8} style={styles.removeRow} accessibilityRole="button">
          <Text style={[styles.remove, { color: theme.muted }]}>
            Ad · <Text style={{ color: theme.primary, fontWeight: "600" }}>Remove ads</Text>
          </Text>
        </Pressable>
      ) : null}
      {started ? (
        <Ads.BannerAd
          unitId={unitId}
          size={Ads.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => setLoaded(true)}
          onAdFailedToLoad={() => setLoaded(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth },
  removeRow: { alignSelf: "stretch", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 3, paddingBottom: 2 },
  remove: { fontSize: 11 },
});

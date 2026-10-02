// Where the app reads the schedule. GitHub Actions re-collects TFAA, Texas ASA and TSAA
// events every 3 hours and publishes them here, next to the website, so the app,
// Android app and website always show the same schedule.
export const API_BASE_URL = "https://mcbridecheyenne.github.io/texas-archery-calendar";

// Public pages linked from the subscription screen (Apple requires both).
export const PRIVACY_URL = `${API_BASE_URL}/privacy.html`;
export const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

// ---- Ads (Google AdMob) ----
// These are Google's TEST ids: they show sample ads and earn nothing.
// Replace them with your own from admob.google.com before the App Store release
// (the app ids go in app.json too, under the react-native-google-mobile-ads plugin).
export const ADS = {
  enabled: true,
  iosBannerId: "ca-app-pub-3940256099942544/2435281174",
  androidBannerId: "ca-app-pub-3940256099942544/9214589741",
};

// ---- Ad-free subscription (RevenueCat) ----
// Public SDK keys from app.revenuecat.com → Project → API keys. Leave blank to hide
// the "Remove ads" option until the subscription is set up.
export const PURCHASES = {
  iosApiKey: "",
  androidApiKey: "",
  entitlement: "ad_free", // the entitlement id you create in RevenueCat
};

// Where the app reads the schedule. GitHub Actions re-collects TFAA, Texas ASA and TSAA
// events every 3 hours and publishes them here, next to the website, so the app,
// Android app and website always show the same schedule.
export const API_BASE_URL = "https://mcbridecheyenne.github.io/texas-archery-calendar";

// ---- Marketplace (Supabase) ----
// From supabase.com → your project → Project Settings → API: the Project URL and the
// "anon public" key. Both are safe to ship in the app; the database rules in
// supabase/schema.sql decide what each person can do. Leave blank to show
// "Marketplace coming soon" instead.
export const SUPABASE = {
  url: "https://mefqiniuudxcnoimfipo.supabase.co",
  anonKey: "sb_publishable_GWYdb3dSEHy4jvrkkJJEww_FD6nOt3B",
};

// Public pages linked from the subscription screen (Apple requires both).
export const PRIVACY_URL = `${API_BASE_URL}/privacy.html`;
export const RULES_URL = `${API_BASE_URL}/marketplace-rules.html`;

// Link added to shared shoots ("Get the Archery in Texas app"). It's a page on the website
// that sends people to the App Store or Google Play, so it can be updated after launch
// without an app update (edit client/public/app.html).
export const APP_DOWNLOAD_URL = `${API_BASE_URL}/app.html`;
export const SHARE_PLUG = `📲 Find Texas archery shoots and see who's going with the free Archery in Texas app: ${APP_DOWNLOAD_URL}`;
export const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

// ---- Ads (Google AdMob) ----
// Your AdMob ids (admob.google.com). The app ids are in app.json under the
// react-native-google-mobile-ads plugin. Don't tap your own ads; add your phone as a
// test device in AdMob → Settings → Test devices instead.
export const ADS = {
  enabled: true,
  iosBannerId: "ca-app-pub-7930621070150782/8333303000", // Archery in Texas (iOS) · Bottom banner
  androidBannerId: "ca-app-pub-7930621070150782/6158655092", // Archery in Texas (Android) · Bottom banner
};

// ---- Ad-free subscription (RevenueCat) ----
// Public SDK keys from app.revenuecat.com → Project → API keys. Leave blank to hide
// the "Remove ads" option until the subscription is set up.
export const PURCHASES = {
  iosApiKey: "appl_ckvTHhsHxFRTCRfnbnVsRfukCgl",
  androidApiKey: "",
  entitlement: "ad_free", // the entitlement id you create in RevenueCat
  // "Support the app" tips: consumable in-app purchases with these product ids, created in
  // App Store Connect and Google Play and added to RevenueCat. Hidden until they exist.
  tipProductIds: ["tip_small", "tip_medium", "tip_large"],
};

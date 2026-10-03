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
  // "Support the app" tips: consumable in-app purchases with these product ids, created in
  // App Store Connect and Google Play and added to RevenueCat. Hidden until they exist.
  tipProductIds: ["tip_small", "tip_medium", "tip_large"],
};

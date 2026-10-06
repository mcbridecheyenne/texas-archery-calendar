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
// Email sign-in sends a 6-digit code. It needs your own email sender connected in
// Supabase (Authentication → Emails → SMTP) so the email can include the code.
// Until then it's hidden; iPhone users sign in with Apple.
export const EMAIL_SIGN_IN_ENABLED = false;

export const PRIVACY_URL = `${API_BASE_URL}/privacy.html`;
export const RULES_URL = `${API_BASE_URL}/marketplace-rules.html`;

// Link added to shared shoots ("Get the Archery in the USA app"). It's a page on the website
// that sends people to the App Store or Google Play, so it can be updated after launch
// without an app update (edit client/public/app.html).
export const APP_DOWNLOAD_URL = `${API_BASE_URL}/app.html`;
export const SHARE_PLUG = `📲 Find archery shoots and see who's going with the free Archery in the USA app: ${APP_DOWNLOAD_URL}`;
export const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

// ---- Ads (Google AdMob) ----
// Your AdMob ids (admob.google.com). The app ids are in app.json under the
// react-native-google-mobile-ads plugin. Don't tap your own ads; add your phone as a
// test device in AdMob → Settings → Test devices instead.
export const ADS = {
  enabled: true,
  iosBannerId: "ca-app-pub-7930621070150782/8333303000", // AdMob unit "Archery in Texas (iOS) · Bottom banner"
  androidBannerId: "ca-app-pub-7930621070150782/6158655092", // AdMob unit "Archery in Texas (Android) · Bottom banner"
};

// ---- Hotels near each shoot (Stay22 affiliate link) ----
// Each shoot's details show nightly hotel prices for the shoot's town (from
// hotel-prices.json on the website; a state-wide estimate for towns not in it) and a
// "Find hotels" button. Stay22 (stay22.com) pays a commission when someone books a stay
// from that button. Sign up free at stay22.com, then paste your affiliate id ("aid",
// shown in the Stay22 dashboard under Links) below. While it's blank the button opens a
// plain Booking.com search, which works but earns nothing.
export const HOTELS = {
  enabled: true,
  stay22Aid: "archeryintheusa", // Cheyenne's Stay22 affiliate id
  campaign: "app", // shows app clicks separately from the website in Stay22's reports
  pricesUrl: `${API_BASE_URL}/hotel-prices.json`, // edit client/public/hotel-prices.json on main
};

// ---- Texas Field Archery Scholarship Fund ----
// A "Donate" button (opens the fund's own page in the browser; never an in-app purchase)
// and the line "10% of the app's net proceeds ... is donated". Both only show to archers
// whose home state is Texas and whose phone is in Texas right now (see
// src/monetization/ScholarshipNote.tsx), and must stay out of the store listing.
// TODO(Cheyenne): turn on once the fund has OK'd using its name in writing (brief Q2).
// TODO(Cheyenne): paste the fund's donation page below (brief Q1). Until then the button is hidden.
export const SCHOLARSHIP = {
  enabled: false,
  donateUrl: "", // PLACEHOLDER: the fund's donation page, e.g. "https://…"
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

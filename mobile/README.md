# Archery in the USA (formerly Archery in Texas) — iPhone & Android app

One React Native (Expo) app for archers across the US that builds for both iPhone and Android. It is the same App Store and Google Play listing as Archery in Texas, upgraded in place.
It grows one tab at a time:

| Tab | What it does | Data |
|---|---|---|
| Tournaments | Nationwide calendar filtered by state (starts on your home state) and organization, tournaments added by archers, Going list, reminders, which friends are going | `events.json` on GitHub Pages + Supabase |
| Marketplace | Buy and sell used gear, hand off at a shoot | Supabase |
| Messages | Chat between buyers and sellers | Supabase |
| Account | Profile (with archery class), friends, my listings, ad-free, delete account | Supabase |

To add a feature later (scores, clubs, results…), add a folder under `src/features/`
and a file under `app/(tabs)/`, then list it in `app/(tabs)/_layout.tsx`.

## Where the schedule comes from

GitHub Actions (`.github/workflows/pages.yml`) collects TFAA, Texas ASA and TSAA events
every 3 hours and publishes `events.json` next to the website on GitHub Pages:
https://mcbridecheyenne.github.io/texas-archery-calendar/events.json

The website and the app both read that file, so new tournaments show up without an app
update, and a fix for a changed association website goes into `api/_scrapers.ts`, not the app.
If one association's site is down, its events from the last good run are kept.

GitHub pauses scheduled workflows on repos with no activity for 60 days and emails you
first. Re-enable it from the repo's **Actions** tab, or just push any change.

## What the app adds over the website

- **Going list (★):** mark the shoots you plan to attend. Saved on the phone.
- **Reminders:** a notification at 6 PM the evening before a starred shoot, and
  at 9 AM the day registration closes (when the host lists a closing date).
- **Add to Calendar:** puts the event into Apple/Google Calendar as an all-day event.
- **Directions, call and email the host:** tap the event's location, phone or email.
- **Works offline:** the last schedule it loaded stays on the phone for ranges with no signal.
- Month calendar and an Upcoming list, filtered by state (your home state first) and organization, in light and dark mode. Reads `events-usa.json` and falls back to `events.json` until the nationwide feed is published.

## Layout

```
mobile/
  app/                       screens (Expo Router: one file per screen)
    (tabs)/                  the four tabs
    listing/ chat/ …         screens that slide over the tabs
  config.ts                  all the ids and keys you fill in
  src/features/calendar/     tournament calendar (self-contained, no ads or accounts)
  src/features/marketplace/  listings, photos, chat, reports, content filter
  src/lib/                   Supabase connection and sign-in
  src/monetization/          banner ad and ad-free subscription
  src/ui/                    shared buttons, fields, menus
  supabase/schema.sql        the marketplace database, run once in Supabase
```

## First-time setup (on your Mac)

1. Install Node.js LTS from https://nodejs.org if `node -v` in Terminal doesn't print a version.
2. In Terminal:
   ```bash
   cd path/to/texas-archery-calendar/mobile
   npm install
   npm run upgrade-sdk      # moves to the newest Expo version and lines up every library with it
   ```

## Try it on your iPhone right away

```bash
npx expo start
```
Install **Expo Go** from the App Store and scan the QR code that appears in Terminal.
The calendar and marketplace work in Expo Go. Ads, subscriptions and Sign in with Apple
only work in a real build (TestFlight); email sign-in works in both.

## Friends, shared Going and tournaments added by archers

- **Friends:** every profile gets a 6-character friend code (Account → Friends). Share it with
  **Share invite**, which sends a link to `friend.html` on the website that opens the app's Add Friend screen.
  Requests must be accepted, and blocking someone ends the friendship.
- **Shared Going:** when a signed-in archer marks a tournament Going, the app asks who can see it:
  *My friends*, *Everyone in the app*, or *Just me* (stays on the phone). Tap **Change** in the
  tournament's details to switch. Friends going show on the tournament's row and details, with their archery class.
- **Added by archers:** **＋ Add a tournament** on the Tournaments tab. These have their own purple
  "Added by archer" label and filter, show who added them, and warn before saving if the tournament
  looks like one already listed. The person who added one can edit or delete it; anyone can report it.
  To hide one, set its `status` to `removed` in Table Editor → `community_events`.

## Turn on the marketplace (Supabase)

Until `SUPABASE` in `config.ts` is filled in, the Marketplace tab says "coming soon", the
friends and add-a-tournament features stay hidden, and the schedule still works.

1. **Create the project:** at supabase.com, make a free project (region: Central US).
2. **Create the database:** SQL Editor → New query → paste all of `supabase/schema.sql` → Run.
   This makes the tables, the photo bucket, and the security rules (people can only edit
   their own listings, read their own chats, and so on). It's safe to run again after updates.
3. **Email sign-in codes:** Authentication → Emails → Templates. In both **Magic Link** and
   **Confirm signup**, replace the body with something like:
   `Your Archery in the USA code is {{ .Token }}`
   Then Authentication → Emails → SMTP Settings: connect a free sender (for example Resend).
   Supabase's built-in email only sends a few messages an hour, which is fine for testing but not for launch.
4. **Sign in with Apple:** Authentication → Sign In / Providers → Apple → turn on, and add
   `com.cheyennemcbride.archeryintexas` under Client IDs. (Native sign-in doesn't need the
   secret key; that's only for websites.)
5. **Connect the app:** Project Settings → API. Copy the Project URL and the `anon` public key
   into `config.ts` under `SUPABASE`.

### Moderating

- **Reports** land in Table Editor → `reports`. Review them within 24 hours (Apple expects this).
- **Remove a listing:** in `listings`, set its `status` to `removed`. The seller can't undo it.
- **Ban someone:** in `profiles`, set `is_banned` to true. Their listings disappear and they
  can't post or message. They can't change it back themselves.
- **Filtered words:** `src/features/marketplace/moderation.ts` blocks profanity and
  non-archery items like firearms. Add words there as needed.

### Limits on the free plan

The free Supabase plan includes 500 MB of database and 1 GB of photos. Photos are shrunk to
about 300 KB before upload, so 1 GB holds roughly 3,000 photos (around 800 listings).
Supabase pauses free projects after a week with no activity, so upgrade ($25/month) once real
people are using it.

### Not in this version yet

- Push notifications for new messages (the Messages tab shows unread counts while the app is open).
- In-app payments; buyers and sellers settle up themselves.

## TestFlight / App Store (iPhone)

iPhone builds run on the Mac mini with Xcode, not in Expo's cloud. Xcode signs with the
Apple ID under Xcode → Settings → Accounts. Use the separate `~/studio/archery-release`
clone so other work in the main folder can't break a build:

```bash
cd ~/studio/archery-release && git pull && cd mobile
npm run ios:build         # makes build/ios/ArcheryintheUSA.ipa (about 2 minutes)
npm run ios:upload        # same, then uploads it to App Store Connect → TestFlight
```
Bundle ID: `com.cheyennemcbride.archeryintexas`.

## Updating the app without the App Store

Design changes and bug fixes in the app's code can go straight to phones:

```bash
eas update:configure      # one time, after eas init
npm run publish-update    # sends the current code to every installed copy
```
Phones pick it up the next time the app opens. Changes that add a new permission or a
new native library still need a new build through the App Store / Google Play.

## Ads and the ad-free subscription

The free version shows one small banner at the bottom of the screen: no pop-ups or
video, and non-personalized ads only, so there's no "allow tracking" prompt.
Subscribers ($0.99/month or $9.99/year) don't see it. The code is in `src/monetization/`,
outside the feature folders.

Until you fill in your own ids, the app shows Google's **test** ads and the
"Go ad-free" option stays hidden.

**AdMob (ads)**
1. At admob.google.com, add two apps (iOS and Android) and a **Banner** ad unit for each.
2. Put the app ids (`ca-app-pub-…~…`) in `app.json` under `react-native-google-mobile-ads`,
   and the banner ids (`ca-app-pub-…/…`) in `config.ts` under `ADS`.

**Subscriptions**
1. App Store Connect → Agreements, Tax, and Banking: accept the **Paid Apps** agreement and add banking/tax info.
2. App Store Connect → your app → Subscriptions: create a group "Ad-free" with two
   auto-renewable subscriptions: `adfree_monthly` ($0.99, 1 month) and `adfree_yearly` ($9.99, 1 year).
3. Google Play Console → Monetize → Subscriptions: create the same two.
4. At app.revenuecat.com: create a project, add the iOS and Android apps, add both products,
   create an entitlement `ad_free` that includes them, and an offering with a **Monthly** and an **Annual** package.
5. Copy the public SDK keys into `config.ts` under `PURCHASES`.

Store fees: Apple and Google keep 15% under their small-business programs, so you
net about $0.84 a month or $8.49 a year per subscriber, before taxes.

**Privacy:** the policy is at https://mcbridecheyenne.github.io/texas-archery-calendar/privacy.html.
Use that link in App Store Connect and Google Play. On Apple's privacy questionnaire, answer for
Google AdMob's data collection (device ID, coarse location, usage and diagnostics, used for
advertising, not for tracking), plus marketplace data: email (account), name, photos and
messages (user content), and user ID, all linked to the person and used for app functionality.

**App Review notes:** tell Apple that browsing needs no account and that reviewers can sign in
with Sign in with Apple. Point out Report and Block (the ••• button on listings and chats), the
marketplace rules agreement during setup, and Account → Delete account.

## Google Play (Android)

```bash
eas build -p android      # makes the .aab file for Google Play
eas submit -p android
```
Needs a Google Play developer account ($25 one-time).

## Archery in the USA update: before shipping

- **Supabase:** re-run `supabase/schema.sql` (adds `home_state` and `age_confirmed_at` to profiles). Safe to re-run.
- **Store age rating:** set 13+ in App Store Connect and the Google Play content rating questionnaire.
  The app asks for birth month and year at sign-up and doesn't create accounts for anyone under 13.
- **Store listing:** rename to Archery in the USA. Keep the 10% scholarship line out of the listing and screenshots.
- **Scholarship fund:** `SCHOLARSHIP` in `config.ts` stays off until the fund OKs using its name in writing and
  you paste its donation page URL. It only shows to archers whose home state is Texas and whose phone is in Texas.

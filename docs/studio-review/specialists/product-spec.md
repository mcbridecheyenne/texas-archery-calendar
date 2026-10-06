# Product-spec review: Archery in the USA

Checkouts: mobile-app = /home/user/apps/archery-in-the-usa (c53d4ab), main = /home/user/apps/archery-in-the-usa-main (9db56c5). `npx tsc --noEmit` in mobile/ passes (exit 0).

## 1. Findings

| Rating | Area | What's wrong | Evidence | Fix | Size |
|---|---|---|---|---|---|
| SHOULD FIX | Nationwide browse | "Nationwide" is thin outside Texas. Besides the 3 Texas groups, the feed has World Archery, the ASA Pro/Am tour, 7 state/club feeds in 6 states (PA, SD, NM, NH, NC, AZ) and **one** hand-entered event (Lancaster Classic). The code comment says S3DA championships go in the hand-entered list, but none are there. Most states will open on "Nothing listed in X yet". A store listing that says "every state" would oversell this. | main:data/manual-events.json (1 row); main:api/_national.ts:351-361; main:api/_states.ts (6 states); App Store Guideline 2.3 (accurate metadata), Google Play "Misleading claims" | Before the nationwide launch, hand-enter the national and state championships for the major groups (facts + link only; no USA Archery scraping, no ASA text or logos). Word the store listing as "growing every week" until the list is real. | medium (ongoing) |
| SHOULD FIX | Organizer listing / emailed shoots | There's no way for organizers to get listed. The app has no "list your shoot" or email link. The support page only says to email if a shoot is wrong. The website's "Submit a shoot" link is in PR #3, which is on hold. On main, emailed shoots can only go into manual-events.json, where they show as "National" with no flyer, contact or details. The app's "Club shoots" label (CLUB) has no data behind it on main. | mobile-app: grep finds no submit or organizer link in app/ or src/; main:client/public/support.html:33-34; mobile-app:mobile/src/features/calendar/types.ts:7,67-68; main: no producer of source CLUB; PR #3 (shoot-submissions) still open | In the app only: add an "Organizers: get your shoot listed" row on the Account tab and in the empty states. It opens a pre-filled email asking for the name, dates, town, link and flyer. Decide how emailed shoots outside Texas are labeled ("Club shoots", not "National"). Leave website PR #3 waiting as required. | small |
| SHOULD FIX | Android | Android users can't sign in: Apple sign-in is iPhone-only and email codes are off. So "+ Add a tournament", Friends, Sell gear and Messages all end at "Sign-in on this phone is coming soon". There's also no RevenueCat Android key, so Android has ads but no ad-free option and no tips. That breaks the "same purchases on both stores" promise. | mobile-app:mobile/config.ts (EMAIL_SIGN_IN_ENABLED=false; PURCHASES.androidApiKey ""); mobile-app:mobile/app/sign-in.tsx:101-105; mobile-app:mobile/src/monetization/premium.tsx:16,70 | Before the Android release: connect SMTP and turn on email codes, add the Android RevenueCat key, and create the Play products. Until then, hide "Add a tournament" and the Messages tab on Android. | medium |
| SHOULD FIX | First launch / home state | Anyone who taps Cancel on "Where do you shoot?" is quietly set to Texas on the next launch, because the "old Texas user" check only looks for a saved schedule, and every new install saves one. People who aren't signed in also have no way to change their home state later. | mobile-app:mobile/src/lib/homeState.tsx:32-37; mobile-app:mobile/src/features/calendar/api.ts:106; mobile-app:mobile/app/(tabs)/index.tsx:26-27,76-81 (the skip isn't saved); only setup-profile.tsx:78 can change it | Use a version marker for the Texas carry-over, not "has cached events". Save the skip. Add a "Home state" row on the Account tab. | small |
| SHOULD FIX | Copy (nationwide) | The add-a-tournament form still says shoots "aren't from the TFAA, Texas ASA or TSAA schedules" and "Shoots outside Texas go under **Out of state**", but that chip no longer exists. The state field defaults to TX. | mobile-app:mobile/src/features/community/TournamentForm.tsx:66,156-161; mobile-app:mobile/app/tournament/new.tsx:1 | Change it to: "Shows under Added by archers with your name, so people know it isn't from an official schedule." Default the state to blank or the home state. | small |
| SHOULD FIX | Hotel price box | Prices are stored once per town, for that town's **next** shoot. Any later shoot in the same town shows the earlier shoot's price range. The fallback price file has no nights at all, so the card can't say which dates the prices are for. The owner asked for the shoot's own dates. | mobile-app:mobile/src/features/calendar/hotels.ts:43-46,64-73; mobile-app:.../components/EventDetail.tsx:207-246; main:script/hotel-towns.mjs:1-2; main:client/public/hotel-prices.json (64 towns, no checkin/checkout) | Show the price range only when the priced nights overlap this shoot. Otherwise show just "Find hotels". Later, price by town + dates. Stays town-level, with no state averages. | small |
| NICE TO HAVE | Scholarship pledge placement | This is gated on purpose (enabled=false, no donation link yet), which is correct. But once it's turned on, the Account tab shows the 10% line only inside the Tips card, and that card is hidden until the tip products load from the store. So the pledge depends on tips existing. | mobile-app:mobile/app/(tabs)/account.tsx:165-195; mobile-app:mobile/src/monetization/ScholarshipNote.tsx:286-302; open PR #8 | Once TFAA approves in writing: show ScholarshipNote on the Account tab outside the Tips card too. Keep the Texas gate, the external link and the 10% wording as they are. | small |
| NICE TO HAVE | Restore purchases | The only "Restore purchase" button is on the Go ad-free screen. That screen's row on the Account tab is hidden whenever the store offerings fail to load, so a subscriber on a new phone may find no way to restore. | mobile-app:mobile/app/(tabs)/account.tsx:199-206; mobile-app:mobile/src/monetization/premium.tsx:157; App Store Guideline 3.1.1 (restore mechanism) | Always show a "Restore purchases" row on the Account tab when purchases are set up. | small |
| NICE TO HAVE | Tabs that don't earn their place | Marketplace and Messages take 2 of the 4 tabs. Messages only serves the marketplace. The owner's core promise is shoots + travel. | mobile-app:mobile/app/(tabs)/_layout.tsx:46-63; mobile-app:mobile/app/(tabs)/inbox.tsx:29 | Fold Messages into the Marketplace tab (keep the unread badge). Use the freed slot for "My Shoots", or leave it empty. | medium |
| NICE TO HAVE | Website | The home page links to the 3 Texas groups only. It has no link to the app download page, support or privacy, though the header says "every state in the app". | main:client/src/pages/home.tsx:101-103 (no hrefs except 3 Texas groups + source links) | Add "Get the app · Support · Privacy" footer links when PR #3 ships (don't jump the PR #3 hold). | small |

## 2. Could not check
- Live feeds and hotel prices (events-usa.json, events.json, hotel-prices.json on github.io): the proxy blocked them (CONNECT 403). So I can't say how many states actually have shoots today, or whether live hotel prices include nights.
- The hotel-data branch output (live daily prices).
- App Store Connect, Google Play and RevenueCat: whether the tip and subscription products exist, so whether the Tips card and Go ad-free actually show.
- Any device run: no simulator or phone. Flows were read from code only.
- The Stay22 link landing page and whether the affiliate id is credited.
- What the iPhone build 14 binary contains compared with this commit.

## 3. Current features (as built)
Phone app (mobile-app checkout, mobile/):
- **Tournament browse.** Upcoming / Calendar month grid / My Shoots tabs; state picker with counts, "All states" and Near me (25-250 mi); search across every state; organization chips; empty state shows neighboring states plus national championships. Files: src/features/calendar/CalendarScreen.tsx, components/MonthGrid.tsx, components/StatePicker.tsx, browse.ts, distances.ts.
- **Data.** Reads events-usa.json, falling back to events.json. Merges duplicates, works offline from a cached copy, shows a "source didn't update" note. Files: src/features/calendar/api.ts, useEvents.ts.
- **First-launch home state** ("Where do you shoot?"). Files: app/(tabs)/index.tsx:76, src/lib/homeState.tsx.
- **Shoot details.** Dates, countdown, where, registration, contact/phone/email, a link back to the organizer ("View on the X schedule" / "Details & registration on X"), "Also listed by", flyer with zoom, Add to Calendar, Directions, Share. Files: src/features/calendar/components/EventDetail.tsx, actions.ts, share.ts.
- **Hotels near the shoot.** Town price range + average + "which nights, checked when", and a "Find hotels near <town>" Stay22 link (aid archeryintheusa, campaign app). Files: src/features/calendar/hotels.ts; EventDetail.tsx:207; config.ts HOTELS.
- **Going / My Shoots.** Star, local reminders, follows a shoot that moves, share-card picture, rating prompt after the 3rd star. Files: useGoing.ts, goingStore.ts, reminders.ts, components/ShareCard.tsx, review.ts.
- **Accounts.** Sign in with Apple (email code built but off), profile with class / town / home state, 13+ check, delete account. Files: app/sign-in.tsx, app/setup-profile.tsx, src/lib/auth.tsx.
- **Friends.** Friend codes, requests, "X is going", who-can-see choice per shoot. Files: app/friends.tsx, src/features/friends/*.
- **Archer-added tournaments.** Form with flyer photo, duplicate check, word filter, edit/delete by the person who added it, report for everyone else. Files: app/tournament/*, src/features/community/*.
- **Marketplace + Messages.** Listings with photos, 60-day expiry and renew reminder, chat, report/block, push notifications. Files: app/(tabs)/market.tsx, app/listing/*, app/chat/[id].tsx, app/(tabs)/inbox.tsx, src/features/marketplace/*, src/lib/push.ts.
- **Ads.** One AdMob banner above the tab bar, non-personalized, with a "Remove ads" link. Files: src/monetization/AdBanner.tsx; app/(tabs)/_layout.tsx:26.
- **Ad-free subscription** (RevenueCat; monthly/yearly; restore; terms and privacy). Files: src/monetization/PremiumSheet.tsx, premium.tsx. iOS only for now.
- **Tips** (tip_small/medium/large consumables, Account tab). Files: app/(tabs)/account.tsx:165. Hidden until the store products load.
- **Scholarship.** External "Donate" link + the 10% line. Files: src/monetization/ScholarshipNote.tsx. Currently OFF (config.ts SCHOLARSHIP.enabled=false, donateUrl ""); when on, Texas home + phone in Texas only.

Website (main checkout):
- Texas-only calendar and list (TFAA, Texas ASA, TSAA) with Refresh and per-source status. Files: client/src/pages/home.tsx, components/CalendarMonth.tsx, UpcomingList.tsx.
- Static pages: app.html (App Store link; no Play link yet), support.html, privacy.html, marketplace-rules.html, friend.html (client/public/).
- Jobs: events collected every 3 hours into events.json + events-usa.json (.github/workflows/pages.yml; script/collect-events.ts, collect-usa-events.ts; api/_national.ts, api/_states.ts; data/manual-events.json). Daily hotel towns → hotel prices (.github/workflows/hotel-towns.yml; script/hotel-towns.mjs, hotel-prices.mjs).

## Described-feature check
| Owner described | Status |
|---|---|
| Nationwide browse | Built (state/Near me/search), but thin data outside Texas (finding 1) |
| Details + organizer link | Built (EventDetail.tsx:132-146). Archer-added shoots link only if the archer gave a URL |
| Hotel price box + Find hotels (Stay22) | Built; prices are for the town's next shoot, not this shoot's dates (finding 6) |
| Tips | Built; depends on the store products existing (can't verify) |
| Ad-free | Built on iPhone; missing on Android (finding 3) |
| Scholarship donation link + 10% pledge | Built, switched off as intended; the fund has no link yet |
| Submitting shoots (in app) | Built for signed-in iPhone users only (finding 3) |
| Emailed submissions | No working path on main; the website part is in held PR #3; the app's "Club shoots" label has no data (finding 2) |
| Organizer listing path | Missing in the app and on the website on main (finding 2) |

# Archery in the USA: studio review

2026-10-06 · Owner: Cheyenne McBride (Mr. McBride) · Repo: mcbridecheyenne/texas-archery-calendar · Commits reviewed: phone app `mobile-app` @ c53d4ab, website and collectors `main` @ 9db56c5

Seven specialist reviews (product-spec, solution-architect, mobile-engineer, backend-engineer, code-review, test-automation, build-and-signing) ran on read-only checkouts. Their full reports are in `clients/archery-in-the-usa/specialists/`. Store readiness and growth (sections 8 and 9) were reviewed by the coordinator. Nothing in the repo was changed, pushed, built for a store or submitted.

**Limits of this review:** no phone or simulator was available, so nothing was tapped through on a device. The proxy blocked the organizer sites, the live GitHub Pages feeds and the store consoles. After the owner approved Decision 7, a read-only check of the live Supabase database confirmed findings 1 and 2 and added finding 35. The Mac mini build with hotel prices and iPhone build 14 were not inspected directly; this review covers what is on GitHub.

## Summary for the owner

The app is close, but it is not ready to publish nationwide yet. The good news: the code is clean, the type checks pass, both store builds can be made on the Mac mini today, and Expo/React Native is the right choice, so no rewrite is needed. The biggest problem is two holes in the database rules. A user could make themselves "friends" with any other user and see which shoots that person plans to attend. Anyone, even signed out, can read every user's friend code and home state. Both are small fixes. Three more things must be fixed before the stores see the app: the next build needs a new version number so it doesn't share updates with build 14, the privacy policy says one thing the app doesn't do, and Google Play needs a web page where people can ask to delete their account. Android is also behind iPhone: Android users can't sign in, can't buy ad-free or tip, and get no notifications. We recommend fixing the security holes first, shipping iPhone nationwide next, and releasing Android once its sign-in and purchases match iPhone. The other gap is content: outside Texas the calendar is thin, so we recommend hand-entering national and state championships before the nationwide launch and adding an easy "get your shoot listed" button for organizers.

## Ready to publish?

**Not yet.**
- Two database rules let users see other users' private data (findings 1 and 2).
- The next build shares version 1.1.0 with build 14, so one over-the-air update could crash older phones (finding 3).
- The privacy policy says private shoots stay on the phone, but the app uploads them (finding 4).
- Google Play requires a web link to request account deletion, and there isn't one (finding 5).
- Android is missing sign-in, purchases and push notifications (findings 9 and 10).
- Outside Texas most states show "Nothing listed yet" (finding 11).

## Findings

Paths: `app:` = branch mobile-app (phone app in `mobile/`), `main:` = branch main (website and collectors).

| # | Rating | Area | What's wrong | Evidence | Fix | Size |
|---|---|---|---|---|---|---|
| 1 | BLOCKER | Security | The friend-request accept rule doesn't stop someone from changing who sent the request. Using a second account, a user can turn a request into an accepted friendship with anyone and then see that person's friends-only Going list (where and when they'll be). | app:mobile/supabase/schema.sql:378-381. **Confirmed on the live database 2026-10-06:** policy "accept friend requests" checks only addressee_id and status, and signed-in users can update all 5 columns | Allow updates to the `status` column only, or add a trigger that locks both user ids | small |
| 2 | BLOCKER | Security / privacy | Every profile can be read with the public key, even signed out: friend code, home state, ban flag. With the codes, anyone can friend-request people who turned "find me by name" off, and each request sends a push with the sender's name. Names are checked for profanity only on the phone. | app:mobile/supabase/schema.sql:19-21, 399-442, 892-908. **Confirmed on the live database 2026-10-06:** policy "profiles are public" is `true` for all roles, and the signed-out role can read all 11 columns | Expose only public columns; return your own friend code from a function; check names on the server | small |
| 3 | BLOCKER | Releases | The new Mac mini build and build 14 are both version 1.1.0, and over-the-air updates are matched by version. The new build adds native code (expo-store-review, RevenueCat 9→10). One `npm run publish-update` would send build 14 phones code they can't run. | app:mobile/app.json:5, 64-66; `git diff 5111ecc HEAD -- mobile/package.json`; app:mobile/package.json:12 | Remove over-the-air updates (owner chose this, Decision 1); then beta builds can stay on 1.1.0 and the version changes only for the store release | small |
| 4 | BLOCKER | Store / privacy | The privacy policy says "Just me" shoots stay on the phone, but the app uploads every starred shoot to the account. Apple 5.1.1 and Google's User Data policy require an accurate policy. | app:mobile/src/features/friends/api.ts:92-103 vs main:client/public/privacy.html:29 | Correct the policy wording (or keep "Just me" shoots local) | small |
| 5 | BLOCKER (Google Play) | Store | Play requires a web link where users can request account deletion without the app. The privacy and support pages only describe deleting from inside the app. | main:client/public/privacy.html:46, support.html:37; Google Play User Data policy, "Account deletion" | Add a "Delete my account" web page or email form and put its URL in the Data safety form | small |
| 6 | SHOULD FIX | Store / safety | Reports of tournaments, listings and messages don't alert anyone. Apple 1.2 expects user-generated content reports to be acted on within 24 hours. A banned user can delete the account and sign up again with Apple. | backend report; app:mobile/supabase/schema.sql (reports table) | Email the owner on each new report; keep a ban list keyed to the Apple user id | small |
| 7 | SHOULD FIX | Store / accounts | Deleting an account ignores photo-delete errors (photos can stay public), and the Sign in with Apple token isn't revoked as Apple asks of apps with Apple sign-in. | app:mobile/src/lib/auth.tsx:179-192; Apple 5.1.1(v) | Delete photos on the server; call Apple's token revoke on deletion | medium |
| 8 | SHOULD FIX | Releases / rules | The old cloud-build workflow ("App build") is still enabled on GitHub and still exists on 5 old branches. Pushing any of them to `app-release` would start an Expo cloud build, which the owner forbids. The README and eas.json still describe cloud builds. | `gh workflow list` → App build active; branches claude/push, claude/browse, claude/expiry, claude/going, usa-filters-home-state; app:mobile/README.md:218-223; app:mobile/eas.json | Disable the workflow, delete the EXPO_TOKEN secret and stale branches, update the README, remove eas.json build profiles | small |
| 9 | SHOULD FIX | Android | Android users can't sign in (Apple sign-in is iPhone-only, email codes are off), so Add a tournament, Friends, Sell gear and Messages all stop at "coming soon". The Android RevenueCat key is blank, so no ad-free or tips, which breaks "same purchases". | app:mobile/config.ts:73 and EMAIL_SIGN_IN_ENABLED; app:mobile/app/sign-in.tsx:101-105; app:mobile/src/monetization/premium.tsx:16,70 | Connect email sign-in, create Play products, add the Android RevenueCat key | medium |
| 10 | SHOULD FIX | Android | No Firebase setup, so Android gets no push notifications; the error is hidden. | app:mobile/app.json (no googleServicesFile); app:mobile/src/lib/push.ts:53,62-64 | Create the Firebase Android app, add google-services.json, upload the FCM key to Expo | medium |
| 11 | SHOULD FIX | Content | Outside Texas the feed is thin: World Archery, the ASA Pro/Am tour, 7 club or state feeds in 6 states, and one hand-entered event. Most states open on "Nothing listed yet". A listing promising "every state" risks Apple 2.3 and Play "Misleading claims". | main:data/manual-events.json (1 row); main:api/_states.ts; main:api/_national.ts:351-361 | Hand-enter national and state championships (facts and a link only); word the listing as "growing" | medium, ongoing |
| 12 | SHOULD FIX | Organizers | Organizers have no way to ask to be listed. The app has no "list your shoot" link, and emailed shoots can only go in manual-events.json, where they show as "National". | grep finds no submit link in app:mobile/app or src; main:client/public/support.html:33-34 | Add "Organizers: get your shoot listed" (pre-filled email) on the Account tab and empty states; label emailed shoots "User Added" (Decision 9) | small |
| 13 | SHOULD FIX | Data / reliability | If the nationwide collector fails, no events-usa.json is published, and the app falls back to the Texas-only feed and saves it over its offline copy. A run that reaches only 1 event still publishes. | main:.github/workflows/pages.yml:52-53; main:script/collect-usa-events.ts:50-53; app:mobile/src/features/calendar/api.ts:9,85,100-105; local run: "Wrote 1 events", exit 0 | Carry forward the last good file; refuse to publish under ~50% of the previous count | small |
| 14 | SHOULD FIX | Crashes | One feed row without a name or date breaks the whole schedule and shows a false "You might be offline". A bad saved copy can leave the spinner running forever. | app:mobile/src/features/calendar/api.ts:22-25,43,79,112; useEvents.ts:42-50 | Skip bad rows; say "offline" only for network errors; always end loading | small |
| 15 | SHOULD FIX | Reliability | With weak signal at startup, profile and block-list loads fail silently: signed-in users see "Finish your profile" and blocked people reappear. | app:mobile/src/lib/auth.tsx:63-66,73-85 | Check errors, show a retry, retry on returning to the app | small |
| 16 | SHOULD FIX | Hotel box | Prices are stored once per town for its next shoot, so a later shoot in the same town shows the earlier dates' prices. With 4-9 hotels the outlier trim doesn't work (test: [80,90,100,110,600] gave "typical" $195). | app:mobile/src/features/calendar/hotels.ts:43-46,64-73; main:script/hotel-prices.mjs:25-29 | Show prices only when the priced nights match this shoot; use the median as "typical" | small |
| 17 | SHOULD FIX | First launch | Tapping Cancel on "Where do you shoot?" silently sets Texas next launch; signed-out users can never change home state. | app:mobile/src/lib/homeState.tsx:32-37; app:mobile/app/(tabs)/index.tsx:26-27,76-81 | Save the skip; add a "Home state" row on the Account tab | small |
| 18 | SHOULD FIX | Copy | The add-a-tournament form still talks about Texas schedules and an "Out of state" chip that no longer exists; state defaults to TX. | app:mobile/src/features/community/TournamentForm.tsx:66,156-161 | Rewrite for nationwide; default to the home state | small |
| 19 | SHOULD FIX | iOS permissions | The built app includes default "Always location" and "Reminders" permission text for things it never asks for. | prebuild Info.plist:62-65,70-73; Apple 5.1.1(ii) | Set those permissions to false in app.json | small |
| 20 | SHOULD FIX | Android signing | The Play upload key exists only on the Mac mini, with no backup. If the first .aab came from Expo's cloud, Play expects Expo's key and will reject a Mac mini upload. | app:mobile/scripts/android-release.sh:6-8,18,24-25 | Compare certificate fingerprints in Play Console; turn on Play App Signing; back up the keystore off the machine | small |
| 21 | SHOULD FIX | iPad | iPad is on and rotates, but layouts are phone-only (full-width rows, a listing photo about 1366pt tall). Apple reviews on iPad and needs iPad screenshots. | `npx expo config --type introspect`; app:mobile/src/features/marketplace/components/PhotoCarousel.tsx:12,23 | Turn iPad off for 1.2 (Decision 2), or cap content width at ~700pt | small |
| 22 | SHOULD FIX | Accessibility | VoiceOver can't reach the Going star on a shoot row; the month grid, date badges and share picture clip at large text sizes. | app:mobile/src/features/calendar/components/EventRow.tsx:23,56; MonthGrid.tsx:13-14,229-250; ShareCard.tsx:127-128 | Separate the star button; cap text scaling (~1.3-1.5×) in fixed-size areas | medium |
| 23 | SHOULD FIX | Database ops | No backups (free plan), no migrations (one 923-line schema.sql), no limits per account on posts, messages or reports, and listing photos are never cleaned up (free plan: ~800 listings). | app:mobile/supabase/schema.sql; app:mobile/README.md "Limits on the free plan" | Move to Supabase Pro before launch (Decision 3); turn the schema into migrations; add rate limits and photo cleanup | medium |
| 24 | SHOULD FIX | Dependencies | Expo SDK 54 / React Native 0.81 is three SDKs behind (57 is current). A hand-written iOS patch keeps the app from crashing on iOS 27 and may break silently. | `npm outdated` in mobile/; app:mobile/plugins/withSceneLifecycle.js:1-4 | After launch, upgrade one SDK at a time with a Mac mini build and device test each step | large |
| 25 | SHOULD FIX | Repo | The phone app lives only on mobile-app (66 commits ahead, 14 behind main), which also carries old drifted copies of the website. main carries an unused server and Vercel functions; one is an open endpoint that runs every scraper (1 critical npm audit hit via express). | `git log origin/main..HEAD`; `diff -rq` between checkouts; main:api/refresh.ts:5-11; `npm audit --omit=dev` on main | After PR #3 lands, make main the one branch; delete the dead server code once Vercel is confirmed off | medium |
| 26 | SHOULD FIX | Tests | There are no automated tests and no CI check for the phone app. Typechecks pass (`npx tsc --noEmit` exit 0 in mobile/; `npm run check` exit 0 on main). | find for *.test.* returns nothing; no `test` script | Add the 5 tests listed in the plan and a pull-request check | medium |
| 27 | SHOULD FIX | Collector | No fetch has a timeout, and the workflow has none, so one slow organizer site can hold up the whole schedule and hotel publish. | main:api/_scrapers.ts:92,156,250; main:api/_national.ts:155,190,307; pages.yml | Add 20s fetch timeouts and `timeout-minutes: 15` | small |
| 28 | SHOULD FIX | Offline | Archer-added shoots aren't saved on the phone, so they disappear at a range with no signal after a restart. | app:mobile/src/features/community/CommunityProvider.tsx:35-44 | Cache them like the main schedule | small |
| 29 | NICE TO HAVE | Monitoring | Nothing alerts anyone if the daily hotel-price routine stops; GitHub turns off scheduled jobs after 60 days of no repo activity. | main:.github/workflows/hotel-towns.yml:1-4 | Open the feed-health issue when hotel prices are more than 3 days old | small |
| 30 | NICE TO HAVE | Hotel box | With no town, "Find hotels" searches the state name; the app's placeholder-town rule differs from the job's ("Multiple, TX"). | app:mobile/src/features/calendar/hotels.ts:60,124,127; main:script/hotel-towns.mjs:32 | Hide the button when there's no real town (Decision 6); share one rule | small |
| 31 | NICE TO HAVE | Purchases | "Restore purchases" is only on the ad-free screen and is hidden when products fail to load. | app:mobile/app/(tabs)/account.tsx:199-206; Apple 3.1.1 | Always show a Restore row | small |
| 32 | NICE TO HAVE | Android polish | Adaptive icon gets cropped; dark mode needs expo-system-ui; unneeded storage and overlay permissions are included. | app:mobile/app.json:10-14,25-28; prebuild AndroidManifest.xml:2-11 | Padded icon foreground, add expo-system-ui, block the extra permissions | small |
| 33 | NICE TO HAVE | Layout | Marketplace and Messages take 2 of 4 tabs; Messages only serves the marketplace. The Sell form's tournament picker shows only the first 80 shoots nationwide. | app:mobile/app/(tabs)/_layout.tsx:46-63; ListingForm.tsx:248,276-283 | Fold Messages into Marketplace (Decision 5); filter the picker by state with search | medium |
| 34 | NICE TO HAVE | Performance | The calendar view isn't virtualized; marketplace cards load full 1280px photos. | app:mobile/src/features/calendar/CalendarScreen.tsx:533-554; marketplace/api.ts:95 | Use a FlatList; save small thumbnails on upload | medium |
| 35 | SHOULD FIX | Security | The live database lets signed-out visitors run 7 privileged functions, including the friend and block checks and the push triggers, and 5 functions have an unpinned search path. Leaked-password protection is off (unused today, since email passwords aren't used). | Supabase security advisor, live project, 2026-10-06: lints 0028 (7), 0029 (12), 0011 (5) | Revoke EXECUTE from anon (and from authenticated on trigger-only functions); set `search_path` on the 5 functions | small |

Checked and fine: no secrets in either checkout or their history (the keys in config.ts are public client keys); row-level security is on for every table; no USA Archery scraping and no ASA text or logos; no state-average hotel logic left; ads are non-personalized, so no tracking prompt is needed; theme colors pass contrast in light and dark mode; Android targets API 36; the scholarship link and 10% line are built and switched off until TFAA's written OK.

## 8. Store readiness (coordinator)

- **Apple 1.2 (user content):** report and block exist for tournaments, listings and chat. A way to act within 24 hours is needed (finding 6), and the marketplace rules page is live.
- **Apple 3.1.1 / Play Billing:** ad-free and tips use in-app purchase on iPhone. Android needs the same (finding 9).
- **Apple 3.2.2 / Play donations:** the scholarship donation is an external link from a free app, which both stores allow. It stays off until TFAA signs. The fund has no donation link yet, so only the 10% line would show.
- **Apple 4.8:** only Sign in with Apple is offered on iPhone, so no extra login option is required.
- **Apple 5.1.1:** account deletion exists in the app (fix findings 4 and 7). Google Play also needs the web deletion link (finding 5).
- **Privacy forms:** App Store privacy labels and the Play Data safety form must list: name and email (account), coarse location, photos, messages, user content, purchases (RevenueCat), device id for ads (AdMob, non-personalized) and push token. Studio drafts both; the owner submits.
- **Age rating:** chat, a marketplace and user content mean roughly Apple 12+ / Play Teen. The app is already 13+ for accounts. Declare "contains ads" on Play.
- **Screenshots and text:** iPhone 6.9" and 6.5" screenshots, iPad screenshots if iPad stays on, Play phone screenshots plus a 1024×500 feature graphic, a short and long description, support URL (support.html) and privacy URL (privacy.html).
- **Review notes:** say that sign-in is Sign in with Apple, that the shoot data comes from public organizer schedules with links back, and where the report and block buttons are.
- **Play testing rule:** if the Play developer account is a personal account made after November 2023, Google requires a closed test with at least 12 testers for 14 days before production. This could not be checked.

## 9. Growth (coordinator)

- **Name and listing:** "Archery in the USA" is clear and searchable. Use a subtitle like "Archery tournaments near you" and keywords: archery, 3D archery, field archery, tournament, shoot, ASA, NFAA, bowhunter. Lead screenshots with the calendar, a shoot with the hotel box, and Near me.
- **Idea 1: content first.** People keep a calendar app only if their shoots are in it. Make the "get your shoot listed" button (finding 12) the main growth tool, and hand-enter each state's championships before launch.
- **Idea 2: shareable shoots.** Make each shared shoot open a web page with a "Get the app" link. Every archer who shares a shoot then advertises the app to their club.

## Improvement plan

**Phase 1: fix before publishing**
- Lock the friendship rule to status-only updates (1).
- Restrict profile reads to public columns and add a "my friend code" function (2).
- Bump the app version to 1.2.0 and decide on over-the-air updates (3).
- Correct the privacy policy about starred shoots (4).
- Add a web page for account deletion requests (5).
- Email the owner on every new report and block re-sign-up by banned users (6).
- Delete account photos on the server and revoke the Apple token (7).
- Disable the old cloud-build workflow and delete its branches and secret (8).
- Remove the unused iOS permission texts (19).
- Turn iPad off for this release (21).
- Guard the event feed against empty or failed runs (13) and skip bad rows in the app (14).
- Fix the offline-startup profile and block-list bug (15).
- Rewrite the add-a-tournament text for nationwide (18) and save the home-state skip (17).
- Add the organizer "get your shoot listed" button (12).
- Hand-enter national and state championships (11).
- Back up the Android upload key and confirm Play App Signing (20).
- Move the database to Supabase Pro (23).
- Finish Android sign-in, purchases and push before the Play release (9, 10).

**Phase 2: first update after launch**
- Add the five protective tests and a pull-request check (26).
- Fix the hotel box date matching and outlier trim (16, 30).
- Fix VoiceOver and large-text issues (22).
- Cache archer-added shoots offline (28).
- Add fetch timeouts to the collector (27) and the hotel-price staleness alert (29).
- Always show Restore purchases (31).
- Move main to be the one branch and delete dead code (25).
- Turn the database schema into migrations and add rate limits and photo cleanup (23).

**Phase 3: later ideas**
- Upgrade Expo one SDK at a time to the current version (24).
- Fold Messages into the Marketplace tab (33).
- Speed up the calendar and marketplace images (34).
- Polish the Android icon and dark mode (32).
- Turn iPad back on with a tablet layout.
- Add shareable shoot web pages.
- Expand club calendar feeds state by state.

**The five tests that protect the app most** (from test-automation)
1. Collector parsers on saved pages, plus a check that no source is on a USA Archery domain.
2. The publish guard for the event feed (no empty or nearly empty calendar).
3. Hotel price math: outlier trim, minimum hotel count, town-level only.
4. App feed loading: fallback, bad data, offline cache, duplicate merging.
5. Hotel card rules shared with the job: town rule, nights never in the past, Stay22 affiliate link.

## Publishing plan

1. Answer the decisions below. **Owner does it.**
2. Build the Phase 1 fixes on branches, with checks green. **Studio does it.**
3. Review and approve the fixes (gate). **Owner does it.**
4. Apply the database rule fixes to the live Supabase project (gate: production change). **Studio does it after owner approval.**
5. Upgrade Supabase to Pro. **Owner does it** (payment).
6. Build iPhone 1.2.0 on the Mac mini and upload to TestFlight. **Studio does it** (on the Mac mini).
7. Test on your phone, including sign-in, delete account, a purchase in sandbox, and the hotel box. **Owner does it.**
8. Prepare App Store text, screenshots (6.9", 6.5"), privacy labels, age rating and review notes. **Studio drafts; owner approves.**
9. Sign in to App Store Connect, accept agreements, attach the build and submit for review. **Owner does it.**
10. Release on approval (manual release recommended). **Owner does it.**
11. Android: set up Firebase, Play products, the RevenueCat Android key and email sign-in. **Studio does it; owner creates the accounts.**
12. Confirm the Play upload key and Play App Signing, and back up the keystore. **Owner does it with studio guidance.**
13. Build the Android .aab on the Mac mini. **Studio does it.**
14. Complete the Play listing, Data safety form, content rating, ads declaration and account deletion URL. **Studio drafts; owner submits.**
15. Run the closed test (12 testers, 14 days, if Google requires it), then promote to production. **Owner does it.**
16. After both stores are live, merge website PR #3. **Studio does it after owner approval.**

## Maintenance plan

- **Every month:** apply Expo patch updates and security fixes, build on the Mac mini, and send a TestFlight build. Check the feed-health issue, the hotel price date and the Supabase usage page.
- **Twice a year:** upgrade to the next Expo SDK, one step at a time, with a device test each step. Expo ships about three a year, and each new one covers the new iOS and Android versions.
- **Every June to September:** test against Apple's and Google's new OS betas, and meet Google Play's yearly target-API deadline (August).
- **Weekly:** read crash reports (Xcode Organizer and Play Console vitals) and store reviews, and answer user reports within 24 hours.
- **Backups:** Supabase Pro daily backups, plus an off-machine copy of the Android upload key and its passwords.
- **Renewals:** the Apple Developer membership and distribution certificate yearly, and the push key whenever it is replaced.
- **Owner approves:** each store release, any database change, money (plans, prices) and new features.
- **To make maintenance cheaper:** one branch instead of two, tests in every pull request, database migrations, dead code deleted, and no over-the-air updates. Each of these removes a way for a fix to break something quietly.

## Decisions for the owner

1. Remove over-the-air updates so every change goes through a Mac mini build? **Yes (recommended)** / No
2. Turn iPad off for the first nationwide release? **Yes (recommended)** / No
3. Upgrade the database to Supabase Pro ($25 a month) for backups before launch? **Yes (recommended)** / No
4. Release Android only when sign-in, ad-free and tips match iPhone? **Yes (recommended)** / Release browse-only first
5. Fold Messages into the Marketplace tab? **Later (recommended)** / Now / Never
6. Hide "Find hotels" when a shoot has no real town? **Yes (recommended)** / No
7. May the studio run a read-only security check on the live database to confirm findings 1 and 2? **Yes (recommended)** / No
8. Delete the unused website server code after confirming Vercel is off? **Yes (recommended)** / No
9. Label emailed and organizer-sent shoots as "Club shoots"? **Yes (recommended)** / Other name
10. Release the iPhone version manually after Apple approves it? **Yes (recommended)** / Automatically

## Owner's answers (2026-10-06)

1. Remove over-the-air updates: **Yes**
2. Turn iPad off for the first release: **Yes**
3. Supabase Pro: **Yes, before launch** (free plan until then)
4. Android only once sign-in, ad-free and tips match iPhone: **Yes**
5. Fold Messages into Marketplace: **Later**
6. Hide "Find hotels" with no real town: **Yes**
7. Read-only live database check: **Yes** (done; findings 1 and 2 confirmed, finding 35 added)
8. Delete the unused website server code after confirming Vercel is off: **Yes**
9. Label for emailed and organizer-sent shoots: **"User Added"**
10. Release the iPhone version manually after approval: **Yes**

Next: step 4 (studio brief) turns the improvement plan into ideas/archery-in-the-usa.md on the Mac mini.

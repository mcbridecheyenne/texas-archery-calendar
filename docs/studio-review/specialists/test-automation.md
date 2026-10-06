# Test automation review (role: test-automation)

Checkouts: mobile-app = /home/user/apps/archery-in-the-usa (c53d4ab), main = /home/user/apps/archery-in-the-usa-main (9db56c5).

## 1. Findings

| Rating | Area | What's wrong | Evidence | Fix | Size |
|---|---|---|---|---|---|
| SHOULD FIX | Tests | There are no automated tests at all. No test files, no `test` script, no test runner in any package.json (root or mobile/), in either checkout. | `find . -name "*.test.*" -o -name "*.spec.*" -o -name __tests__ -o -name "jest.config*" -o -name "vitest.config*"` (node_modules excluded) returns nothing in both. Scripts are only dev/build/start/check/db:push/build:client (root) and start/ios/android/typecheck/... (mobile:package.json). | Start with Node's built-in `node --test`. It needs no new packages (Node 22 is already used in CI). Add the five tests in section 3. | medium |
| SHOULD FIX | CI | Nothing in CI typechecks or tests code. The mobile-app branch has no workflow for the phone app at all. The release scripts do not typecheck before a Mac mini build either. | `grep -rn "tsc\|typecheck\|test" .github mobile/scripts/*.sh` finds nothing in either checkout. The workflows are only check-feeds.yml, pages.yml and (main) hotel-towns.yml. | Add one `checks.yml` that runs on pull requests: `npm run check`, `cd mobile && npx tsc --noEmit`, and `node --test`. Also add `npm run typecheck` as the first line of mobile/scripts/ios-release.sh and android-release.sh. | small |
| SHOULD FIX | Typecheck scope | `npm run check` on main skips the live collector code. The tsconfig only includes client/src, shared and server, so api/*.ts and script/*.ts (the code that builds events.json every 3 hours) are never typechecked. | main:tsconfig.json:2 `"include": ["client/src/**/*", "shared/**/*", "server/**/*"]`. A manual check passes today: `npx tsc --noEmit --strict --module esnext --moduleResolution bundler --target es2022 --allowImportingTsExtensions --skipLibCheck --types node script/collect-*.ts api/*.ts` exits 0. | Add `"api/**/*", "script/**/*"` to include, or add a second tsconfig for them. | small |
| SHOULD FIX | Hotel prices | The "typical" price is not protected from expensive outliers in towns with fewer than 10 hotels. `high = prices[ceil(0.9n)-1]` is always the most expensive hotel when n is 4 to 9, so the "drop the $600 resort" trim does nothing. 16 of the 64 towns in the current file have fewer than 10 hotels. | main:script/hotel-prices.mjs:25-29. Fixture run: prices [80,90,100,110,600] give `low 80, typical 195, high 600` (the middle price is 100). `client/public/hotel-prices.json` has 16 of 64 towns with `hotels` < 10 (for example new braunfels, tx: high 391, hotels 9). | Use a trim that works for small n, for example drop prices above 2x the median before averaging, or use the median as "typical". Lock it in with test #3. | small |
| SHOULD FIX | Event feed | The nationwide feed can publish an almost empty calendar. collect-usa-events.ts only refuses to publish at 0 events. If every network source fails and the previous file can't be fetched, it publishes just the hand-entered shoot(s) and exits 0. The app reads events-usa.json first, so phones would show about 1 shoot. | Local run, where the sandbox proxy blocked every site: `node --experimental-strip-types script/collect-usa-events.ts out.json` printed 7 sources "error, 0 events (HTTP 403)", "Manual: ok, 1 events", "Wrote 1 events", EXIT 0. The guard is main:script/collect-usa-events.ts:50-53. The app's feed order is mobile-app:mobile/src/features/calendar/api.ts:9 and :102-105. | Refuse to publish when no network source succeeded, or when the count drops below about 50% of the previous file. The step already has continue-on-error, so the last good file stays live. | small |
| NICE TO HAVE | Hotel card | The app's town rules don't match the daily job's, even though the code comment says they are the "Same rules". The job skips towns named "Multiple", "Various" or "X - Y". The app only skips "TBA". So "Find hotels" can search for "Multiple, TX, USA". | Job: main:script/hotel-towns.mjs:32. App: mobile-app:mobile/src/features/calendar/hotels.ts:60 (cityKey) and :124 (hotelPlace). Throwaway probe: `cityKey({city:"Multiple",state:"TX"})` returned "multiple, tx" when null was expected. | Move the placeholder regex into one shared rule and use it in both places. Lock it in with test #5. | small |
| NICE TO HAVE | CI | The PR feed check doesn't run when the hotel job changes. Its path filter only covers `script/collect-*.ts`, so edits to hotel-towns.mjs, hotel-prices.mjs or hotel-towns.yml are never tested before merge. | main:.github/workflows/check-feeds.yml:7 | Add those paths, and run the hotel tests (#3) there. | small |

## 2. Could not check
- **Live event sources.** Every collector source returned HTTP 403 through the cloud proxy, so I could not confirm that any scraper still parses its real site. CI's check-feeds run is the only proof.
- **Root `npm run check` in the mobile-app checkout** (the older website copy in client/server). The root dependencies are not installed there: node_modules holds only an empty `typescript` folder and there is no tsc binary. `npm run check` exited 2.
- **Component and UI tests** (ads hidden for ad-free buyers, scholarship gating, purchase flow). These need a React Native test runner (jest-expo or similar), and none is installed. I did not add one, per the brief.
- **Supabase row-level security** (who can read messages, listings and friends). That needs a local Supabase stack or database access, and neither is available here. mobile/supabase/schema.sql was not exercised.
- Anything on a device, TestFlight, Play Console or GitHub Actions run history.

## 3. Role-specific: tests that exist, results, and the top five to add

### What exists
| Kind | mobile-app checkout | main checkout |
|---|---|---|
| Unit tests | none | none |
| Script tests | none | none |
| Typecheck script | root `check` = `tsc`; mobile `typecheck` = `tsc --noEmit` | root `check` = `tsc` (covers client/shared/server only) |
| CI workflows | check-feeds.yml (on PRs touching api/script/data: runs both collectors and fails if any source returns 0 events); pages.yml (collect and publish every 3h) | the same, plus a weekly check-feeds schedule; hotel-towns.yml (daily town list); pages.yml with source-health issue alerts and the hotel-prices copy |
| CI that runs tests or typecheck | none | none |

### Commands run and results
| Command | Where | Result |
|---|---|---|
| `npx tsc --noEmit` (TS 5.9.3) | mobile-app:mobile/ | **PASS**: exit 0, 0 errors (78 project files) |
| `npm run check` | main root | **PASS**: exit 0, 0 errors |
| `npm run check` | mobile-app root | **COULD NOT RUN**: exit 2, root deps not installed (no tsc) |
| manual `tsc --noEmit` over script/collect-*.ts + api/*.ts (bundler resolution, strict) | main | **PASS**: exit 0 (this code is outside `npm run check`) |
| `npm test` | any | **no test script exists**: 0 tests, 0 pass, 0 fail |
| `node --experimental-strip-types script/collect-events.ts <scratch>/events.json` | main | exit 1: TFAA, ASA and TSAA all HTTP 403 (proxy). The "don't publish empty" guard worked. |
| `node --experimental-strip-types script/collect-usa-events.ts <scratch>/events-usa.json` | main | exit 0: wrote 1 event while all 7 network sources were 403 (see finding 5) |
| `node script/hotel-towns.mjs` / `node script/hotel-prices.mjs` on hand-made fixtures | main | both exit 0. Found the outlier problem (finding 4). Empty results produce `cities: {}` (pages.yml then falls back correctly). |
| Throwaway probe: 16 `node:test` cases on mobile hotels/api/dates/states, bundled with main's esbuild and an AsyncStorage stub, run with `node --test`. Kept in my scratchpad, not in the repo. | mobile-app code | **14 pass, 2 fail.** Both failures are the cityKey parity gap (finding 6). Passing: nights math, Stay22/Booking URL, no state-level price fallback, Vegas Shoot dedupe, Texas default state, date formatting. This shows pure mobile logic can be tested with no new packages. |

### The five tests that would protect the app most
1. **Collector parsers on saved pages, plus a source allowlist.** Where: `main:api/__tests__/scrapers.test.ts`, run with `node --experimental-strip-types --test`. It feeds saved HTML/JSON fixtures (no network) to each parser in api/_scrapers.ts, _national.ts and _states.ts, and checks name, dates, city and state. It also asserts that no source URL is on a USA Archery domain. **Guards against:** a site redesign silently emptying a source or garbling dates, and anyone ever adding a USA Archery scrape (a must-not-change rule).
2. **Publish guard for the event feed.** Where: `main:script/collect.test.ts`. First move the "keep last good run" and "should we publish" logic out of collect-events.ts and collect-usa-events.ts into a small exported function. Then test: all sources fail with no previous file gives "don't publish"; one source fails gives that source's previous events marked partial; and the count-drop threshold. **Guards against:** the app showing an empty or 1-shoot calendar nationwide (finding 5).
3. **Hotel price math.** Where: `main:script/hotel-prices.test.mjs` (`node --test`). It runs hotel-prices.mjs and hotel-towns.mjs on fixtures. Cases: outlier trim at n=4 to 9 (fails today), MIN_HOTELS, KEEP_DAYS reuse and expiry, junk/negative/zero prices dropped, low ≤ typical ≤ high, keys are town-level only (never a state-only key), and nights are "night before" through the last day. **Guards against:** misleading prices on the hotel card, and breaking the town-level-only rule.
4. **App feed loading and merging.** Where: `mobile/src/features/calendar/__tests__/api.test.ts`, with fetch and AsyncStorage stubbed. Cases: events-usa.json 404 falls back to events.json; a malformed body is rejected with a friendly error; a timeout gives the "took too long" message; the cache is written and read back; mergeDuplicates (Vegas Shoot listed by TFAA and World Archery shows once and keeps the real town); Texas sources default to TX. **Guards against:** a blank or duplicated Tournaments tab after a feed change, and losing offline use.
5. **Hotel card rules, shared with the job.** Where: `mobile/src/features/calendar/__tests__/hotels.test.ts`, using one shared fixture list of towns that main's hotel test also uses. Cases: cityKey and placeholders match hotel-towns.mjs (fails today); hotelNights never starts in the past and is null after the shoot; hotelSearchUrl uses Stay22 with aid/campaign when the aid is set and Booking.com otherwise; no price is shown without a town match. **Guards against:** the affiliate link losing commission, wrong nights in the search, prices on the wrong town, and app/job drift.

Runner-up, once a React Native runner is approved: a test that the ad banner is hidden when the ad-free entitlement is active (mobile-app:mobile/src/monetization/AdBanner.tsx:38-39) and that donation UI stays hidden while `SCHOLARSHIP.enabled` is false (mobile/config.ts:63-64).

**Runner note:** mobile/ has no test runner (no jest or jest-expo). Tests #4 and #5 can run today with `node --test` plus a one-line esbuild bundle step, as the probe showed. Component tests would need jest-expo, which is a new package and is the owner's call.

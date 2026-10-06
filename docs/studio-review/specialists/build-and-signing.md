# Build and signing review (role: build-and-signing)

Checkouts: mobile-app = /home/user/apps/archery-in-the-usa (c53d4ab), main = /home/user/apps/archery-in-the-usa-main (9db56c5).

Short answer: yes, the app can be built today on the Mac mini for both stores. `npx expo config --type public` and `npx expo prebuild --no-install --clean` both work offline in a temp copy (/tmp/claude-0/review/prebuild-test), both custom plugins apply cleanly, and `tsc --noEmit` passes. Nothing on `main` or on the current `mobile-app`/`app-release` tips starts an EAS cloud build. But the old EAS workflow is still registered "active" on GitHub and still sits on 5 stale branches, and there is one real crash risk with over-the-air updates.

## 1. Findings

| Rating | Area | What's wrong | Evidence | Fix | Size |
|---|---|---|---|---|---|
| BLOCKER (before any `publish-update`) | Versioning / OTA updates | The new Mac-mini build and build 14 both say version 1.1.0. Updates are keyed on the app version (`runtimeVersion.policy: appVersion`). So both builds get the same over-the-air updates. But the new build has native code that build 14 lacks: expo-store-review was added, and react-native-purchases went from 9 to 10. If anyone runs `npm run publish-update`, build 14 phones would get JS that calls a native module they don't have, and the app would crash or break. | mobile-app:mobile/app.json:5 (`"version": "1.1.0"`), :64-66 (runtimeVersion appVersion); `git diff 5111ecc HEAD -- mobile/package.json` adds `expo-store-review` and moves `react-native-purchases ^9.0.0 → ^10.11.0` (5111ecc = the last successful EAS "App build" run, 2026-10-04 16:09); mobile/src/features/calendar/review.ts:5 imports expo-store-review; mobile/package.json:12 `publish-update` | Bump `version` to 1.2.0 before the next TestFlight upload. Each later native change gets a new version, or switch to `"policy": "fingerprint"`. Don't run publish-update until the store builds are on the new version. | small |
| SHOULD FIX | CI / no EAS cloud | PR #26 removed `app-build.yml` from mobile-app, and the `app-release` tip (c53d4ab) is clean. But GitHub still lists "App build" as an **active** workflow. The file (trigger: push to `app-release`, runs `eas build ... --auto-submit` with `EXPO_TOKEN`) still exists on branches claude/push, claude/browse, claude/expiry, claude/going and usa-filters-home-state. Pushing any of those to `app-release` would start a cloud build again. The last EAS run was 2026-10-06 17:00 (cancelled after 1h39m). | `gh workflow list` → `App build active 374688025`; `gh api .../contents/.github/workflows/app-build.yml?ref=<branch>` found on those 5 branches; `gh run list --workflow app-build.yml` | `gh workflow disable "App build"`. Delete the `EXPO_TOKEN` repo secret (I couldn't list secrets: the proxy blocks it). Delete the `app-release` branch and those 5 stale branches, or remove the file from them. | small |
| SHOULD FIX | iOS permission strings | The prebuilt Info.plist has generic default strings for permissions the app never asks for: `NSLocationAlways…` and `NSReminders…` say "Allow $(PRODUCT_NAME) to access your location/reminders". Apple asks that every purpose string explain the use, and reviewers do flag generic ones. | prebuild-test/ios/ArcheryintheUSA/Info.plist:62-65, 70-73; App Store Review Guideline 5.1.1(ii) | In app.json, set expo-location `locationAlwaysAndWhenInUsePermission: false` and `locationAlwaysPermission: false`, and expo-calendar `remindersPermission: false`. That drops those keys. | small |
| SHOULD FIX | Android push | Android has no Firebase config: no `android.googleServicesFile`, no google-services.json. So `getExpoPushTokenAsync` fails on Android, the error is silently swallowed, and Android users never get message or friend-request notifications. | mobile-app:mobile/app.json:23-29 (no googleServicesFile); mobile/src/lib/push.ts:53, :62-64 (catch swallows the error); README.md:145-150 lists this as an unfinished setup step | Create the Firebase Android app, add google-services.json and `googleServicesFile`, and upload the FCM V1 key to the Expo project (that is credentials, not a build). | medium |
| SHOULD FIX | Android signing | The Play upload key exists only on the Mac mini, in `~/.archery-keys/upload.jks` plus `upload.properties`. Git has no copy (I checked all history and the mac-backup branch) and the repo has no backup. If the first .aab was made by `eas build` (README still says to), Play holds Expo's upload key, not this one, and the local .aab will be rejected. | mobile-app:mobile/scripts/android-release.sh:6-8, 18, 24-25, 44-48; README.md:221 (`eas build -p android`); `git log --all --name-only` has no .jks | In Play Console → App integrity, compare the upload certificate SHA-1 with `keytool -list -v -keystore ~/.archery-keys/upload.jks`. Make sure Play App Signing is on. Keep an offline backup of the keystore and passwords, e.g. in a password manager. | small |
| SHOULD FIX | Docs and leftover EAS config | The README's Android section still says `eas build -p android` / `eas submit`. eas.json still has cloud build profiles with `appVersionSource: remote` and `autoIncrement`. Someone following the docs would start a forbidden cloud build. | mobile-app:mobile/README.md:218-223; mobile/eas.json:1-25 | Change the README to `npm run android:build` and a manual Play upload. Remove the `build` profiles from eas.json, or mark them "do not use". | small |
| SHOULD FIX | Android purchases | The RevenueCat Android key is empty, so ad-free and tips are hidden on Android. That breaks the "same purchases" promise on Play. | mobile-app:mobile/config.ts:73 `androidApiKey: ""` | Create the Play products and add the Android app in RevenueCat, then paste the `goog_` key. | medium |
| NICE TO HAVE | Android permissions | Expo default permissions the app doesn't need end up in the manifest: SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE. ACCESS_FINE_LOCATION is there too, though the code only uses `Accuracy.Low`. These raise Play's Data safety and location questions. | prebuild-test/android/app/src/main/AndroidManifest.xml:2-11; mobile/src/lib/location.ts:27 | Add `android.blockedPermissions` for those 4 permissions. | small |
| NICE TO HAVE | Adaptive icon / dark mode | The Android adaptive icon reuses the full 1024 icon, and the outer ring and arrow sit outside the 66% safe zone, so launchers will crop them. Prebuild also warns that `userInterfaceStyle: automatic` needs expo-system-ui on Android. The splash just reuses the app icon. | mobile/app.json:7,10-14,25-28; assets/icon.png (target is about 80% of the canvas); prebuild output "Install expo-system-ui in your project to enable this feature" | Add a padded `adaptive-icon.png` foreground, add expo-system-ui (needs an npm install), and optionally a dedicated splash image. | small |
| NICE TO HAVE | AdMob iOS | The Info.plist has no SKAdNetworkItems (count 0), which Google's iOS AdMob setup asks for. Ad fill and revenue may be lower. No ATT/NSUserTracking string is needed, because ads are non-personalized only. | `grep -c SKAdNetworkIdentifier Info.plist` → 0; mobile/src/monetization/AdBanner.tsx:79 | Add `skAdNetworkItems` to the react-native-google-mobile-ads plugin config. | small |
| NICE TO HAVE | Release script robustness | Nothing records which git commit became which build number. The script doesn't check that it is on `mobile-app` with a clean tree. If prebuild fails, package.json is left rewritten in the release clone. | mobile/scripts/ios-release.sh:26-36, 38; android-release.sh:31-34 | Print or tag `git rev-parse HEAD` with the build number, and refuse to run on a dirty tree or the wrong branch. Restore package.json with a `trap`. | small |
| NICE TO HAVE | iPad | `supportsTablet: true` means App Store Connect needs iPad screenshots, and the app must work well on iPad. | mobile/app.json:17; Guideline 2.4.1 | Keep it and supply iPad screenshots, or set it to false if iPad isn't wanted. | small |

## 2. Could not check

- Real iOS/Android compiles, signing and upload. That needs Xcode 27, the Android SDK and the keys on the Mac mini (this is Linux, and the brief says no store builds).
- Whether App Store Connect accepted the 12-digit date build numbers (e.g. 202610051830), and whether the new TestFlight build got there.
- Play Console: whether an app exists, which upload key it expects, whether Play App Signing is on, and the versionCode of the earlier .aab.
- Whether the `EXPO_TOKEN` secret still exists. The proxy blocks the GitHub secrets API (HTTP 403).
- The Expo project's push credentials (APNs key, FCM), and whether any EAS builds are still queued.
- `expo-doctor`: 16/18 checks passed. The 2 that failed (config schema, React Native Directory) failed only because the network is blocked.

## 3. Role-specific answers

**Can it build today (local only)?** Yes. Offline in the temp copy: `npx expo config --type public` exit 0, `npx expo prebuild --no-install --clean` exit 0 ("Finished prebuild"), `tsc --noEmit` exit 0. The Podfile gets the 15.1 snippet and AppDelegate gets SceneDelegate. Targets: iOS deployment 15.1; Android minSdk 24, target and compile SDK 36, which meets Play's current target-SDK rule.

**Identity:** bundle id and package are both `com.cheyennemcbride.archeryintexas`. Version 1.1.0. Apple team 75Y3S5CV88, ASC app 6818734839. Expo project `archery-in-texas`, owner cmprograms; it is used only for EAS Update and push.

**Version numbers:**
- Build 14 was numbered by EAS: `appVersionSource: remote` plus `autoIncrement` (eas.json:4, 21).
- Local iOS builds now set CFBundleVersion to `YYYYMMDDHHMM` (ios-release.sh:38-39). That is far above 14, so it always goes up.
- Android versionCode = minutes since 2020-01-01 (android-release.sh:37), about 3.5 million now, well under Play's 2,100,000,000 cap.
- app.json has no buildNumber or versionCode, which is fine: the scripts set them.
- The marketing version still has to be bumped by hand in app.json (see the BLOCKER).

**Permission strings that are present and good:** NSLocationWhenInUse, NSPhotoLibrary, NSCamera, NSCalendars and NSCalendarsFullAccess. The microphone permission is removed. No NSUserTracking string, which is correct since ads are non-personalized only (AdBanner.tsx:79) and there's no ATT prompt. ITSAppUsesNonExemptEncryption is false. Sign in with Apple and push entitlements are present.

**Android permissions:** calendar, coarse and fine location, internet, vibrate, plus the unneeded defaults listed above. Release builds are signed by injected Gradle properties (android-release.sh:44-48). Without them the generated build.gradle would fall back to the debug key.

**What's needed for store accounts and signing:**
- **Apple Developer Program** (team 75Y3S5CV88). An Apple ID with Admin or App Manager role signed into Xcode on the Mac mini. Paid Apps agreement and banking/tax signed (for ad-free and tips). An APNs key uploaded to the Expo project (for push).
- **Google Play Console** ($25 one-time) with the app created and Play App Signing on. The upload key registered there must match `~/.archery-keys/upload.jks`. Also needed: Firebase project plus google-services.json, the FCM V1 service-account key uploaded to Expo, and the RevenueCat Android key.
- **AdMob** apps (ids already in app.json) and **RevenueCat** (iOS key set; Android key missing).

**What lives only on the Mac mini (single point of failure):**
- The Apple distribution certificate and its private key in the login keychain, made by Xcode automatic signing.
- The Xcode Apple ID session.
- `~/.archery-keys/upload.jks` and `upload.properties`: the Play upload key and its passwords.
- The `~/studio/archery-release` clone.
- Toolchain: Xcode 27, JDK 17 (Homebrew), Android SDK, Homebrew, CocoaPods.
- Any Expo/eas CLI login used for updates and credentials.

Back up the keystore and passwords off the machine. The Apple certificate can be re-created from the developer account if the machine is lost.

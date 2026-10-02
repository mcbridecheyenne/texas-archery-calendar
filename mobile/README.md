# Texas Archery Calendar — iPhone & Android app

One React Native (Expo) app that builds for both iPhone and Android. It reads the
same `/api/events` feed as the website, so all three always show the same schedule.

## What the app adds over the website

- **Going list (★):** mark the shoots you plan to attend. Saved on the phone.
- **Reminders:** a notification at 6 PM the evening before a starred shoot, and
  at 9 AM the day registration closes (when the host lists a closing date).
- **Add to Calendar:** puts the event into Apple/Google Calendar as an all-day event.
- **Directions, call and email the host:** tap the event's location, phone or email.
- **Works offline:** the last schedule it loaded stays on the phone for ranges with no signal.
- Month calendar and an Upcoming list, filtered by TFAA / Texas ASA / TSAA, in light and dark mode.

## Layout

```
mobile/
  App.tsx                 thin shell: just renders <CalendarScreen />
  config.ts               the website address the app reads events from
  src/features/calendar/  everything about the calendar (self-contained)
```

`src/features/calendar` only depends on React Native and four Expo libraries, takes
the server address as a prop, and keeps its saved data under its own `archeryCalendar.` keys.
To make it a tab in the scoring app later, copy the folder in and render
`<CalendarScreen apiBaseUrl={...} showHeader={false} />` as that tab's screen.

## First-time setup (on your Mac)

1. Install Node.js LTS from https://nodejs.org if `node -v` in Terminal doesn't print a version.
2. Check that `config.ts` has your live website address (the one on your Vercel dashboard).
3. In Terminal:
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

## TestFlight / App Store (iPhone)

```bash
npm install -g eas-cli
eas login                 # free account at expo.dev
eas init                  # links this folder to an Expo project (one time)
eas build -p ios          # builds in Expo's cloud; sign in with your Apple ID when asked
eas submit -p ios         # uploads the build to App Store Connect → TestFlight
```
Bundle ID: `com.cheyennemcbride.archerycalendar`.

## Google Play (Android)

```bash
eas build -p android      # makes the .aab file for Google Play
eas submit -p android
```
Needs a Google Play developer account ($25 one-time).

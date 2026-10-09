# Featured shoots

A paid spot at the top of the Tournaments list. Anyone signed in (usually a host club) can
feature any upcoming shoot, archer-added or collected from an organizer schedule, at the top
of one state's list or the "All states" list, for 7, 14 or 30 days. Up to three run at a
time in each spot and take turns at the top. Every card reads "Featured · promoted by
<name>", so paid placement never looks like an association's ranking. Decided 2026-10-09.

Anyone can turn featured shoots off, free: Account → App → "Hide featured shoots" (or the
"Hide" link on the block itself). Ad-free subscribers still see them unless they do that.

## How a purchase works

1. The archer opens a shoot's details → "Feature this shoot" (`src/features/featured/FeatureButton.tsx`),
   or taps "Feature it" right after adding a tournament. Signed-out archers go to sign in.
2. The sheet (`FeatureSheet.tsx`) shows the spot, the lengths that fit before the shoot,
   the store price, and the "promoted by" name. If the spot is full it says when theirs
   would start; if it's full until after the shoot, it won't sell.
3. Paying is a one-time in-app purchase through RevenueCat (`src/monetization/premium.tsx`,
   `buyFeature`). Product ids: `feature_state_7`, `feature_state_14`, `feature_state_30`,
   `feature_national_7`, `feature_national_14`, `feature_national_30`.
4. The app sends the store transaction id and the shoot to the `feature-shoot` edge function
   (`supabase/functions/feature-shoot`). It checks with RevenueCat's API that this customer
   really made that purchase, that the account is active, and that the shoot is upcoming,
   then creates the `featured_shoots` row (service role; the app can't write the table).
   If the phone loses signal between paying and that call, the purchase is kept on the
   phone and finished at the next launch (`finishPending`).
5. The owner gets a push for every new feature (same path as reports). A bad one is removed
   in the Table Editor by setting `status` to `removed`.

## Keeping features honest

- A feature ends when its paid days are up or when the shoot ends, whichever is first.
- Archer-added shoot deleted or removed by a moderator → a database trigger ends its features.
- Organizer-schedule shoot moved → the feature follows it; shoot gone from the feed for
  36 hours → the feature ends and the owner gets a push. The publish workflow
  (`.github/workflows/pages.yml`) calls the `featured-sync` function after every publish.
- "Shown N times · M opened" counters are kept by `count_featured` (anyone can count).

## Setting it up (owner)

1. App Store Connect → the app → In-App Purchases → create six **consumables** with the ids
   above. Suggested prices: state $4.99 / $8.99 / $14.99, nationwide $14.99 / $24.99 / $39.99
   for 7 / 14 / 30 days. Add a review screenshot of the sheet.
2. RevenueCat → Products → import the six products.
3. RevenueCat → Project settings → API keys → copy the **secret** key, then Supabase →
   Edge Functions → Secrets → add `REVENUECAT_SECRET_KEY`. (Never paste it in chat or GitHub.)
4. Run `supabase/migrations/20261009120000_featured_shoots.sql` in the SQL Editor.
5. Deploy both functions: `supabase functions deploy feature-shoot` and
   `supabase functions deploy featured-sync` (from `mobile/`, after `supabase link`).
6. Google Play: the same six products, when Android purchases are set up.

The website (`client/src/components/FeaturedShoots.tsx` on main) shows the Texas and
nationwide features above its list, read from Supabase with the public key.

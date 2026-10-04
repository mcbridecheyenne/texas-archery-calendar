# Texas club calendar feeds: what was checked

Checked on 2026-10-04 from GitHub Actions. Each club's homepage and its events,
calendar or schedule pages were read, looking for a public Google Calendar, an
`.ics` link, the WordPress "The Events Calendar" REST API
(`/wp-json/tribe/events/v1/events`) or a Squarespace events page (`?format=json`).
Facebook and Instagram were not looked at. Clubs were found through the TFAA club
list, the Texas ASA Federation club links, the TBOT host club pages and web searches.

"Upcoming shoots" counts entries the collector keeps (shoots from today on, after
skipping meetings, work days, classes, league nights and the like). The clubs marked
**used** are in `data/club-feeds.json`.

## Clubs with a usable feed

| Club | City | Site | Feed type | Feed URL | Upcoming shoots | Notes |
|---|---|---|---|---|---|---|
| Buffalo Field Archery Club (**used**) | Houston | https://buffalofield.org/ | tribe | https://buffalofield.org/wp-json/tribe/events/v1/events | 1 | Also offers `?ical=1` exports. Monthly 3D shoots in season. |
| Fort Grard Guns & Archery (**used**) | Weatherford | https://www.fortgrard.com/ | ics (Google Calendar) | https://calendar.google.com/calendar/ical/ube761ip2hg745mmckus74206o%40group.calendar.google.com/public/basic.ics | 7 | Busy calendar (4-H and homeschool practices, holidays); the filter keeps the SYWAT weekends, 3D and benefit shoots, and the Azle 4-H tournament. |
| Archery HQ (**used**) | New Braunfels | https://www.archeryhqtx.com/ | squarespace | https://www.archeryhqtx.com/events | 3 | SYWAT rounds and the Lonestar 600. League nights, ladies' nights and lessons are skipped. |
| Abilene Bowhunters Association (**used**) | Tuscola | https://www.abilenebowhunters.com/ | squarespace | https://www.abilenebowhunters.com/local-competitions | 0 | Monthly club shoots January to September (7 listed for 2026, all past); next season should appear on its own. |
| Permian Basin Archers Association (**used**) | Odessa | https://permianbasinarchers.com/ | squarespace | https://permianbasinarchers.com/schedules | 0 | Monthly shoots, last one listed was August 2026. |
| Brazos County Archery Club (**used**) | Bryan | https://www.brazoscountyarchery.com/ | ics (Google Calendar) | https://calendar.google.com/calendar/ical/brazoscountyarchery%40gmail.com/public/basic.ics | 0 | The calendar was kept up through December 2025 (monthly club shoots, ASA qualifiers) but has nothing for 2026. Worth asking the club whether it still uses it. |
| Archery Training Center | Austin | https://www.archerytrainingcenter.com/ | ics (Google Calendar) | public Google Calendar "ATCI Classes" | — | **Not used**: it is a class schedule that also holds students' personal entries. Its only tournaments are USA Archery events already listed elsewhere. |
| Texas 4-H District 2 (AgriLife) | — | https://d24-h.tamu.edu/ | tribe | https://d24-h.tamu.edu/wp-json/tribe/events/v1/events | 0 | **Not used**: a county extension calendar, not a club; nothing upcoming. |

## Clubs with no machine-readable feed

These publish their schedule as page text, a picture or flyer, a Wix events widget,
or only on Facebook. They are the clubs to ask about publishing a Google Calendar (or
sending shoots in for `data/manual-events.json`).

| Club | City | Site | What's there |
|---|---|---|---|
| Austin Archery Club | Austin | https://austinarcheryclub.com/ | WordPress; monthly 3D shoot described in page text, no events plugin. |
| Hill Country Bow Hunters | Liberty Hill | https://hillcountrybowhunters.com/ | WordPress (Elementor); 3D schedule as page text. |
| Irving Bowhunters Association | Dallas | https://www.ibatx.org/ | Wix; schedule page is text. |
| Cowtown Bowmen | Fort Worth | https://www.cowtownbowmen.com/ | Hand-built HTML schedule page. |
| Texans Archery Club / Texas Archery Academy | Dallas, Plano | https://texasarchery.info/ | WordPress; tournaments page is text, no events plugin. |
| Huaco Bowmen | Waco | https://huacobowmen.org/ | GoDaddy site; events page has no feed. |
| Cinnamon Creek Ranch | Roanoke | https://www.cinnamoncreekranch.com/ | Wix events (no public feed). |
| Tyler Archery Club | Tyler | https://tylerarcheryclub.com/ | WordPress/WooCommerce, no events API. |
| Fredericksburg 3D Archery | Fredericksburg | https://www.fredericksburg3darchery.org/ | Squarespace, but the schedule is page text (no events collection). |
| Leading Edge Archery | Boerne | https://leadingedgearchery.com/ | WordPress, no events API. |
| Buck & Doe's Mercantile | San Antonio | https://buckdoes.com/ | WordPress, no events API. |
| Collin County Bow Hunters | Collin County | https://collincountybowhunters.org/ | WordPress, no events plugin. |
| South Plains Archery Club | Lubbock | https://southplainsarchery.com/ | GoDaddy site, no feed. |
| Tejas Bowmen | Corpus Christi | https://tejasbowmen.com/ | No feed. |
| Baytown (Banana Bend) Archery Club | Baytown | https://baytownarcheryclub.com/ | GoDaddy site, no feed. bananabendarchery.club now redirects to an unrelated site. |
| Pearland Archery Club | Pearland | https://pearlandarcheryclub.com/ | GoDaddy "calendar" page is a text session list. |
| Legacy Archery DFW | Fort Worth | https://www.legacyarcherydfw.com/ | Squarespace with no events collection. |
| Arjun Archery Academy | Frisco | https://www.arjunarcheryacademy.com/ | Google Sites; upcoming tournaments in an embedded Google Sheet (not a calendar). |
| X10 Archery Academy | Houston | https://www.x10academy.com/ | Booking system calendar, no public feed. |
| Tejas JOAD Archery | Plano | https://tejasjoadarchery.com/ | No events page. |
| Arrow Minded Outdoors | Bulverde | https://arrowmindedoutdoors.com/ | GoDaddy site, no feed. |
| Dark Horse Archery | Orange Grove | https://darkhorse-archery.com/ | GoDaddy site, no feed. |
| Texas A&M Archery | College Station | https://tamuarchery.com/ | GoDaddy site, no feed. |
| Hunters Archery | — | https://huntersarchery.com/ | WordPress shop, no events API. |
| Archery Country | Houston | https://archerycountry.com/ | Shopify; events are sold as products. |
| TexArchery | — | https://texarchery.com/ | Shopify events page, no feed. |
| Viking Archery | Canyon Lake | https://viking-archery.com/ | Static events page. |
| Gateway Archery | Fort Worth | https://gatewayarchery.com/ | No feed. |
| Rio Grande Valley Shooting Center | Rio Hondo | https://rgvsc.com/ | No feed. |
| Central Texas Archery | Manor | https://centraltexasarchery.org/ | Static site (HTTPS broken), no calendar. |
| Texas Trophy Hunters Association | — | https://ttha.com/archery-tournament/ | WordPress, no events API. |
| TEXSAR archery shoot | — | https://www.texsar.org/archeryshoot/ | WordPress, no events API. |
| Traditional Bowhunters of Texas | — | https://www.tbot.org/ | Static schedule pages. |
| Elm Fork Shooting Sports | Dallas | https://elmfork.com/ | Answers automated requests with a challenge page. |
| The Carriage Archery Club | Houston | https://thecarriagehtx.com/ | Blocks automated requests (403). |
| Saddle River Range | Conroe | https://saddleriverrange.com/ | Blocks automated requests (403). |
| Holliday Creek Archery | Holliday | (Facebook only) | Its schedule is on the Archer County AgriLife calendar, which blocks automated requests (403). |
| Mesquite Archery Club | Terrell | https://www.mesquitearcheryclub.com/ | Site returned 404. |
| Archer's Haven | Canyon Lake | https://www.archershaven.org/ | Site unreachable. |
| Canadian River Gun & Archery Club | Borger | — | Only a map link listed. |
| Ollie Liner Center | Plainview | https://www.halecounty.org/ | County page. |
| Archers for Christ | Paris | — | No website found. |
| Palo Duro Bowhunters | Amarillo | — | No website found. |
| Panola Archery Club | Carthage | — | No website found. |
| Target Seekers | Lubbock | — | No website found. |
| Sherwood Archery | Bedias | https://sherwoodarchery.com/ | Empty page; listed site does not resolve. |
| Fredericksburg Archery Club | Fredericksburg | http://www.fredericksburgarcheryclub.com/ | Domain does not resolve. |
| Enduring Freedom Academy | San Antonio | — | No website found. |

The state associations (TFAA, Texas ASA Federation, TSAA) are already collected by
`api/_scrapers.ts`. Louisiana clubs on the TFAA list (Bayou Bowmen, North Caddo, Red
River Bowmen) were skipped for this Texas-only pass.

## Adding a club

Add an entry to `data/club-feeds.json`:

- Google Calendar: in the calendar's settings, "Public address in iCal format"
  (`https://calendar.google.com/calendar/ical/<id>/public/basic.ics`), `"feedType": "ics"`.
  The calendar must be public.
- WordPress with The Events Calendar: `https://<site>/wp-json/tribe/events/v1/events`,
  `"feedType": "tribe"`.
- Squarespace events page: the page URL, e.g. `https://<site>/events`, `"feedType": "squarespace"`.
- Any other `.ics` link: `"feedType": "ics"`.

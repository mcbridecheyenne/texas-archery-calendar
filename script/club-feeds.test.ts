// Tests for the club calendar parsers (no network).
//
//   node --experimental-strip-types --test script/club-feeds.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alreadyListed, clubEventsFromEntries, expandRRule, isArcheryShoot, organizationFor,
  parseIcs, squarespaceToEntries, tribeToEntries, type ClubFeed,
} from "../api/_clubFeeds.ts";

const TODAY = "2026-10-04";
const feed: ClubFeed = {
  club: "Example Bowmen", city: "Waco", state: "TX", organization: "Club shoots",
  feedType: "ics", url: "https://calendar.google.com/calendar/ical/x/public/basic.ics",
  siteUrl: "https://example.org/events",
};

const ics = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-TIMEZONE:America/Chicago", body.trim(), "END:VCALENDAR"].join("\r\n");

test("all-day event: DTEND is exclusive", () => {
  const [e] = parseIcs(ics(`
BEGIN:VEVENT
UID:a1
DTSTART;VALUE=DATE:20261017
DTEND;VALUE=DATE:20261019
SUMMARY:Fall 3D Shoot
LOCATION:Huaco Bowmen\\, 125 Lovers Leap Rd\\, Waco\\, TX 76705\\, USA
END:VEVENT`), TODAY);
  assert.equal(e.startDate, "2026-10-17");
  assert.equal(e.endDate, "2026-10-18");
  assert.equal(e.title, "Fall 3D Shoot");
  assert.equal(e.location, "Huaco Bowmen, 125 Lovers Leap Rd, Waco, TX 76705, USA");
});

test("UTC times become Central dates; folded lines are joined", () => {
  const [e] = parseIcs(ics(`
BEGIN:VEVENT
UID:a2
DTSTART:20261101T030000Z
DTEND:20261101T050000Z
SUMMARY:Night Shoot at the
  club
END:VEVENT`), TODAY);
  // 03:00 UTC on Nov 1 is 22:00 Oct 31 in Texas.
  assert.equal(e.startDate, "2026-10-31");
  assert.equal(e.endDate, "2026-10-31");
  assert.equal(e.title, "Night Shoot at the club");
});

test("TZID times stay local; a timed event ending at midnight ends that day", () => {
  const [e] = parseIcs(ics(`
BEGIN:VEVENT
UID:a3
DTSTART;TZID=America/Chicago:20261107T080000
DTEND;TZID=America/Chicago:20261108T000000
SUMMARY:TFAA Indoor
END:VEVENT`), TODAY);
  assert.equal(e.startDate, "2026-11-07");
  assert.equal(e.endDate, "2026-11-07");
});

test("monthly RRULE expands, honours EXDATE and moved occurrences", () => {
  const entries = parseIcs(ics(`
BEGIN:VEVENT
UID:series
DTSTART;VALUE=DATE:20260613
DTEND;VALUE=DATE:20260614
RRULE:FREQ=MONTHLY;BYDAY=2SA;COUNT=8
EXDATE;VALUE=DATE:20261114
SUMMARY:Club 3D Shoot
END:VEVENT
BEGIN:VEVENT
UID:series
RECURRENCE-ID;VALUE=DATE:20261212
DTSTART;VALUE=DATE:20261219
DTEND;VALUE=DATE:20261220
SUMMARY:Club 3D Shoot (moved)
END:VEVENT`), TODAY);
  const dates = entries.map((e) => e.startDate).sort();
  // Series: Jun 13, Jul 11, Aug 8, Sep 12, Oct 10, Nov 14 (excluded), Dec 12 (moved to 19), Jan 9.
  assert.deepEqual(dates, ["2026-10-10", "2026-12-19", "2027-01-09"]);
});

test("expandRRule weekly with BYDAY and UNTIL", () => {
  assert.deepEqual(
    expandRRule("FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20261018T000000Z", "2026-10-03", "2027-01-01"),
    ["2026-10-03", "2026-10-04", "2026-10-10", "2026-10-11", "2026-10-17", "2026-10-18"],
  );
  assert.deepEqual(expandRRule("FREQ=MONTHLY;BYDAY=-1SU;COUNT=2", "2026-10-25", "2027-12-31"), ["2026-10-25", "2026-11-29"]);
});

test("shoot keyword filter", () => {
  for (const t of ["Monthly 3D Shoot", "Texas ASA Qualifier", "SYWAT Field #3", "Fall Classic", "TBOT Winter Trad Shoot",
    "Indoor Vegas 300", "League Championship", "Halloween Field Fun Shoot", "Lonestar 600 Archery Tournament"]) {
    assert.ok(isArcheryShoot(t), t);
  }
  for (const t of ["Board Meeting", "Work Day", "Range Cleanup", "Tuesday League", "Beginner Class", "Range Closed",
    "Open House", "Club 3D Shoot - CANCELLED", "NO SHOOT IN JULY", "Youth Practice", "Christmas Party", ""]) {
    assert.ok(!isArcheryShoot(t), t);
  }
  // General calendars must mention archery.
  assert.ok(!isArcheryShoot("Rifle Match", true));
  assert.ok(isArcheryShoot("3D Archery Shoot", true));
});

test("organization from title", () => {
  assert.equal(organizationFor("Texas ASA Qualifier", "Club shoots"), "ASA");
  assert.equal(organizationFor("TFAA SYWAT Field #2", "Club shoots"), "NFAA");
  assert.equal(organizationFor("Club 3D", "Club shoots"), "Club shoots");
});

test("clubEventsFromEntries keeps upcoming shoots only and shapes them", () => {
  const entries = parseIcs(ics(`
BEGIN:VEVENT
UID:past
DTSTART;VALUE=DATE:20260901
SUMMARY:Old 3D Shoot
END:VEVENT
BEGIN:VEVENT
UID:meet
DTSTART;VALUE=DATE:20261020
SUMMARY:Board meeting
END:VEVENT
BEGIN:VEVENT
UID:cxl
DTSTART;VALUE=DATE:20261021
SUMMARY:3D Shoot
STATUS:CANCELLED
END:VEVENT
BEGIN:VEVENT
UID:good
DTSTART;VALUE=DATE:20261025
SUMMARY:Texas ASA Qualifier
LOCATION:Example Range\\, 1 Road\\, Liberty Hill\\, TX 78642
END:VEVENT`), TODAY);
  const out = clubEventsFromEntries(feed, entries, TODAY);
  assert.equal(out.length, 1);
  const [e] = out;
  assert.equal(e.source, "CLUB");
  assert.equal(e.feedName, "CLUB: Example Bowmen");
  assert.equal(e.organization, "ASA");
  assert.equal(e.city, "Liberty Hill");
  assert.equal(e.state, "TX");
  assert.equal(e.sourceUrl, "https://example.org/events");
  assert.match(e.id, /^club-/);
});

test("tribe REST rows", () => {
  const entries = tribeToEntries([
    {
      id: 42, title: "BFAC Halloween Field &#8211; Fun Shoot", url: "https://buffalofield.org/event/x/",
      start_date: "2026-10-31 08:00:00", end_date: "2026-10-31 14:00:00",
      venue: { venue: "Buffalo Field Archery Club", address: "13155 Clay Rd", city: "Houston", state: "TX" },
    },
    { id: 43, title: "Work Day", start_date: "2026-11-01 08:00:00", end_date: "2026-11-01 12:00:00", venue: [] },
  ]);
  const out = clubEventsFromEntries({ ...feed, feedType: "tribe", siteUrl: undefined }, entries, TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "BFAC Halloween Field – Fun Shoot");
  assert.equal(out[0].city, "Houston");
  assert.equal(out[0].sourceUrl, "https://buffalofield.org/event/x/");
});

test("Squarespace events page", () => {
  const entries = squarespaceToEntries({
    website: { timeZone: "America/Chicago" },
    upcoming: [
      // Fri 6pm to Sun 2pm Central
      { id: "s1", title: "SYWAT #1", startDate: Date.parse("2026-10-23T23:00:00Z"), endDate: Date.parse("2026-10-25T19:00:00Z"), fullUrl: "/events/sywat-1" },
      // A league season spanning months
      { id: "s2", title: "Fall Indoor League Nights", startDate: Date.parse("2026-09-18T00:00:00Z"), endDate: Date.parse("2027-02-26T01:00:00Z"), fullUrl: "/events/league" },
      { id: "s3", title: "Ladies Archery- October Event", startDate: Date.parse("2026-10-17T17:00:00Z"), endDate: Date.parse("2026-10-17T19:00:00Z") },
    ],
  }, "https://www.example.com/events");
  const out = clubEventsFromEntries({ ...feed, feedType: "squarespace", siteUrl: undefined }, entries, TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].startDate, "2026-10-23");
  assert.equal(out[0].endDate, "2026-10-25");
  assert.equal(out[0].organization, "NFAA");
  assert.equal(out[0].sourceUrl, "https://www.example.com/events/sywat-1");
});

test("weekly series are skipped; back-to-back days with one title are joined", () => {
  const entries = parseIcs(ics(`
BEGIN:VEVENT
UID:w
DTSTART;TZID=America/Chicago:20261006T180000
DTEND;TZID=America/Chicago:20261006T200000
RRULE:FREQ=WEEKLY;BYDAY=TU
SUMMARY:Tuesday 3D Shoot
END:VEVENT
BEGIN:VEVENT
UID:f
DTSTART;TZID=America/Chicago:20261106T180000
DTEND;TZID=America/Chicago:20261106T210000
SUMMARY:SYWAT 6pm
END:VEVENT
BEGIN:VEVENT
UID:s
DTSTART;TZID=America/Chicago:20261107T080000
DTEND;TZID=America/Chicago:20261107T170000
SUMMARY:SYWAT
END:VEVENT
BEGIN:VEVENT
UID:u
DTSTART;TZID=America/Chicago:20261108T080000
DTEND;TZID=America/Chicago:20261108T170000
SUMMARY:SYWAT
END:VEVENT`), TODAY);
  const out = clubEventsFromEntries(feed, entries, TODAY);
  assert.deepEqual(out.map((e) => [e.name, e.startDate, e.endDate]), [["SYWAT", "2026-11-06", "2026-11-08"]]);
});

test("alreadyListed matches association rows by date and city or club name", () => {
  const [e] = clubEventsFromEntries(feed, parseIcs(ics(`
BEGIN:VEVENT
UID:q
DTSTART;VALUE=DATE:20261025
SUMMARY:3D Shoot
END:VEVENT`), TODAY), TODAY);
  assert.ok(alreadyListed(e, [{ startDate: "2026-10-25", name: "Huaco", location: "Waco, TX", city: "Waco" }]));
  assert.ok(alreadyListed(e, [{ startDate: "2026-10-25", name: "Example Bowmen", location: null, city: null }]));
  assert.ok(!alreadyListed(e, [{ startDate: "2026-10-26", name: "Example Bowmen", location: null, city: "Waco" }]));
});

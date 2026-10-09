// Keeps features of automatically collected shoots in step with the organizer feed.
//
// Called after every publish of the feed (.github/workflows/pages.yml) and safe to call any
// time: it only reads the public events-usa.json and tidies featured_shoots.
//  - A shoot that moved dates: the feature follows it (snapshot updated).
//  - A shoot missing from the feed: noted; after 36 hours still missing, the feature ends and
//    the owner gets a push, same as a report. The feed keeps a source's last good events when
//    a site is down, so a real disappearance is the organizer cancelling or renaming it.
// Archer-added shoots are handled by a database trigger instead (deleted or removed = ended).
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS, json } from "../_shared/featured.ts";

const FEED_URL = "https://mcbridecheyenne.github.io/texas-archery-calendar/events-usa.json";
const GRACE_MS = 36 * 3600 * 1000;

const nameKey = (name: string) => name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const res = await fetch(`${FEED_URL}?t=${Date.now()}`, { headers: { Accept: "application/json" } });
  if (!res.ok) return json({ error: `Feed returned ${res.status}` }, 502);
  const feed = await res.json();
  const events: any[] = Array.isArray(feed?.events) ? feed.events : [];
  if (events.length < 20) return json({ error: "Feed looks empty; not touching anything." }, 502);

  const byId = new Map(events.map((e) => [e.id, e]));
  const byKey = new Map(events.map((e) => [`${e.source}|${nameKey(e.name)}|${e.startDate}`, e]));
  const byName = new Map<string, any[]>();
  for (const e of events) byName.set(nameKey(e.name), [...(byName.get(nameKey(e.name)) ?? []), e]);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: live, error } = await admin
    .from("featured_shoots")
    .select("id, event_id, event_source, event_name, event_start, event_end, missing_since, buyer_name, spot")
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .not("event_source", "eq", "USER");
  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  let followed = 0, ended = 0, missing = 0;
  for (const f of live ?? []) {
    // Same id, else same source + name + start (a renamed shoot gets a new id), else same
    // name from the same source within a month (the organizer moved it).
    const found =
      byId.get(f.event_id) ??
      byKey.get(`${f.event_source}|${nameKey(f.event_name)}|${f.event_start}`) ??
      (byName.get(nameKey(f.event_name)) ?? []).find(
        (e) => e.source === f.event_source && Math.abs(new Date(e.startDate).getTime() - new Date(f.event_start).getTime()) < 31 * 86400 * 1000
      );
    if (found) {
      const patch: Record<string, unknown> = {};
      if (f.missing_since) patch.missing_since = null;
      if (found.id !== f.event_id) patch.event_id = found.id;
      if (found.startDate !== f.event_start) patch.event_start = found.startDate;
      if ((found.endDate || found.startDate) !== f.event_end) patch.event_end = found.endDate || found.startDate;
      if (found.name !== f.event_name) patch.event_name = String(found.name).slice(0, 160);
      if (Object.keys(patch).length) {
        await admin.from("featured_shoots").update(patch).eq("id", f.id);
        followed++;
      }
      continue;
    }
    if (!f.missing_since) {
      await admin.from("featured_shoots").update({ missing_since: new Date().toISOString() }).eq("id", f.id);
      missing++;
      continue;
    }
    if (now - new Date(f.missing_since).getTime() < GRACE_MS) {
      missing++;
      continue;
    }
    await admin.from("featured_shoots").update({ status: "ended", ended_reason: "shoot left the organizer schedule" }).eq("id", f.id);
    ended++;
    const { data: admins } = await admin.from("app_admins").select("user_id");
    for (const a of admins ?? []) {
      await admin.rpc("send_push", {
        to_user: a.user_id,
        msg_title: "Featured shoot ended",
        msg_body: `${f.event_name} (${f.spot}, promoted by ${f.buyer_name}) left the organizer schedule, so its feature ended.`,
        msg_data: { type: "featured", featuredId: f.id },
      });
    }
  }
  return json({ ok: true, checked: live?.length ?? 0, followed, missing, ended });
});

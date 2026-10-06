// Keeps a copy of My Shoots (the starred shoots) in the signed-in archer's account, so
// signing in on a new phone brings them back, "Just me" ones included. Rows are in the
// "going" table (supabase/schema.sql); "Just me" rows can only be read by their owner.
//
// The phone stays the main copy. The first time an archer signs in on a phone, the two
// lists are combined (nothing is removed from either). After that, starring and un-starring
// on this phone updates the account, and anything starred here that the account is
// missing gets saved to it.
import { addStarsFromAccount, movedStars, starredShoots } from "../calendar";
import * as api from "./api";
import type { MyGoingRow } from "./api";

/** Brings the account and this phone in step, and returns the account's rows afterwards. */
export async function syncMyShoots(me: string): Promise<MyGoingRow[]> {
  const rows = await api.fetchMyGoing(me);
  const byId = new Map(rows.map((r) => [r.eventId, r]));

  // 1. Shoots whose date or place changed get a new id (see calendar/goingStore.ts). Move
  //    the account's row to the new id too, keeping who can see it, so friends still see it.
  const moved = await movedStars();
  const starred = new Map((await starredShoots()).map((s) => [s.id, s]));
  for (const row of rows) {
    const to = moved[row.eventId];
    if (!to) continue;
    try {
      const shoot = starred.get(to);
      if (shoot && !byId.has(to)) {
        await api.shareGoing(me, shoot, row.visibility);
        byId.set(to, { eventId: to, eventName: shoot.name, eventDate: shoot.startDate, visibility: row.visibility });
      }
      await api.unshareGoing(me, row.eventId);
      byId.delete(row.eventId);
    } catch {
      // Try again next time.
    }
  }

  // 2. First sign-in on this phone: bring back the stars saved to the account.
  await addStarsFromAccount(
    me,
    Array.from(byId.values()).map((r) => ({ id: r.eventId, name: r.eventName, startDate: r.eventDate }))
  );

  // 3. Save stars that are only on this phone to the account, as "Just me".
  const missing = (await starredShoots()).filter((s) => !byId.has(s.id));
  if (missing.length) {
    try {
      await api.saveGoingPrivately(me, missing);
      for (const s of missing) {
        byId.set(s.id, { eventId: s.id, eventName: s.name, eventDate: s.startDate, visibility: "private" });
      }
    } catch {
      // Until schema.sql is re-run in Supabase the database turns down "Just me" rows.
      // Nothing breaks: they stay on the phone, like before. Tried again next time.
    }
  }

  return Array.from(byId.values());
}

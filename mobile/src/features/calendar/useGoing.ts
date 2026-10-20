// The archer's "Going" list, saved on the phone. Marking an event sets reminders.
// The list itself lives in goingStore.ts, so every screen using this hook stays in step.
import { useCallback, useEffect, useState } from "react";
import { loadMaybes, loadPickedDays, loadStars, reloadStars, setDays, setMaybe, setStar, subscribeStars, type PickedDays } from "./goingStore";
import { cleanDays, fmtDays } from "./dates";
import { maybeAskForReview } from "./review";
import type { TournamentEvent } from "./types";

export interface GoingState {
  going: Set<string>;
  /** True for any starred shoot, "Maybe" ones included. */
  isGoing: (id: string) => boolean;
  /** True when a starred shoot is marked "Maybe" rather than "Going". */
  isMaybe: (id: string) => boolean;
  /** On a shoot of more than one day: the days they're going. Undefined means every day. */
  daysFor: (id: string) => string[] | undefined;
  // Resolves to a short message to show the archer, or null. Pass want to star (true) or
  // un-star (false) instead of flipping whatever it is now, days for the days they picked,
  // and maybe to star it as "Maybe".
  toggle: (event: TournamentEvent, want?: boolean, days?: string[], maybe?: boolean) => Promise<string | null>;
  /** Switches a starred shoot between "Going" and "Maybe". Resolves null if it isn't starred. */
  changeMaybe: (event: TournamentEvent, maybe: boolean) => Promise<boolean | null>;
  /** Changes which days of a starred shoot they're going. Resolves to the days saved (undefined = every day). */
  changeDays: (event: TournamentEvent, days: string[]) => Promise<string[] | undefined | null>;
  reload: () => Promise<void>; // re-read the saved list (e.g. when another tab changed it)
}

export function useGoing(): GoingState {
  const [going, setGoing] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<PickedDays>({});
  const [maybes, setMaybes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    const unsubscribe = subscribeStars((ids, days, maybe) => {
      if (!live) return;
      setGoing(ids);
      setPicked(days);
      setMaybes(maybe);
    });
    loadStars().then((ids) => live && setGoing(ids));
    loadPickedDays().then((days) => live && setPicked(days));
    loadMaybes().then((m) => live && setMaybes(m));
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const reload = useCallback(async () => {
    await reloadStars();
  }, []);

  const isGoing = useCallback((id: string) => going.has(id), [going]);
  const isMaybe = useCallback((id: string) => maybes.has(id), [maybes]);
  const daysFor = useCallback((id: string) => picked[id], [picked]);
  const changeMaybe = useCallback((event: TournamentEvent, maybe: boolean) => setMaybe(event, maybe), []);
  const changeDays = useCallback((event: TournamentEvent, days: string[]) => setDays(event, days), []);

  const toggle = useCallback(
    async (event: TournamentEvent, want?: boolean, days?: string[], maybe?: boolean) => {
      const adding = want ?? !going.has(event.id);
      const result = await setStar(event, adding, days, maybe);
      if (!result.starred || !result.changed) return null;
      maybeAskForReview(result.count);
      const which = cleanDays(days, event.startDate, event.endDate);
      const list = maybe ? "Maybe" : "Going";
      const added = which ? `Added to ${list} (${fmtDays(which)})` : `Added to ${list}`;
      return result.reminders > 0 ? `${added}. You'll get a reminder the evening before.` : `${added}.`;
    },
    [going]
  );

  return { going, isGoing, isMaybe, daysFor, toggle, changeMaybe, changeDays, reload };
}

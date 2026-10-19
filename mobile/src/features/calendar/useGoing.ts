// The archer's "Going" list, saved on the phone. Marking an event sets reminders.
// The list itself lives in goingStore.ts, so every screen using this hook stays in step.
import { useCallback, useEffect, useState } from "react";
import { loadPickedDays, loadStars, reloadStars, setDays, setStar, subscribeStars, type PickedDays } from "./goingStore";
import { cleanDays, fmtDays } from "./dates";
import { maybeAskForReview } from "./review";
import type { TournamentEvent } from "./types";

export interface GoingState {
  going: Set<string>;
  isGoing: (id: string) => boolean;
  /** On a shoot of more than one day: the days they're going. Undefined means every day. */
  daysFor: (id: string) => string[] | undefined;
  // Resolves to a short message to show the archer, or null. Pass want to star (true) or
  // un-star (false) instead of flipping whatever it is now, and days for the days they picked.
  toggle: (event: TournamentEvent, want?: boolean, days?: string[]) => Promise<string | null>;
  /** Changes which days of a starred shoot they're going. Resolves to the days saved (undefined = every day). */
  changeDays: (event: TournamentEvent, days: string[]) => Promise<string[] | undefined | null>;
  reload: () => Promise<void>; // re-read the saved list (e.g. when another tab changed it)
}

export function useGoing(): GoingState {
  const [going, setGoing] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<PickedDays>({});

  useEffect(() => {
    let live = true;
    const unsubscribe = subscribeStars((ids, days) => {
      if (!live) return;
      setGoing(ids);
      setPicked(days);
    });
    loadStars().then((ids) => live && setGoing(ids));
    loadPickedDays().then((days) => live && setPicked(days));
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const reload = useCallback(async () => {
    await reloadStars();
  }, []);

  const isGoing = useCallback((id: string) => going.has(id), [going]);
  const daysFor = useCallback((id: string) => picked[id], [picked]);
  const changeDays = useCallback((event: TournamentEvent, days: string[]) => setDays(event, days), []);

  const toggle = useCallback(
    async (event: TournamentEvent, want?: boolean, days?: string[]) => {
      const adding = want ?? !going.has(event.id);
      const result = await setStar(event, adding, days);
      if (!result.starred || !result.changed) return null;
      maybeAskForReview(result.count);
      const which = cleanDays(days, event.startDate, event.endDate);
      const added = which ? `Added to Going (${fmtDays(which)})` : "Added to Going";
      return result.reminders > 0 ? `${added}. You'll get a reminder the evening before.` : `${added}.`;
    },
    [going]
  );

  return { going, isGoing, daysFor, toggle, changeDays, reload };
}

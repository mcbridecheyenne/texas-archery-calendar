// The archer's "Going" list, saved on the phone. Marking an event sets reminders.
// The list itself lives in goingStore.ts, so every screen using this hook stays in step.
import { useCallback, useEffect, useState } from "react";
import { loadStars, reloadStars, setStar, subscribeStars } from "./goingStore";
import { maybeAskForReview } from "./review";
import type { TournamentEvent } from "./types";

export interface GoingState {
  going: Set<string>;
  isGoing: (id: string) => boolean;
  // Resolves to a short message to show the archer, or null. Pass want to star (true) or
  // un-star (false) instead of flipping whatever it is now.
  toggle: (event: TournamentEvent, want?: boolean) => Promise<string | null>;
  reload: () => Promise<void>; // re-read the saved list (e.g. when another tab changed it)
}

export function useGoing(): GoingState {
  const [going, setGoing] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    const unsubscribe = subscribeStars((ids) => live && setGoing(ids));
    loadStars().then((ids) => live && setGoing(ids));
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const reload = useCallback(async () => {
    await reloadStars();
  }, []);

  const isGoing = useCallback((id: string) => going.has(id), [going]);

  const toggle = useCallback(
    async (event: TournamentEvent, want?: boolean) => {
      const adding = want ?? !going.has(event.id);
      const result = await setStar(event, adding);
      if (!result.starred || !result.changed) return null;
      maybeAskForReview(result.count);
      return result.reminders > 0
        ? "Added to Going. You'll get a reminder the evening before."
        : "Added to Going.";
    },
    [going]
  );

  return { going, isGoing, toggle, reload };
}

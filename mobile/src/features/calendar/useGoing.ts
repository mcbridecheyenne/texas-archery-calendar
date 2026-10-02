// The archer's "Going" list, saved on the phone. Marking an event sets reminders.
import { useCallback, useEffect, useState } from "react";
import { cancelRemindersFor, scheduleRemindersFor } from "./reminders";
import { readJSON, writeJSON } from "./storage";
import type { TournamentEvent } from "./types";

const KEY = "going.v1";

export interface GoingState {
  going: Set<string>;
  isGoing: (id: string) => boolean;
  // Resolves to a short message to show the archer, or null.
  toggle: (event: TournamentEvent) => Promise<string | null>;
  reload: () => Promise<void>; // re-read the saved list (e.g. when another tab changed it)
}

export function useGoing(): GoingState {
  const [going, setGoing] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const ids = await readJSON<string[]>(KEY);
    if (Array.isArray(ids)) setGoing(new Set(ids));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const isGoing = useCallback((id: string) => going.has(id), [going]);

  const toggle = useCallback(
    async (event: TournamentEvent) => {
      const adding = !going.has(event.id);
      const next = new Set(going);
      if (adding) next.add(event.id);
      else next.delete(event.id);
      setGoing(next);
      await writeJSON(KEY, Array.from(next));

      if (!adding) {
        await cancelRemindersFor(event.id);
        return null;
      }
      try {
        const count = await scheduleRemindersFor(event);
        return count > 0
          ? "Added to Going. You'll get a reminder the evening before."
          : "Added to Going.";
      } catch {
        return "Added to Going.";
      }
    },
    [going]
  );

  return { going, isGoing, toggle, reload };
}

// Loads the live featured shoots once per launch (and on pull-to-refresh), keeps the free
// "Hide featured shoots" switch, and opens the "Feature this shoot" sheet from anywhere.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { marketplaceConfigured } from "../../lib/supabase";
import type { TournamentEvent } from "../calendar";
import { fetchFeatured, finishPending } from "./api";
import { isLive, type FeaturedShoot } from "./types";

const HIDE_KEY = "featured.hidden";

export interface FeaturedState {
  enabled: boolean; // Supabase is set up, so features can exist
  featured: FeaturedShoot[]; // live and queued, every spot
  live: FeaturedShoot[]; // showing right now
  hidden: boolean; // the archer turned featured shoots off (free, in Account)
  setHidden: (on: boolean) => void;
  refresh: () => Promise<void>;
  /** A per-launch shuffle so the three in a spot take turns at the top. */
  order: (list: FeaturedShoot[]) => FeaturedShoot[];
  /** Live features for one shoot (it can be featured in more than one spot). */
  forEvent: (event: Pick<TournamentEvent, "id" | "source" | "name" | "startDate">) => FeaturedShoot[];
  sheetEvent: TournamentEvent | null; // the "Feature this shoot" sheet, when open
  openSheet: (event: TournamentEvent) => void;
  closeSheet: () => void;
}

const Ctx = createContext<FeaturedState>({
  enabled: false,
  featured: [],
  live: [],
  hidden: false,
  setHidden: () => {},
  refresh: async () => {},
  order: (l) => l,
  forEvent: () => [],
  sheetEvent: null,
  openSheet: () => {},
  closeSheet: () => {},
});

export function useFeatured(): FeaturedState {
  return useContext(Ctx);
}

const nameKey = (name: string) => name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

export function FeaturedProvider({ children }: { children: ReactNode }) {
  const enabled = marketplaceConfigured;
  const [featured, setFeatured] = useState<FeaturedShoot[]>([]);
  const [hidden, setHiddenState] = useState(false);
  const [sheetEvent, setSheetEvent] = useState<TournamentEvent | null>(null);
  const seed = useRef(Math.random());

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setFeatured(await fetchFeatured());
    } catch {
      // Keep whatever we had; the list works without features.
    }
  }, [enabled]);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY)
      .then((v) => setHiddenState(v === "1"))
      .catch(() => {});
    // Finish a purchase that was paid for but not placed yet, then load.
    finishPending().finally(refresh);
  }, [refresh]);

  const setHidden = useCallback((on: boolean) => {
    setHiddenState(on);
    AsyncStorage.setItem(HIDE_KEY, on ? "1" : "0").catch(() => {});
  }, []);

  const live = useMemo(() => featured.filter((f) => isLive(f)), [featured]);

  // Rotation: a stable shuffle for this launch, so the same three don't always sit in the same order.
  const order = useCallback(
    (list: FeaturedShoot[]) => {
      const rank = (f: FeaturedShoot) => {
        let h = 0;
        const s = f.id + seed.current;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return h;
      };
      return [...list].sort((a, b) => rank(a) - rank(b));
    },
    []
  );

  const forEvent = useCallback(
    (event: Pick<TournamentEvent, "id" | "source" | "name" | "startDate">) => {
      const key = nameKey(event.name);
      return live.filter((f) => f.eventId === event.id || (f.eventSource === event.source && f.eventStart === event.startDate && nameKey(f.eventName) === key));
    },
    [live]
  );

  const openSheet = useCallback((event: TournamentEvent) => setSheetEvent(event), []);
  const closeSheet = useCallback(() => setSheetEvent(null), []);

  const value = useMemo<FeaturedState>(
    () => ({ enabled, featured, live, hidden, setHidden, refresh, order, forEvent, sheetEvent, openSheet, closeSheet }),
    [enabled, featured, live, hidden, setHidden, refresh, order, forEvent, sheetEvent, openSheet, closeSheet]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

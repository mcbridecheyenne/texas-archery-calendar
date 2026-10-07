// The archer's home state. The calendar's state filter starts on it, and the Texas-only
// scholarship donation line checks it. Kept on the phone so it works without an account,
// and copied to the profile when they sign up (D3).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasCachedEvents } from "../features/calendar";
import { readJSON, writeJSON } from "../features/calendar/storage";
import { useAuth } from "./auth";

const KEY = "homeState";
// Set the first time this version runs, so only phones that already had a saved schedule
// before the USA update get the Texas shortcut (not one that just downloaded it).
const SEEN_KEY = "homeStateSeen";

interface HomeStateValue {
  ready: boolean; // finished reading the phone
  homeState: string | null; // two-letter code; null until they pick one
  setHomeState: (code: string) => Promise<void>;
}

const Ctx = createContext<HomeStateValue | null>(null);

export function useHomeState(): HomeStateValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHomeState must be used inside <HomeStateProvider>");
  return ctx;
}

export function HomeStateProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [ready, setReady] = useState(false);
  const [homeState, setLocal] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let saved = await readJSON<string>(KEY);
      // People who used the Texas app before the USA update keep opening on Texas.
      if (!(await readJSON<boolean>(SEEN_KEY))) {
        await writeJSON(SEEN_KEY, true);
        if (!saved && (await hasCachedEvents())) {
          saved = "TX";
          await writeJSON(KEY, saved);
        }
      }
      setLocal(saved);
      setReady(true);
    })();
  }, []);

  // Signing in on a new phone brings the home state from the profile.
  const profileState = profile?.home_state ?? null;
  useEffect(() => {
    if (!ready || !profileState || profileState === homeState) return;
    setLocal(profileState);
    writeJSON(KEY, profileState);
    // Only when the profile changes; picking a new state locally is saved to the profile by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profileState]);

  const setHomeState = useCallback(async (code: string) => {
    setLocal(code);
    await writeJSON(KEY, code);
  }, []);

  const value = useMemo(() => ({ ready, homeState, setHomeState }), [ready, homeState, setHomeState]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

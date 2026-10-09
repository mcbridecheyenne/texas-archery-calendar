// "Show featured shoots": anyone can turn the paid Featured cards off, for free. Saved on the
// phone and shared by every screen (the Account switch and the Tournaments list).
import { useEffect, useState } from "react";
import { readJSON, writeJSON } from "../calendar/storage";

const KEY = "showFeatured";
let current = true;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();

export function setShowFeatured(on: boolean) {
  current = on;
  loaded = true;
  writeJSON(KEY, on);
  listeners.forEach((fn) => fn(on));
}

export function useShowFeatured(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(current);
  useEffect(() => {
    listeners.add(setOn);
    if (!loaded) {
      readJSON<boolean>(KEY).then((saved) => {
        loaded = true;
        current = saved !== false;
        listeners.forEach((fn) => fn(current));
      });
    }
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return [on, setShowFeatured];
}

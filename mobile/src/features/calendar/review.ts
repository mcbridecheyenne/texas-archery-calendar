// Asks for an App Store / Play Store rating once, right after the archer stars their
// third shoot. It's the phone's own rating popup (no popup of ours), and the phone
// itself may decide not to show it. We only ask once per app version.
import Constants from "expo-constants";
import * as StoreReview from "expo-store-review";
import { readJSON, writeJSON } from "./storage";

const KEY = "reviewAsked.v1"; // the app version we last asked in
const STARS_BEFORE_ASKING = 3;

let askedThisRun = false;

export async function maybeAskForReview(starredCount: number): Promise<void> {
  if (askedThisRun || starredCount < STARS_BEFORE_ASKING) return;
  try {
    const version = Constants.expoConfig?.version ?? "unknown";
    if ((await readJSON<string>(KEY)) === version) return;
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;
    askedThisRun = true;
    await writeJSON(KEY, version);
    // Give the "Added to Going" message a moment so the two don't land on top of each other.
    setTimeout(() => StoreReview.requestReview().catch(() => {}), 1200);
  } catch {
    // A rating request is never worth an error.
  }
}

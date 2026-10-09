// The rules for turning an Apple purchase into a featured shoot, kept free of Deno and
// network code so they can be tested on their own (see logic.test.ts).

export type Spot = string; // two-letter state, or "ALL" for the nationwide list

export interface FeatureProduct {
  scope: "state" | "all";
  days: 7 | 14 | 30;
}

// The six one-time purchases in App Store Connect (and later Google Play).
export const PRODUCTS: Record<string, FeatureProduct> = {
  feature_state_7: { scope: "state", days: 7 },
  feature_state_14: { scope: "state", days: 14 },
  feature_state_30: { scope: "state", days: 30 },
  feature_all_7: { scope: "all", days: 7 },
  feature_all_14: { scope: "all", days: 14 },
  feature_all_30: { scope: "all", days: 30 },
};

export interface ClaimRequest {
  productId: string;
  transactionId: string;
  appUserId: string;
  eventId: string;
  spot: Spot;
}

export interface ShootFacts {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  source: string;
  city: string | null;
}

/** A purchase as RevenueCat lists it under subscriber.non_subscriptions[productId]. */
export interface StorePurchase {
  id: string;
  store_transaction_id?: string;
  purchase_date?: string;
}

export function parseClaim(body: unknown): ClaimRequest | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
  const productId = str(b.productId, 80);
  const transactionId = str(b.transactionId, 200);
  const appUserId = str(b.appUserId, 200);
  const eventId = str(b.eventId, 200);
  const spot = str(b.spot, 3)?.toUpperCase() ?? null;
  if (!productId || !transactionId || !appUserId || !eventId || !spot) return "Something was missing from the request.";
  const product = PRODUCTS[productId];
  if (!product) return "That isn't a featured-shoot purchase.";
  if (product.scope === "all" && spot !== "ALL") return "That purchase is for the All states list.";
  if (product.scope === "state" && !/^[A-Z]{2}$/.test(spot)) return "Pick a state for that purchase.";
  return { productId, transactionId, appUserId, eventId, spot };
}

/** The matching purchase in RevenueCat's list, or null. */
export function findPurchase(list: StorePurchase[] | undefined, transactionId: string): StorePurchase | null {
  return (list ?? []).find((p) => p.store_transaction_id === transactionId || p.id === transactionId) ?? null;
}

/** "Today" for archers: the date in US Central time. */
export function centralToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

/** When a feature for this shoot must end at the latest: midnight Central after its last day (06:00 UTC is safe all year). */
export function shootOverAt(endDate: string): Date {
  const [y, m, d] = endDate.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d + 1, 6, 0, 0));
}

/** The feature's start and end, or why it can't run. */
export function featureWindow(
  shoot: ShootFacts,
  days: number,
  nextStart: Date,
  now: Date
): { startsAt: Date; endsAt: Date } | string {
  if (shoot.endDate < centralToday(now)) return "That shoot is already over.";
  const start = nextStart.getTime() > now.getTime() ? nextStart : now;
  const fullLength = new Date(start.getTime() + days * 86_400_000);
  const over = shootOverAt(shoot.endDate);
  const endsAt = fullLength < over ? fullLength : over;
  if (endsAt.getTime() - start.getTime() < 60 * 60 * 1000) {
    return "There's no open featured place before this shoot ends.";
  }
  return { startsAt: start, endsAt };
}

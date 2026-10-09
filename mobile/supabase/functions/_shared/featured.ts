// Shared by the feature-shoot and featured-sync edge functions.

export const PRODUCTS: Record<string, { placement: "state" | "national"; days: 7 | 14 | 30 }> = {
  feature_state_7: { placement: "state", days: 7 },
  feature_state_14: { placement: "state", days: 14 },
  feature_state_30: { placement: "state", days: 30 },
  feature_national_7: { placement: "national", days: 7 },
  feature_national_14: { placement: "national", days: 14 },
  feature_national_30: { placement: "national", days: 30 },
};

// Up to this many features run at once in each spot (a state, or "All states").
export const SPOT_SIZE = 3;

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/** Midnight UTC after the shoot's last day: a feature never outlives its shoot. */
export function dayAfter(isoDate: string): Date {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * When a new feature can start in a spot: now if fewer than SPOT_SIZE are live or queued,
 * otherwise when enough of them have ended for one to fit.
 */
export function nextStart(endsAtOfOthers: string[], now = new Date()): Date {
  const ends = endsAtOfOthers.map((s) => new Date(s)).filter((d) => d > now).sort((a, b) => a.getTime() - b.getTime());
  if (ends.length < SPOT_SIZE) return now;
  return ends[ends.length - SPOT_SIZE];
}

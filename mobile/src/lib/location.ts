// Approximate locations for the marketplace distance filter and the Tournaments tab's
// "Near me" choice. Everything here is rounded
// to about 3 miles, and nothing is tracked in the background.
import * as Location from "expo-location";

export interface Coords {
  lat: number;
  lng: number;
}

// 0.05° is about 3.5 miles north–south: close enough for "within 25 miles", far enough
// that a listing never shows where the seller lives.
function round(c: Coords): Coords {
  return { lat: Math.round(c.lat * 20) / 20, lng: Math.round(c.lng * 20) / 20 };
}

// Where the phone is right now, roughly. Asks for "while using the app" permission the
// first time; returns null if the person says no or the phone can't tell.
// { ask: false } never shows the permission question: it only works if they already said yes.
export async function approxHere({ ask = true }: { ask?: boolean } = {}): Promise<Coords | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain && ask) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return round({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  } catch {
    return null;
  }
}

// A typed place such as "Wichita Falls" or "Wichita Falls, TX". Returns null when the phone
// can't look it up.
export async function placeCoords(place: string | null | undefined): Promise<Coords | null> {
  const found = await lookUpPlace(place);
  return found === "error" ? null : found;
}

// Same as placeCoords, but says "error" when the lookup itself failed (no signal, or the
// phone's map service asked us to slow down) instead of "no such place", so a caller that
// looks up lots of towns knows to try that one again later.
export async function lookUpPlace(place: string | null | undefined): Promise<Coords | null | "error"> {
  const text = (place ?? "").trim();
  if (!text) return null;
  try {
    const [hit] = await Location.geocodeAsync(text);
    return hit ? round({ lat: hit.latitude, lng: hit.longitude }) : null;
  } catch {
    return "error";
  }
}

// The state a spot is in, as the phone words it ("TX" on iPhone, "Texas" on Android).
// Null when the phone can't tell.
export async function regionAt(c: Coords): Promise<string | null> {
  try {
    const [hit] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
    return hit?.region ?? null;
  } catch {
    return null;
  }
}

export function milesBetween(a: Coords, b: Coords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// A lat/lng box that contains every point within `miles` of `c`, for a quick database filter.
export function boxAround(c: Coords, miles: number): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = miles / 69;
  const dLng = miles / (69 * Math.max(Math.cos((c.lat * Math.PI) / 180), 0.01));
  return { minLat: c.lat - dLat, maxLat: c.lat + dLat, minLng: c.lng - dLng, maxLng: c.lng + dLng };
}

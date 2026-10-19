// Average gas prices by state (from AAA), published next to the schedule as gas-prices.json
// and refreshed every few hours (script/gas-prices.mjs on main). When the archer leaves the
// gas price blank, trip costs use the average in the state they drive from.
import { useEffect, useState } from "react";
import { FALLBACK_GAS_PRICE, type SeasonSettings } from "./season";
import { stateCode } from "./states";
import { readJSON, writeJSON } from "./storage";

export interface GasPriceTable {
  /** The day the prices were checked, e.g. "2026-10-19". */
  checked: string;
  /** Average of the states, for when the archer's state isn't known. */
  national?: number;
  /** Regular gas, dollars a gallon, by two-letter state code. */
  states: Record<string, number>;
}

/** The gas price trip costs use, and where it came from. */
export interface GasPrice {
  price: number;
  /** "mine": typed in; "state": that state's average; "national": US average; "guess": no data. */
  kind: "mine" | "state" | "national" | "guess";
  /** The state whose average it is (kind "state"). */
  state: string | null;
}

// Loaded once per app launch and saved on the phone, so it works offline.
const CACHE_KEY = "gasPrices.v1";
let loading: Promise<GasPriceTable | null> | null = null;
let latest: GasPriceTable | null = null;

function loadTable(url: string): Promise<GasPriceTable | null> {
  loading ??= (async () => {
    latest = await readJSON<GasPriceTable>(CACHE_KEY);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as GasPriceTable;
        if (data && typeof data.states === "object" && data.states) {
          latest = data;
          writeJSON(CACHE_KEY, data);
        }
      }
    } catch {
      // Offline or the file isn't there yet: keep the saved copy, if any.
    }
    return latest;
  })();
  return loading;
}

/** The state price table (null while loading or when there's none). */
export function useGasPrices(apiBaseUrl: string | undefined): GasPriceTable | null {
  const [table, setTable] = useState<GasPriceTable | null>(latest);
  useEffect(() => {
    if (!apiBaseUrl) return;
    let live = true;
    loadTable(`${apiBaseUrl}/gas-prices.json`).then((t) => live && setTable(t));
    return () => {
      live = false;
    };
  }, [apiBaseUrl]);
  return table;
}

/** The state the archer drives from: the one in their "Drive from" town ("Abilene, TX"), else the first fallback that's set. */
export function driveState(homeTown: string, ...fallbacks: (string | null | undefined)[]): string | null {
  const parts = homeTown.split(",");
  const fromTown = parts.length > 1 ? stateCode(parts[parts.length - 1]) : null;
  return fromTown ?? fallbacks.find((s): s is string => !!s) ?? null;
}

/** The archer's own gas price, or the average in their state when they left it blank. */
export function gasPriceFor(settings: Pick<SeasonSettings, "gasPrice">, table: GasPriceTable | null, state: string | null): GasPrice {
  if (settings.gasPrice != null && settings.gasPrice > 0) return { price: settings.gasPrice, kind: "mine", state: null };
  const avg = state ? table?.states[state] : undefined;
  if (avg && avg > 0) return { price: avg, kind: "state", state };
  if (table?.national && table.national > 0) return { price: table.national, kind: "national", state: null };
  return { price: FALLBACK_GAS_PRICE, kind: "guess", state: null };
}

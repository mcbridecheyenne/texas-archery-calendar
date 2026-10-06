// Helpers for finding shoots on the Tournaments tab: the search box, the neighboring
// states shown when a state has nothing listed, and which shoots count as national
// championships.
import { stateName } from "./states";
import { listedBy, organizationsOf, statesOf, type TournamentEvent } from "./types";

/**
 * States that share a border (plus DC). Alaska and Hawaii have no land neighbors, so they
 * point at the state their archers most often fly to.
 */
export const NEIGHBORS: Record<string, string[]> = {
  AL: ["FL", "GA", "MS", "TN"],
  AK: ["WA"],
  AZ: ["CA", "CO", "NM", "NV", "UT"],
  AR: ["LA", "MO", "MS", "OK", "TN", "TX"],
  CA: ["AZ", "NV", "OR"],
  CO: ["AZ", "KS", "NE", "NM", "OK", "UT", "WY"],
  CT: ["MA", "NY", "RI"],
  DE: ["MD", "NJ", "PA"],
  DC: ["MD", "VA"],
  FL: ["AL", "GA"],
  GA: ["AL", "FL", "NC", "SC", "TN"],
  HI: ["CA"],
  ID: ["MT", "NV", "OR", "UT", "WA", "WY"],
  IL: ["IA", "IN", "KY", "MO", "WI"],
  IN: ["IL", "KY", "MI", "OH"],
  IA: ["IL", "MN", "MO", "NE", "SD", "WI"],
  KS: ["CO", "MO", "NE", "OK"],
  KY: ["IL", "IN", "MO", "OH", "TN", "VA", "WV"],
  LA: ["AR", "MS", "TX"],
  ME: ["NH"],
  MD: ["DC", "DE", "PA", "VA", "WV"],
  MA: ["CT", "NH", "NY", "RI", "VT"],
  MI: ["IN", "OH", "WI"],
  MN: ["IA", "ND", "SD", "WI"],
  MS: ["AL", "AR", "LA", "TN"],
  MO: ["AR", "IA", "IL", "KS", "KY", "NE", "OK", "TN"],
  MT: ["ID", "ND", "SD", "WY"],
  NE: ["CO", "IA", "KS", "MO", "SD", "WY"],
  NV: ["AZ", "CA", "ID", "OR", "UT"],
  NH: ["MA", "ME", "VT"],
  NJ: ["DE", "NY", "PA"],
  NM: ["AZ", "CO", "OK", "TX", "UT"],
  NY: ["CT", "MA", "NJ", "PA", "VT"],
  NC: ["GA", "SC", "TN", "VA"],
  ND: ["MN", "MT", "SD"],
  OH: ["IN", "KY", "MI", "PA", "WV"],
  OK: ["AR", "CO", "KS", "MO", "NM", "TX"],
  OR: ["CA", "ID", "NV", "WA"],
  PA: ["DE", "MD", "NJ", "NY", "OH", "WV"],
  RI: ["CT", "MA"],
  SC: ["GA", "NC"],
  SD: ["IA", "MN", "MT", "ND", "NE", "WY"],
  TN: ["AL", "AR", "GA", "KY", "MO", "MS", "NC", "VA"],
  TX: ["AR", "LA", "NM", "OK"],
  UT: ["AZ", "CO", "ID", "NM", "NV", "WY"],
  VT: ["MA", "NH", "NY"],
  VA: ["DC", "KY", "MD", "NC", "TN", "WV"],
  WA: ["ID", "OR"],
  WV: ["KY", "MD", "OH", "PA", "VA"],
  WI: ["IA", "IL", "MI", "MN"],
  WY: ["CO", "ID", "MT", "NE", "SD", "UT"],
};

/**
 * How many state lines away each nearby state is: the state itself is 0, its neighbors 1,
 * their neighbors 2, and so on up to `steps`. Used so "Near me" only looks up towns in
 * states that could possibly be close.
 */
export function statesAround(code: string, steps: number): Map<string, number> {
  const out = new Map<string, number>([[code, 0]]);
  let edge = [code];
  for (let step = 1; step <= steps; step++) {
    const next: string[] = [];
    for (const st of edge) {
      for (const n of NEIGHBORS[st] ?? []) {
        if (!out.has(n)) {
          out.set(n, step);
          next.push(n);
        }
      }
    }
    edge = next;
  }
  return out;
}

/** Everything the search box looks through for one shoot, in lower case. */
export function searchText(e: TournamentEvent): string {
  const states = statesOf(e);
  return [
    e.name,
    e.location,
    e.city,
    ...states,
    ...states.map(stateName),
    ...organizationsOf(e),
    listedBy(e),
    e.contact,
    e.addedBy,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** True when every word typed shows up somewhere in the shoot's text ("dallas asa" finds ASA shoots in Dallas). */
export function matchesSearch(text: string, words: string[]): boolean {
  return words.every((w) => text.includes(w));
}

/** Splits what was typed into lower-case words; empty when the box is blank. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

// Names that mark the big national shoots: "S3DA Nationals", "NFAA Indoor Nationals",
// "USA Archery Target Nationals", "IBO World Championship", "The Vegas Shoot", and so on.
const NATIONAL_NAME = /\bnationals?\b|\bu\.?\s?s\.?\s?open\b|world championship|vegas shoot|lancaster archery classic/i;

/** The national championships, shown when a state has nothing of its own listed yet. */
export function isNationalChampionship(e: TournamentEvent): boolean {
  return NATIONAL_NAME.test(e.name);
}

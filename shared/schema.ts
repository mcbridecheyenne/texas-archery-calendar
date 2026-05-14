import { z } from "zod";

// No DB tables — events live in memory and are refreshed from upstream.

export const tournamentEventSchema = z.object({
  id: z.string(),
  source: z.enum(["TFAA", "ASA", "TSAA"]),
  name: z.string(),
  startDate: z.string(), // ISO YYYY-MM-DD
  endDate: z.string(),
  location: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  registrationStart: z.string().nullable(),
  registrationEnd: z.string().nullable(),
  contact: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  sourceUrl: z.string(),
});

export type TournamentEvent = z.infer<typeof tournamentEventSchema>;

export const sourceStatusSchema = z.object({
  name: z.enum(["TFAA", "ASA", "TSAA"]),
  url: z.string(),
  status: z.enum(["ok", "partial", "error"]),
  message: z.string().nullable(),
  eventCount: z.number(),
  fetchedAt: z.string(),
});

export type SourceStatus = z.infer<typeof sourceStatusSchema>;

export const eventsResponseSchema = z.object({
  events: z.array(tournamentEventSchema),
  sources: z.array(sourceStatusSchema),
  lastUpdated: z.string(),
});

export type EventsResponse = z.infer<typeof eventsResponseSchema>;

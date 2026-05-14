import type { Express } from "express";
import type { Server } from "node:http";
import { getEvents, invalidateCache } from "./scrapers";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/events", async (_req, res) => {
    try {
      const data = await getEvents(false);
      res.json(data);
    } catch (err) {
      res
        .status(500)
        .json({ message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/refresh", async (_req, res) => {
    invalidateCache();
    try {
      const data = await getEvents(true);
      res.json(data);
    } catch (err) {
      res
        .status(500)
        .json({ message: err instanceof Error ? err.message : String(err) });
    }
  });

  return httpServer;
}

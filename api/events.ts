import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getEvents } from "./_scrapers";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  try {
    const data = await getEvents();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
}

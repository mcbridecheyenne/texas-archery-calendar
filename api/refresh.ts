import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getEvents } from "./_scrapers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  try {
    const data = await getEvents();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
}

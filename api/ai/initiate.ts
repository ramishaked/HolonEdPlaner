import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initiate } from "../_lib/ai.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const { status, json } = await initiate(req.body);
  res.status(status).json(json);
}

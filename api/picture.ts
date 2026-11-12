import type { VercelRequest, VercelResponse } from "@vercel/node";
import { picture } from "./_lib/picture.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const { status, json } = await picture(req.headers.authorization);
  res.setHeader("Cache-Control", "private, no-store");
  res.status(status).json(json);
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleSchoolAdmin } from "../_lib/admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const { status, json } = await handleSchoolAdmin(req.body, req.headers.authorization);
  res.status(status).json(json);
}

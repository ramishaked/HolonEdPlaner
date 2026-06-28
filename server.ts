import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initiate, generate } from "./api/_lib/ai.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API Endpoint to check server status
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV });
});

// API Endpoint to formulate introductory analysis and custom questions.
// Shared logic lives in api/_lib/ai.ts so the Vercel serverless function
// (api/ai/initiate.ts) and this Express route stay in lockstep.
app.post("/api/ai/initiate", async (req, res) => {
  const { status, json } = await initiate(req.body);
  res.status(status).json(json);
});

// API Endpoint to generate the final full strategic plan based on questionnaire answers
app.post("/api/ai/generate", async (req, res) => {
  const { status, json } = await generate(req.body);
  res.status(status).json(json);
});

// Serve static elements and integrate Vite as middleware during development (NODE_ENV !== "production")
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port http://localhost:${PORT}`);
  });
}

startServer();

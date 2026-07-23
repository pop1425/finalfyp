import { Router, Request, Response } from "express";
import { parseVoiceCommand } from "../services/gemini.js";

const router = Router();

// POST /api/nlp/parse
router.post("/parse", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing or invalid 'text' field" });
      return;
    }

    const parsed = await parseVoiceCommand(text);
    res.json(parsed);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "NLP parse failed";
    console.error("NLP error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;

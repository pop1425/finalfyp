import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "voicesend-backend" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Routes
import transactionsRouter from "./routes/transactions.ts";
import nlpRouter from "./routes/nlp.ts";

app.use("/api/transactions", transactionsRouter);
app.use("/api/nlp", nlpRouter);

app.listen(PORT, () => {
  console.log(`VoiceSend backend running on port ${PORT}`);
});

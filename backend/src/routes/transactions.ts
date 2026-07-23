import express from "express";
const { Router } = express;
type Request = express.Request;
type Response = express.Response;
import {
  sendPayout,
  queryPayout,
  getFee,
  getBalance,
} from "../services/snippe.ts";
import { saveTransaction, updateTransactionStatus } from "../services/supabase.ts";

const router = Router();

const BACKEND_URL = process.env.BACKEND_URL || "https://backendfina.onrender.com";

// POST /api/transactions/disburse
router.post("/disburse", async (req: Request, res: Response) => {
  try {
    const { amount, recipient_name, recipient_phone, sender_name } = req.body;

    if (!amount || !recipient_name || !recipient_phone) {
      res.status(400).json({ error: "Missing required fields: amount, recipient_name, recipient_phone" });
      return;
    }

    const reference = req.body.reference || `TX-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    // Save pending transaction to Supabase
    await saveTransaction({
      transaction_id: reference,
      amount: Number(amount),
      recipient: recipient_name,
      recipient_number: recipient_phone,
      sender_name: sender_name || "Pop Omondi",
    });

    // Send payout via Snippe with webhook
    const snippeResult = await sendPayout({
      amount: Number(amount),
      recipient_name,
      recipient_phone,
      narration: `VoiceSend transfer to ${recipient_name}`,
      webhook_url: `${BACKEND_URL}/api/webhook/snippe`,
      metadata: { transaction_id: reference },
    });

    // Update transaction with Snippe reference
    const snippeRef = snippeResult.reference || reference;
    await updateTransactionStatus(reference, "processing", snippeRef);

    res.json({
      success: true,
      transaction_id: reference,
      snippe_reference: snippeRef,
      status: snippeResult.status || "processing",
      fees: snippeResult.fees,
      total: snippeResult.total,
      message: "Payout initiated",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Disbursement failed";
    console.error("Disburse error:", message);
    res.status(500).json({ error: message });
  }
});

// GET /api/transactions/:reference/status
router.get("/:reference/status", async (req: Request, res: Response) => {
  try {
    const reference = req.params.reference as string;
    const result = await queryPayout(reference);
    res.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Status query failed";
    console.error("Status error:", message);
    res.status(500).json({ error: message });
  }
});

// GET /api/transactions/fee/:amount
router.get("/fee/:amount", async (req: Request, res: Response) => {
  try {
    const amount = Number(req.params.amount);
    const fee = await getFee(amount);
    res.json({ fee });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Fee query failed";
    res.status(500).json({ error: message });
  }
});

// GET /api/transactions/balance
router.get("/balance", async (_req: Request, res: Response) => {
  try {
    const balance = await getBalance();
    res.json({ balance });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Balance query failed";
    res.status(500).json({ error: message });
  }
});

export default router;

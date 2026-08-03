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
import {
  createTransaction,
  getTransaction,
  updateTransaction,
} from "../services/transactionStore.ts";

const router = Router();

const BACKEND_URL = process.env.BACKEND_URL || "https://backendfina.onrender.com";

// POST /api/transactions/disburse
router.post("/disburse", async (req: Request, res: Response) => {
  try {
    const { amount, recipient_name, recipient_phone } = req.body;

    if (!amount || !recipient_name || !recipient_phone) {
      res.status(400).json({ error: "Missing required fields: amount, recipient_name, recipient_phone" });
      return;
    }

    const reference = req.body.reference || `TX-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    // Send payout via Snippe with webhook
    const snippeResult = await sendPayout({
      amount: Number(amount),
      recipient_name,
      recipient_phone,
      narration: `VoiceSend transfer to ${recipient_name}`,
      webhook_url: `${BACKEND_URL}/api/webhook/snippe`,
      metadata: { transaction_id: reference },
      idempotencyKey: `payout-${reference}`,
    });

    const snippeRef = snippeResult.reference || reference;
    const status = snippeResult.status || "processing";
    createTransaction(reference, status, snippeRef);

    res.json({
      success: true,
      transaction_id: reference,
      snippe_reference: snippeRef,
      status,
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
    const stored = getTransaction(reference);

    if (!stored || !stored.snippeReference) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const result = await queryPayout(stored.snippeReference);
    const status = result.status || stored.status;
    updateTransaction(reference, status);

    res.json({ reference, status, ...result });
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

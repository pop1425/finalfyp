import { Router, Request, Response } from "express";
import {
  sendPayout,
  queryPayout,
  getFee,
  getBalance,
} from "../services/snippe.js";
import { saveTransaction, updateTransactionStatus } from "../services/supabase.js";

const router = Router();

// POST /api/transactions/disburse
router.post("/disburse", async (req: Request, res: Response) => {
  try {
    const { amount, recipient_name, recipient_phone, reference, sender_name } =
      req.body;

    if (!amount || !recipient_name || !recipient_phone || !reference) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Save pending transaction to Supabase
    await saveTransaction({
      transaction_id: reference,
      amount: Number(amount),
      recipient: recipient_name,
      recipient_number: recipient_phone,
      sender_name: sender_name || "Pop Omondi",
    });

    // Send payout via Snippe
    const snippeResult = await sendPayout({
      amount: Number(amount),
      recipient_name,
      recipient_phone,
      reference,
      sender_name,
    });

    // Update transaction with Snippe reference
    await updateTransactionStatus(
      reference,
      "processing",
      snippeResult.reference || reference
    );

    res.json({
      success: true,
      transaction_id: reference,
      snippe_reference: snippeResult.reference,
      status: snippeResult.status || "processing",
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
    const { reference } = req.params;
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

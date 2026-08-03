import express from "express";
const { Router } = express;
type Request = express.Request;
type Response = express.Response;
import {
  getTransaction,
  getTransactionBySnippeReference,
  updateTransaction,
} from "../services/transactionStore.ts";

const router = Router();

// POST /api/webhook/snippe
router.post("/snippe", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    console.log("=== SNIPPE WEBHOOK RECEIVED ===");
    console.log("Payload:", JSON.stringify(payload, null, 2));

    // Snippe sends payout.completed or payout.failed events
    const event = payload.event || payload.type || "unknown";
    const data = payload.data || payload;

    const status = data.status || "unknown";
    const transactionId = data.metadata?.transaction_id || data.transaction_id;
    const snippeReference = data.reference || data.transaction_id || null;

    let dbStatus = "processing";
    if (status === "completed" || event === "payout.completed") {
      dbStatus = "completed";
    } else if (status === "failed" || event === "payout.failed") {
      dbStatus = "failed";
    } else if (status === "reversed") {
      dbStatus = "reversed";
    }

    // Look up by our internal TX id first (set as metadata on the payout), then by Snippe reference
    let record = transactionId ? getTransaction(transactionId) : null;
    if (!record && snippeReference) {
      record = getTransactionBySnippeReference(snippeReference);
    }

    if (record) {
      updateTransaction(record.reference, dbStatus, record.snippeReference || snippeReference || undefined);
      console.log(`Transaction ${record.reference} updated to ${dbStatus}`);
    } else {
      console.log("No matching transaction found in store for webhook payload");
    }

    // Always return 200 to Snippe
    res.status(200).json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook error";
    console.error("Webhook processing error:", message);
    // Still return 200 to prevent Snippe from retrying
    res.status(200).json({ received: true, error: message });
  }
});

export default router;

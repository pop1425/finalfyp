import express from "express";
const { Router } = express;
type Request = express.Request;
type Response = express.Response;
import { updateTransactionStatus } from "../services/supabase.ts";

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

    const reference = data.reference || data.transaction_id || data.metadata?.transaction_id;
    const status = data.status || "unknown";

    if (reference) {
      let dbStatus = "processing";
      if (status === "completed" || event === "payout.completed") {
        dbStatus = "completed";
      } else if (status === "failed" || event === "payout.failed") {
        dbStatus = "failed";
      } else if (status === "reversed") {
        dbStatus = "reversed";
      }

      await updateTransactionStatus(reference, dbStatus, reference);
      console.log(`Transaction ${reference} updated to ${dbStatus}`);
    } else {
      console.log("No reference found in webhook payload");
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

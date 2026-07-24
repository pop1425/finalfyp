import express from "express";
const { Router } = express;
type Request = express.Request;
type Response = express.Response;

const router = Router();

const API_KEY = process.env.SNIPPE_API_KEY!;
const BASE_URL = process.env.SNIPPE_BASE_URL || "https://api.snippe.sh";
const API_VERSION = process.env.SNIPPE_API_VERSION || "2026-01-25";
const WEBHOOK_URL = `${process.env.BACKEND_URL || "https://backendfina.onrender.com"}/api/webhook/snippe`;

async function collectFromSnippe(params: {
  amount: number;
  phone_number: string;
  firstname: string;
  lastname: string;
  email: string;
}) {
  const res = await fetch(`${BASE_URL}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "X-Snippe-Version": API_VERSION,
      "Idempotency-Key": `collect-${Date.now()}-${Math.floor(Math.random() * 9000)}`,
    },
    body: JSON.stringify({
      payment_type: "mobile",
      details: {
        amount: params.amount,
        currency: "TZS",
      },
      phone_number: params.phone_number,
      customer: {
      firstname: params.firstname || "emma",
      lastname: params.lastname || "joseph",
      email: params.email || "emmanuaeljoseph@gmail.com",
      },
      webhook_url: WEBHOOK_URL,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Snippe error ${res.status}: ${text}`);
  return JSON.parse(text);
}

// GET /collect — serve HTML page
router.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoiceSend — Collect Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #07060F;
      color: #fff;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      background: #0F0E1F;
      border: 1.5px solid #2A1C5E;
      border-radius: 20px;
      padding: 40px 32px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 0 60px rgba(143, 0, 255, 0.15);
    }
    h1 {
      font-size: 22px;
      text-align: center;
      margin-bottom: 8px;
      color: #00FF66;
      letter-spacing: 1px;
    }
    .subtitle {
      text-align: center;
      color: #888;
      font-size: 13px;
      margin-bottom: 32px;
    }
    label {
      display: block;
      font-size: 12px;
      color: #AAA;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    input {
      width: 100%;
      padding: 14px 16px;
      background: #131124;
      border: 1.5px solid #2A1C5E;
      border-radius: 12px;
      color: #fff;
      font-size: 16px;
      outline: none;
      margin-bottom: 20px;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #00FF66; }
    input::placeholder { color: #555; }
    button {
      width: 100%;
      padding: 16px;
      background: transparent;
      border: 2px solid #00FF66;
      border-radius: 14px;
      color: #00FF66;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 2px;
      transition: all 0.2s;
      margin-top: 8px;
    }
    button:hover { background: #00FF6615; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .result {
      margin-top: 24px;
      padding: 16px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.6;
      display: none;
      word-break: break-all;
    }
    .result.success { display: block; background: #0A2E1A; border: 1px solid #00FF6640; color: #00FF66; }
    .result.error { display: block; background: #2E0A0A; border: 1px solid #FF003C40; color: #FF003C; }
    .result .ref { font-family: monospace; font-size: 12px; margin-top: 6px; color: #AAA; }
  </style>
</head>
<body>
  <div class="card">
    <h1>VoiceSend</h1>
    <p class="subtitle">Collect Payment via Mobile Money</p>

    <label>Phone Number</label>
    <input type="tel" id="phone" placeholder="2557XXXXXXXXX" maxlength="12">

    <label>Amount (TZS)</label>
    <input type="number" id="amount" placeholder="5000" min="100">

    <button id="btn" onclick="collect()">Collect Payment</button>

    <div id="result" class="result"></div>
  </div>

  <script>
    async function collect() {
      const btn = document.getElementById('btn');
      const result = document.getElementById('result');
      const phone = document.getElementById('phone').value.trim();
      const amount = document.getElementById('amount').value.trim();

      if (!phone || phone.length < 10) {
        result.className = 'result error';
        result.textContent = 'Please enter a valid phone number';
        return;
      }
      if (!amount || Number(amount) < 100) {
        result.className = 'result error';
        result.textContent = 'Minimum amount is 100 TZS';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending...';
      result.className = 'result';
      result.style.display = 'none';

      try {
        const res = await fetch('/api/payments/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: phone,
            amount: Number(amount),
            firstname: 'emma',
            lastname: 'joseph',
          }),
        });

        const data = await res.json();

        if (data.success) {
          result.className = 'result success';
          result.innerHTML = '<strong>USSD push sent!</strong><br>The customer will receive a payment prompt on their phone.<br><div class="ref">Reference: ' + (data.reference || 'N/A') + '<br>Status: ' + (data.status || 'pending') + '</div>';
        } else {
          result.className = 'result error';
          result.textContent = data.error || 'Payment failed. Check balance and try again.';
        }
      } catch (e) {
        result.className = 'result error';
        result.textContent = 'Network error. Please try again.';
      }

      btn.disabled = false;
      btn.textContent = 'Collect Payment';
    }
  </script>
</body>
</html>`);
});

// POST /api/payments/collect — call Snippe
router.post("/collect", async (req: Request, res: Response) => {
  try {
    const { amount, phone_number, firstname, lastname, email } = req.body;

    if (!amount || !phone_number) {
      res.status(400).json({ success: false, error: "Missing amount or phone_number" });
      return;
    }

    const result = await collectFromSnippe({
      amount: Number(amount),
      phone_number,
      firstname: firstname || "emma",
      lastname: lastname || "joseph",
      email: email || "emmanuaeljoseph@gmail.com",
    });

    res.json({
      success: true,
      reference: result.data?.reference || result.reference,
      status: result.data?.status || result.status || "pending",
      amount: result.data?.amount || result.amount,
      fees: result.data?.fees || result.fees,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Collection failed";
    console.error("Collect error:", message);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;

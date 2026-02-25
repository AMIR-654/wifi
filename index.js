const express = require("express");
const cors = require("cors");
const MikroNode = require("mikronode");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

// MikroTik (اختياري حالياً)
const ROUTER_IP = "192.168.56.102";
const USER = "admin";
const PASS = "123456";

// Paymob ENV
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const INTEGRATION_ID = process.env.INTEGRATION_ID;
const IFRAME_ID = process.env.IFRAME_ID;

// فرونت
const FRONT_URL = process.env.FRONT || "http://localhost:5173";

/* ================= AUTH TOKEN ================= */

async function getAuthToken() {
  const res = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
  });

  const data = await res.json();
  if (!data.token) throw new Error("Paymob auth failed");
  return data.token;
}

/* ================= CREATE PAYMENT ================= */

app.post("/pay", async (req, res) => {
  try {
    const { amount } = req.body;
    const cents = amount * 100;

    const token = await getAuthToken();

    // Create order
    const orderRes = await fetch(
      "https://accept.paymob.com/api/ecommerce/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_cents: cents,
          currency: "EGP",
        }),
      }
    );

    const order = await orderRes.json();

    // Create payment key
    const payKeyRes = await fetch(
      "https://accept.paymob.com/api/acceptance/payment_keys",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_cents: cents,
          expiration: 3600,
          order_id: order.id,
          currency: "EGP",
          integration_id: INTEGRATION_ID,

          billing_data: {
            first_name: "wifi",
            last_name: "user",
            email: "wifi@test.com",
            phone_number: "01000000000",
            street: "test",
            building: "1",
            floor: "1",
            apartment: "1",
            city: "Cairo",
            country: "EG",
          },
        }),
      }
    );

    const payKey = await payKeyRes.json();

    if (!payKey.token) {
      console.log("❌ Paymob error:", payKey);
      return res.status(500).json({ error: "Payment token missing" });
    }

    const iframeURL = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${payKey.token}`;

    res.json({ url: iframeURL });

  } catch (err) {
    console.log("🔥 PAY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= SUCCESS CALLBACK ================= */

app.get("/success", async (req, res) => {
  try {
    const success = req.query.success === "true";

    if (!success) {
      return res.send("❌ Payment failed");
    }

    // Generate voucher
    const username = Math.random().toString(36).substring(2, 8);
    const password = Math.random().toString(36).substring(2, 8);

    // MikroTik (safe cloud mode)
    try {
  const device = new MikroNode(ROUTER_IP);
  const [login] = await device.connect();

  const conn = await login(USER, PASS);
  const chan = conn.openChannel();

  chan.write([
    "/ip/hotspot/user/add",
    `=name=${username}`,
    `=password=${password}`,
  ]);

  chan.on("done", (data) => {
    console.log("✅ User added to MikroTik:", username);
    conn.close();
  });

  chan.on("trap", (err) => {
    console.log("❌ MikroTik ERROR:", err);
  });

  chan.on("timeout", () => {
    console.log("⏰ MikroTik timeout");
  });

} catch (err) {
  console.log("🔥 MikroTik connection failed:", err.message);
}
    

    // Redirect to frontend
    res.redirect(`${FRONT_URL}/success?user=${username}&pass=${password}`);

  } catch (err) {
    console.log("🔥 SUCCESS ERROR:", err);
    res.send("Server error");
  }
});

/* ================= HEALTH ================= */

app.get("/", (req, res) => {
  res.send("🔥 Paymob server running");
});

app.listen(8080, () => console.log("🚀 Backend running on 8080"));


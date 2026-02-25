require("dotenv").config();

const express = require("express");
const cors = require("cors");
const MikroNode = require("mikronode");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const FRONT_URL = process.env.FRONT_URL;

// MikroTik (لما نستخدمه لاحقًا)
const ROUTER_IP = "192.168.56.102";
const USER = "admin";
const PASS = "123456";

// Paymob
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const INTEGRATION_ID = process.env.INTEGRATION_ID;
const IFRAME_ID = process.env.IFRAME_ID;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* ================= AUTH ================= */

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

    const iframeURL = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${payKey.token}`;

    res.json({ url: iframeURL });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= SUCCESS ================= */

app.get("/success", async (req, res) => {
  try {
    const success = req.query.success === "true";

    if (!success) return res.send("❌ Payment failed");

    // generate card
    const username = Math.random().toString(36).substring(2, 8);
    const password = Math.random().toString(36).substring(2, 8);

    // 🔥 نحفظ الكارت في Supabase
    await supabase.from("vouchers").insert({
      username,
      password,
      status: "pending",
    });

    console.log("✅ Card saved in Supabase");

    // تحويل للفرونت
    res.redirect(
      `${FRONT_URL}/success?user=${username}&pass=${password}`
    );
  } catch (err) {
    console.log(err);
    res.send("Server error");
  }
});

/* ================= HEALTH ================= */

app.get("/", (req, res) => {
  res.send("🔥 Server running with Supabase");
});

app.listen(8080, () => console.log("🚀 Server started"));

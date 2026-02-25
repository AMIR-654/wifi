const express = require("express");
const cors = require("cors");
const MikroNode = require("mikronode");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */
const BASE_URL = "https://ac33-154-180-151-137.ngrok-free.app";
// MikroTik
const ROUTER_IP = "192.168.56.102";
const USER = "admin";
const PASS = "123456";

// Paymob
// const PAYMOB_API_KEY = process.env.PAYMOB_KEY || "ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiR0Z6Y3lJNklrMWxjbU5vWVc1MElpd2ljSEp2Wm1sc1pWOXdheUk2TVRFek5EVTFNQ3dpYm1GdFpTSTZJakUzTnpJd01qQXpNakl1TVRNNU16Z3pJbjAuaUlYaU9NNjhiWmoyZmJXcC11MDZfRVNObzFEQnRyMDY0T0s1WWxCdDZhTDVhYTZ3a2pjQ3RWWGhmUjJuRmY4UDVIeDhXMFhtd1QyMTdfNEh5UEFSQkE=";
// const INTEGRATION_ID = 5554237;
// const IFRAME_ID = 1009774;
require("dotenv").config();

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const INTEGRATION_ID = process.env.INTEGRATION_ID;
const IFRAME_ID = process.env.IFRAME_ID;
// temp storage
const pendingOrders = new Map();

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
    const { amount, planName } = req.body;
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
    pendingOrders.set(order.id, { planName });

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

// app.get("/success", async (req, res) => {
//   try {
//     const orderId = req.query.id; // ✔ مهم

//     if (!pendingOrders.has(orderId)) {
//       return res.send("Invalid payment");
//     }

//     // generate voucher
//     const username = Math.random().toString(36).substring(2, 8);
//     const password = Math.random().toString(36).substring(2, 8);

//     /* ======== CREATE USER IN MIKROTIK ======== */
//     try {
//       const device = new MikroNode(ROUTER_IP);
//       const [login] = await device.connect();
//       const conn = await login(USER, PASS);
//       const chan = conn.openChannel();

//       chan.write([
//         "/ip/hotspot/user/add",
//         `=name=${username}`,
//         `=password=${password}`,
//       ]);

//       chan.on("done", () => conn.close());
//     } catch (mikErr) {
//       console.log("⚠️ MikroTik error:", mikErr.message);
//     }

//     pendingOrders.delete(orderId);

//     /* ======== REDIRECT TO FRONTEND ======== */

//     const FRONT = process.env.FRONT || "http://localhost:5173";

//     res.redirect(
//       `${FRONT}/success?user=${username}&pass=${password}`
//     );

//   } catch (err) {
//     console.log("🔥 SUCCESS ERROR:", err);
//     res.send("Payment error");
//   }
// });
app.get("/success", async (req, res) => {
  try {
    const success = req.query.success === "true";

    if (!success) {
      return res.send("❌ Payment failed");
    }

    // generate voucher
    const username = Math.random().toString(36).substring(2, 8);
    const password = Math.random().toString(36).substring(2, 8);

    // MikroTik
    const device = new MikroNode(ROUTER_IP);
    const [login] = await device.connect();
    const conn = await login(USER, PASS);
    const chan = conn.openChannel();

    chan.write([
      "/ip/hotspot/user/add",
      `=name=${username}`,
      `=password=${password}`,
    ]);

    chan.on("done", () => conn.close());

    // redirect للفرونت
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
  res.send("🔥 Paymob server running");
});

app.listen(8080, () => console.log("🚀 Backend running on 8080"));
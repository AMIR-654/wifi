require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { v4: uuid } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================= CONFIG
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const INTEGRATION_ID = process.env.INTEGRATION_ID;
const IFRAME_ID = process.env.IFRAME_ID;
const FRONT_URL = process.env.FRONT_URL || "http://localhost:5173";

// ================= TEMP DB
const orders = [];

// ================= HEALTH
app.get("/", (_, res) => {
  res.send("🚀 Server running");
});

// ================= CREATE PAYMENT
app.post("/create-payment", async (req, res) => {
  try {
    const { amount } = req.body;

    // 1️⃣ Auth token
    const auth = await axios.post(
      "https://accept.paymob.com/api/auth/tokens",
      { api_key: PAYMOB_API_KEY }
    );

    const token = auth.data.token;

    // 2️⃣ Create order
    const order = await axios.post(
      "https://accept.paymob.com/api/ecommerce/orders",
      {
        auth_token: token,
        delivery_needed: false,
        amount_cents: amount,
        currency: "EGP",
        items: [],
      }
    );

    const orderId = order.data.id;

    // 3️⃣ Payment key
    const paymentKey = await axios.post(
      "https://accept.paymob.com/api/acceptance/payment_keys",
      {
        auth_token: token,
        amount_cents: amount,
        expiration: 3600,
        order_id: orderId,
        billing_data: {
          apartment: "NA",
          email: "test@test.com",
          floor: "NA",
          first_name: "wifi",
          street: "NA",
          building: "NA",
          phone_number: "+201000000000",
          shipping_method: "NA",
          postal_code: "NA",
          city: "NA",
          country: "EG",
          last_name: "user",
          state: "NA",
        },
        currency: "EGP",
        integration_id: INTEGRATION_ID,
      }
    );

    const finalToken = paymentKey.data.token;

    // 4️⃣ Iframe URL
    const iframe = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${finalToken}`;

    res.json({ iframe });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Payment failed" });
  }
});

// ================= SUCCESS REDIRECT
app.get("/success", (req, res) => {
  try {
    const success = req.query.success === "true";

    if (!success) {
      return res.redirect(`${FRONT_URL}/failed`);
    }

    // Generate voucher
    const username = uuid().slice(0, 6);
    const password = uuid().slice(0, 6);

    // Save order (تقدر تربطه بميكروتيك بعدين)
    orders.push({
      username,
      password,
      date: new Date(),
    });

    // Redirect للفرونت
    res.redirect(
      `${FRONT_URL}/success?user=${username}&pass=${password}`
    );
  } catch (err) {
    console.error(err);
    res.send("Error");
  }
});

// ================= GET ORDERS (admin)
app.get("/orders", (_, res) => {
  res.json(orders);
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
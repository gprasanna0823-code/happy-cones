# 🍦 HAPPY CONES - Online Ice Cream Shop & QR Code Ordering System

A modern, mobile-first ice cream shop online ordering web application with QR code counter standees, exact-amount Google Pay / FamApp / UPI payment, WhatsApp order alerts, live order tracking, and an admin & kitchen dashboard.

---

## ✨ Features & Pages Overview

### 🍨 Page 1: Ice Cream Menu (`/`)
- **Shop Branding:** "HAPPY CONES - Ice Cream Paradise" in pastel pink, cream, chocolate brown, and fresh mint.
- **Welcome Banner:** *"Welcome to Our Ice Cream Paradise! Choose Your Favourite Ice Cream & Enjoy Every Bite!"*
- **8 Ice Cream Categories** (all priced under ₹150):
  1. Cone Ice Cream 🍦
  2. Stick Ice Cream 🍧
  3. Cup Ice Cream 🍨
  4. Kulfi Ice Cream 🪵
  5. Chocolate Ice Cream 🍫
  6. Sundae Ice Cream 🍒
  7. Family Pack Ice Cream 📦
  8. Special Ice Cream ✨
- **Smart Filtering:** Live search, category pills, and Veg-only filter.

### 🍧 Page 2 & Page 3: Product Customization & Order Summary
- Choose flavours, sizes/scoops, toppings, kitchen instructions, and quantity (`+` / `-`).
- Promo coupon support (`HAPPY10` for 10% off) with real-time total calculation.

### 💳 Page 4: Dynamic Exact-Amount UPI Payment
- Generates an ISO/IEC 18004 compliant dynamic UPI QR code pre-filling the exact order total (`upi://pay?pa=9344232175@ptyes&pn=HAPPY%20CONES&am=...`).
- **1-Tap UPI App Deep Links:** FamApp (FamPay), Google Pay, PhonePe, Paytm, and any UPI app — **no manual UTR/reference typing required**.
- Optional popup to view the shop's uploaded original Paytm QR image (`/api/payment-qr`).

### ❤️ Page 5: Order Confirmation & Live Kitchen Tracker
- Displays Order ID, ordered items, payment confirmation, and 4-step live tracker (**Placed → Confirmed → Preparing → Ready**).
- Automatically triggers WhatsApp order notification to owner number (`9344232175`).

### 🛎️ Admin Dashboard (`/admin`) & Counter Standee (`/standee`)
- **Admin (`/admin`, default PIN `1234`):** Manage live kitchen orders, add/edit/delete menu items, toggle stock, upload a new payment QR, and edit shop/UPI/WhatsApp settings.
- **Standee (`/standee`):** Print-ready QR standees and PNG downloads pointing to your live public HTTPS URL (on Netlify) or local LAN Wi-Fi URL (locally).

---

## ☁️ Deploy Publicly on Netlify (via GitHub)

This repository includes full Netlify support so customers can scan and order from any mobile network even when your PC is turned off:
- `netlify.toml` — configures static publishing (`public/`), clean routes (`/admin`, `/standee`), and serverless functions.
- `netlify/functions/api.mjs` — handles all `/api/*` routes using **Netlify Blobs** (`@netlify/blobs`) for cloud storage of orders, products, settings, and uploaded payment QRs.

### Steps to Publish on Netlify from GitHub
1. Push this folder to your GitHub repository.
2. In Netlify (`https://app.netlify.com`), click **Add new project → Import an existing project → GitHub** and pick your repository.
3. Netlify reads `netlify.toml` automatically:
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
   - **Build command:** `npm run build`
4. Click **Deploy site**. Once live (e.g., `https://happy-cones.netlify.app`), open `/standee` on your deployed site to print or download your public QR code!

---

## 💻 Run Locally on PC
```bash
node server.js
```
- Customer Menu: `http://localhost:3000`
- Standee QR Generator: `http://localhost:3000/standee`
- Admin Dashboard: `http://localhost:3000/admin` (PIN: `1234`)

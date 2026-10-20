# 🍔 FoodOrder — Online Food Ordering App

A full-stack food ordering platform (React + Node/Express + MongoDB Atlas,
real-time order tracking via Socket.io, S3-backed image uploads). This repo is
built to be **run as a single deployed service**, not just developed locally —
the backend serves the built React app itself, so there's one process and one
port to put behind a reverse proxy in production.

## 🌐 Live Demo
> Currently deployed via the Windows Server + AWS EC2 runbook in
> [`WINDOWS_DEPLOYMENT.md`](./WINDOWS_DEPLOYMENT.md).

---

## 🏗️ Production Architecture

```
Browser
   │  HTTPS (443) / HTTP (80)
   ▼
Reverse proxy (nginx)  ──▶  Node/Express process (PM2-managed, port 8000)
                                 ├─ Serves REST API under /api/*
                                 ├─ Serves built React app (frontend/build) for every other route
                                 ├─ Socket.io on the same HTTP server (needs WS upgrade headers at the proxy)
                                 └─ /health — used by a load balancer / uptime check
                                       │
                                       ├─▶ MongoDB Atlas (cloud, not self-hosted)
                                       └─▶ AWS S3 (menu/image uploads, via EC2 instance IAM role — no access keys on disk)
```

Key implication: **the frontend must be built (`npm run build`) and the
backend must run with `NODE_ENV=production`** for this single-process model to
serve the app — `backend/server.js` only mounts the React catch-all route and
`frontend/build` static files when `NODE_ENV=production`. In any other mode,
the backend is API-only and expects a separate frontend dev server.

---

## 🚀 Deploying

This section is the generic, platform-agnostic checklist. For a fully worked
example on Windows Server + AWS EC2 (networking, IAM, S3, nginx, PM2-as-a-service,
TLS, cost estimates, and every gotcha hit along the way), see
[`WINDOWS_DEPLOYMENT.md`](./WINDOWS_DEPLOYMENT.md) — it's a step-by-step runbook,
not just reference docs.

### 1. Provision the dependencies
- A **MongoDB Atlas** cluster (connection string, and the deploy target's
  outbound IP added to Atlas → Network Access).
- An **S3 bucket** for image uploads, plus an **IAM role** attached to the
  compute instance with `s3:PutObject` / `s3:GetObject` on that bucket only.
  `backend/routes/uploadRoutes.js` deliberately has no AWS access keys —
  it relies entirely on instance-attached IAM credentials.
- A **Gmail App Password** for transactional email (OTP, order status, promo
  notifications) via Nodemailer.

### 2. Configure environment variables
Copy both example files and fill them in — see the [Environment Variables](#-environment-variables) section below for what each one does.
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
`frontend/.env`'s `REACT_APP_API_URL` is **baked in at build time** by
Create React App — set it correctly *before* building, and rebuild (don't
just restart) if it ever changes (e.g. once a domain + TLS replace a bare IP).

### 3. Install, build, run
```bash
# Backend
cd backend
npm install
npm start               # or: pm2 start server.js --name foodorder

# Frontend — build once, the backend serves the output
cd ../frontend
npm install
npm run build
```
With `NODE_ENV=production` set, `backend/server.js` now serves both the API
and `frontend/build` on the same port (`PORT`, default `8000`).

### 4. Seed initial data (optional, first boot only)
```bash
cd backend
node seed-data.js
```
⚠️ **This wipes every collection first** (`deleteMany({})` on Users,
Restaurants, MenuItems, Orders, Reviews, Favorites, PromoCodes) before
reseeding — only run it against a fresh database, never against one with
real user data. See [Seed Data](#-seed-data) below for exactly what it creates.

### 5. Put a reverse proxy in front
nginx (or equivalent) should terminate TLS and proxy `/` to
`http://127.0.0.1:<PORT>`, forwarding WebSocket upgrade headers
(`Upgrade`/`Connection: upgrade`) — Socket.io needs these for live order
tracking to work through the proxy. Do **not** expose the Node port directly
to the internet.

### 6. Verify
- `GET /health` → `{"status":"ok","db":"connected"}` — wire this into your
  load balancer / uptime monitor.
- Smoke test end-to-end: register/login, browse restaurants, place an order,
  upload a menu image (exercises the S3 + IAM role path), confirm Socket.io
  live status updates work *through* the proxy, not just directly against
  the Node port.

---

## 🔐 Environment Variables

### `backend/.env`
| Variable | Purpose |
|---|---|
| `PORT` | Port the Node process listens on (default `8000`). |
| `NODE_ENV` | Set to `production` to serve the built React app + enable the production error-message policy. |
| `MONGODB_URI` | MongoDB Atlas connection string. |
| `JWT_SECRET` | Secret for signing auth tokens — generate fresh per deployment, never reuse across environments. |
| `JWT_EXPIRE` | Token lifetime, e.g. `30d`. |
| `CLIENT_URL` | Used for CORS and Socket.io's allowed origin — must match the public URL the frontend is actually served from. |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail address + App Password for Nodemailer (OTP, order, promo emails). |
| `AWS_REGION` | Region the S3 bucket lives in. |
| `S3_BUCKET_NAME` | Bucket for uploaded menu/restaurant images. |
| `CLOUDFRONT_URL` | Optional CDN in front of the bucket — leave blank to serve image URLs directly from S3. |

### `frontend/.env`
| Variable | Purpose |
|---|---|
| `REACT_APP_API_URL` | Base URL the frontend calls for the API. **Baked in at build time** — changing it requires a rebuild, not just a restart. |

---

## 🩺 Operational Notes

- **Health check**: `GET /health` reports `200` + `db: "connected"` when
  Mongo is up, `503` + `db: "not connected"` otherwise — safe to use as a load
  balancer target-group check.
- **MongoDB reconnection**: the backend retries the Atlas connection every 5s
  on failure rather than crashing — a transient Atlas blip doesn't require a
  process restart.
- **Scheduled orders**: a 60-second interval (started once Mongo connects)
  auto-confirms orders whose customer-chosen delivery time has arrived.
- **Image cache headers**: `/uploads` is served with `Cache-Control:
  public, max-age=604800` (7 days).
- **Process manager**: run under PM2 (or your platform's equivalent) so the
  app restarts on crash and on host reboot — see `WINDOWS_DEPLOYMENT.md` for
  registering PM2 as a native Windows Service.

---

## 🌱 Seed Data

`backend/seed-data.js` populates every collection with a consistent demo
dataset — useful for a fresh deployment's first login, or for resetting a
staging environment:

- **3 users**: `customer@gmail.com`, `owner@gmail.com`, `admin@gmail.com` (all password `pass123`)
- **8 restaurants** (Pizza Palace, Sri Balaji Fast Food Corner, Burger Kingdom,
  Spice Garden, Pure Veg Bhavan, Non-Veg Corner, Biryani Junction, Crispy
  Fried Chicken) × **6 menu items each** (48 total)
- **13 orders** for the customer, covering every order status
- **4 restaurant favorites**, **5 reviews** (with auto-recalculated restaurant
  ratings), and **3 promo codes** (two global, one restaurant-specific daily promo)

Run it with `node seed-data.js` from `backend/`. It connects using
`MONGODB_URI` from `.env` — point that at the right database before running.

---

## ✨ Features

### 👤 Customer
- OTP-based email registration & forgot password
- Browse restaurants with real-time open/closed status
- Multi-restaurant cart with persistent storage
- Smart promo codes (specific item discounts + auto-apply daily deals)
- Loyalty points system (Bronze → Silver → Gold → Platinum)
- Schedule delivery for a specific date & time
- Real-time order tracking with live status updates (Socket.io)
- In-app notifications with unread badge

### 🏪 Restaurant Owner
- Dashboard with live order notifications (no page refresh needed)
- Update order status in real-time
- Menu management with image uploads
- Create daily promo codes for customers
- Reply to customer reviews
- Set opening hours & weekly off days

### 👨‍💼 Admin
- Manage all users (activate/deactivate)
- Manage all restaurants
- View all orders platform-wide
- Create global promo codes

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, React Router, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Real-time | Socket.io |
| Auth | JWT + OTP Email Verification |
| Email | Nodemailer (Gmail) |
| File storage | AWS S3 (via instance IAM role) |
| Deployment | AWS EC2 (Windows Server), nginx, PM2 |

## 📁 Project Structure
```
food-ordering-app/
├── backend/
│   ├── controllers/    # Business logic
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API endpoints
│   ├── middleware/     # Auth middleware
│   ├── utils/          # Email service
│   ├── seed-data.js    # Demo data for a fresh deployment
│   └── server.js       # Entry point — API + production static serving
└── frontend/
    └── src/
        ├── pages/       # All page components
        ├── context/     # Auth & Cart context
        └── components/  # Navbar, Footer
```

## 🧑‍💻 Local Development (optional)

The app is designed around the single-process production model above, but
you can still run frontend and backend separately for development:

```bash
# Backend (API only — NODE_ENV left unset or non-production)
cd backend && npm install && npm start

# Frontend (separate dev server with hot reload)
cd frontend && npm install && npm start
```

---
> Built with AI-assisted development (Claude AI) —
> reflecting modern developer workflow

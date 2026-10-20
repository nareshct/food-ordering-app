# 🍔 FoodOrder — Deployment Guide

Food ordering platform (React + Node/Express + MongoDB Atlas, Socket.io
real-time tracking, S3-backed image uploads). **This repo exists to be
deployed and operated, not developed on day-to-day** — the backend compiles
down to a single process that serves both the API and the built frontend, and
that single-process model is the only supported way to run this app in
anything resembling production.

---

## Architecture

```
Browser
   │  HTTPS (443) / HTTP (80)
   ▼
Reverse proxy (nginx)  ──▶  Node/Express process (PM2-managed, port 8000)
                                 ├─ REST API under /api/*
                                 ├─ Built React app (frontend/build) for every other route
                                 ├─ Socket.io on the same HTTP server (needs WS upgrade headers at the proxy)
                                 └─ /health — load balancer / uptime target
                                       │
                                       ├─▶ MongoDB Atlas (cloud, not self-hosted)
                                       └─▶ AWS S3 (image uploads, via instance IAM role — no access keys on disk)
```

One process, one port. `backend/server.js` only mounts the React catch-all +
`frontend/build` static files when `NODE_ENV=production`; otherwise it's
API-only. There is no supported "frontend server + backend server" split in
production — if both are running separately, something is misconfigured.

---

## What you need provisioned before deploying

| Dependency | Why | Env var(s) |
|---|---|---|
| **MongoDB Atlas cluster** | Primary datastore — not self-hosted Mongo | `MONGODB_URI` |
| **Compute instance** (EC2 or equivalent) reachable on 80/443 | Runs the Node process behind nginx | — |
| **S3 bucket** | Menu/restaurant image uploads | `S3_BUCKET_NAME`, `AWS_REGION` |
| **IAM role attached to the instance** with `s3:PutObject`/`s3:GetObject` on that bucket only | `backend/routes/uploadRoutes.js` has no AWS keys in it by design — credentials come from the instance role | — |
| **Gmail App Password** | Nodemailer sends OTP, order-status, and promo emails | `EMAIL_USER`, `EMAIL_PASS` |
| **Domain + TLS cert** (optional but recommended) | win-acme/certbot can't issue a cert for a bare IP | `CLIENT_URL` |

---

## Deploy

### 1. Configure environment
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Fill in both using the [Environment Variables](#environment-variables) table
below. `frontend/.env`'s `REACT_APP_API_URL` is **baked in at build time** by
Create React App — get it right *before* step 2, and rebuild (not just
restart) whenever it changes (e.g. bare IP → real domain later).

### 2. Install and build
```bash
cd backend  && npm install
cd ../frontend && npm install && npm run build
```

### 3. Run the backend under a process manager
```bash
cd backend
pm2 start server.js --name foodorder --env production
pm2 save
```
With `NODE_ENV=production`, this single process now serves the API **and**
`frontend/build` on `PORT` (default `8000`). Don't run `npm start` directly
in production — PM2 (or an equivalent supervisor) is what restarts the app on
crash and on host reboot.

### 4. Front it with a reverse proxy
nginx (or equivalent) terminates TLS and proxies `/` to
`http://127.0.0.1:<PORT>`, forwarding `Upgrade`/`Connection: upgrade` headers
— Socket.io needs these to work through the proxy. **Never expose the Node
port directly to the internet.**

### 5. Seed the database (first boot only)
```bash
cd backend
node seed-data.js
```
⚠️ **Destructive**: wipes every collection (`deleteMany({})` on Users,
Restaurants, MenuItems, Orders, Reviews, Favorites, PromoCodes) before
reseeding. Only run against a fresh database — see [Seed Data](#seed-data).

### 6. Verify the deployment
- `GET /health` → `{"status":"ok","db":"connected"}`. Wire this into the load
  balancer / uptime monitor — `503` + `db: "not connected"` means Mongo is
  unreachable.
- Log in with a seeded account, place an order, upload a menu image (exercises
  the S3 + IAM role path end-to-end), and confirm Socket.io status updates
  arrive live — through the proxy, not just directly against the Node port.

---

## Environment Variables

### `backend/.env`
| Variable | Purpose |
|---|---|
| `PORT` | Port the Node process listens on (default `8000`). |
| `NODE_ENV` | Must be `production` to serve the built frontend + suppress internal error details in API responses. |
| `MONGODB_URI` | MongoDB Atlas connection string. |
| `JWT_SECRET` | Signs auth tokens — generate fresh per deployment, never reuse across environments. |
| `JWT_EXPIRE` | Token lifetime, e.g. `30d`. |
| `CLIENT_URL` | CORS + Socket.io allowed origin — must match the public URL the frontend is actually served from. |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail address + App Password for Nodemailer. |
| `AWS_REGION` | Region the S3 bucket lives in. |
| `S3_BUCKET_NAME` | Bucket for uploaded images. |
| `CLOUDFRONT_URL` | Optional CDN in front of the bucket — blank serves image URLs directly from S3. |

### `frontend/.env`
| Variable | Purpose |
|---|---|
| `REACT_APP_API_URL` | API base URL. **Baked in at build time** — a rebuild is required after any change. |

---

## Operations

- **Health check**: `GET /health` → `200`/`db:"connected"` when Mongo is up,
  `503`/`db:"not connected"` otherwise. Use it as the load-balancer target
  check.
- **Mongo reconnection**: on connection failure the backend retries every 5s
  instead of crashing — a transient Atlas blip doesn't need a process restart.
- **Scheduled orders**: a 60s interval (starts once Mongo connects)
  auto-confirms orders whose customer-chosen delivery time has arrived. If
  this stops happening, check the process is actually running, not just the
  reverse proxy.
- **Image caching**: `/uploads` is served with `Cache-Control: public,
  max-age=604800` (7 days) — account for this when testing a just-replaced image.
- **Deploying an update**: `git pull`, reinstall if `package.json` changed,
  `npm run build` in `frontend/` (always, even for backend-only changes that
  touch shared config), then `pm2 restart foodorder`. Restart (not just
  `.env` edit) is required for env var changes to take effect.
- **Rolling back**: `git checkout <previous-tag-or-commit>`, repeat the build
  + restart steps. There's no blue/green or multi-instance setup here — a
  rollback means a few seconds of downtime.

---

## Seed Data

`backend/seed-data.js` populates every collection with a consistent demo
dataset — useful for a fresh deployment's first login, or resetting staging:

- **3 users**: `customer@gmail.com`, `owner@gmail.com`, `admin@gmail.com` (password `pass123`)
- **8 restaurants** (Pizza Palace, Sri Balaji Fast Food Corner, Burger Kingdom,
  Spice Garden, Pure Veg Bhavan, Non-Veg Corner, Biryani Junction, Crispy
  Fried Chicken) × **6 menu items each** (48 total)
- **13 orders** covering every order status, **4 favorites**, **5 reviews**
  (auto-recalculates restaurant ratings), **3 promo codes**

Connects using `MONGODB_URI` from `.env` — point that at the intended
database before running.

---

## What's actually running (for context, not a feature pitch)

Customer-facing: auth with OTP email verification, restaurant browsing with
live open/closed state, cart, promo codes (global + per-restaurant daily
auto-apply), loyalty points, scheduled delivery, live Socket.io order
tracking, in-app notifications.

Restaurant-owner-facing: live order dashboard, menu/image management, daily
promo creation, review replies, opening-hours config.

Admin-facing: user/restaurant management, platform-wide order visibility,
global promo codes.

Stack: React + React Router + Axios · Node/Express · MongoDB Atlas/Mongoose ·
Socket.io · JWT + OTP auth · Nodemailer (Gmail) · AWS S3 via IAM role · nginx
+ PM2 on AWS EC2 (Windows Server).

---

Need to run this outside a deployment (debugging a bug locally, say)? API-only
backend: `cd backend && npm install && npm start` (leave `NODE_ENV` unset).
Separate hot-reload frontend: `cd frontend && npm install && npm start`. This
is a fallback for poking at the code, not the intended way to run the app.

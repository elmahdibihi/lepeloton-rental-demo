# Le Peloton Café — Unified Superapp

Single zero-dependency web platform unifying **Le Peloton Café** (`lepelotoncafe.cc`), **Bike Rentals** (`app.booking.bike.rent`), **Guided Bike About Tours** (`bikeabouttours.com`), **Cycling Club Ride Leader Scheduling**, **Le Peloton Studio (`l’Échappée`)** inquiries, and **Staff / Workshop Operations** (`/admin`).

## Quickstart (Node 22.5+ / Node 24)

```bash
cp .env.example .env
npm start
```

- **Storefront:** `http://localhost:3000/` (public Cycling Club links directly to [Strava Club](https://www.strava.com/clubs/731978), with zero internal leader exposure)
- **Internal Ride Leaders Portal:** printed in terminal on boot (`http://localhost:3000/leaders?key=...`) — vetted roster sign-up/withdraw, optional `GOOGLE_SHEETS_WEBHOOK_URL` mirror
- **Staff & Workshop Ops:** printed in terminal on boot (`http://localhost:3000/admin?key=...`) — includes 1-click CSV export (`/api/admin/club/export.csv`)
- **Automated test suite:** `npm test`

## Plug-and-Play Stripe

1. Leave `STRIPE_SECRET_KEY` empty in `.env` to run in **zero-fee instant reservation mode** (locks live SQLite stock and issues `LPC-...` references immediately).
2. Paste `STRIPE_SECRET_KEY=sk_live_...` (or `sk_test_...`) in `.env` to automatically switch checkout to **Stripe Checkout** (`EUR`, 20% French VAT breakdown).
3. Point a Stripe webhook (`checkout.session.completed`, `checkout.session.expired`) to `https://<your-domain>/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET=whsec_...`.

## Plug-and-Play Hosting (Hetzner / Coolify / VPS / Personal Server)

```bash
cp .env.example .env
docker compose up -d --build
```

SQLite WAL data and staff config persist in `./data`. The frontend also degrades cleanly to static preview mode when hosted on GitHub Pages.

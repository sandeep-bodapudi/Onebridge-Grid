# Hosted prototype: deploy and run

The prototype is **one** Render web service defined in [`render.yaml`](../../render.yaml) (D-SINGLE-SERVICE). `scripts/single-server.mjs` runs the API, the admin app and the public site behind one URL:

| Path | Served by |
|---|---|
| `/`, `/login`, `/dashboard` | Admin app and product homepage (dashboard behind the optional passcode) |
| `/svc/identity`, `/svc/organization`, `/svc/cards` | API (identity, organization and cards in one process, demo data seeded on every start) |
| `/c/...`, `/r/<code>`, `/<company>` | Public site: visitor cards, short links, company pages |
| `/healthz` | Health check |

**Demo data only.** The API uses the fake one-time-code provider (code `123456`) and an in-memory database that resets on every restart. Never add real customers, phone numbers or leads.

## 1. Deploy (one time)

1. In Render: **New → Web Service**, pick the repository and the `main` branch (or **New → Blueprint** to read `render.yaml`).
2. Settings:

   | Setting | Value |
   |---|---|
   | Runtime | Node |
   | Build command | `corepack enable && pnpm install --frozen-lockfile && node scripts/single-build.mjs` |
   | Start command | `node scripts/single-server.mjs` |
   | Health check path | `/healthz` |
   | Instance type | Standard (2 GB). Three Node processes and an in-memory MongoDB do not fit in 512 MB. |

3. Environment variables:

   | Variable | Required? | Value |
   |---|---|---|
   | `NODE_VERSION` | Yes | `22` |
   | `DEMO_ACCESS_PASSCODE` | Optional | Passcode for the dashboard; the homepage, cards and company pages stay public |
   | `DEMO_RESET_KEY` | Optional | Presenter key for `POST /demo/reset` |
   | `PUBLIC_URL` | Recommended | The service's address, e.g. `https://onebridge-grid.onrender.com` or your custom domain. Used in QR codes, short links and vCards. Falls back to Render's `RENDER_EXTERNAL_URL` |

   Do not set `NODE_ENV`: the build needs development dependencies, and the launcher sets it for each part itself.

   Secrets (`JWT_SECRET`, `ENCRYPTION_KEY` and the rest) are generated at every start because the data is thrown away anyway. They are required only if you point `MONGODB_URI` at a real database.
4. Wait for `/healthz` to turn green. The first start downloads MongoDB and seeds the demo company, which takes 1–2 minutes.

The public URL is built into the browser code, so redeploy after adding a custom domain or changing `PUBLIC_URL`.

## 2. Check it works (5 minutes, before every meeting)

1. Open the app URL. Enter the passcode. Tap **Open the demo company**. The overview shows Sahyadri Steel Works with 7 of 8 cards live and 4 leads.
2. Reload the page. You stay signed in. (If you are sent to sign-in, the cookie path or proxy is wrong: check `COOKIE_PATH=/svc/identity/auth` on the API and `API_PROXY_TARGET` on the app.)
3. Cards → Rohit Deshmukh → the QR image appears. Scan it with a phone: Rohit's card opens on the cards URL.
4. On the phone: **Share your details back**, send a test lead. In the dashboard, **Leads** shows it within a few seconds.
5. Cards → change a job title → **Save changes** → reload the card on the phone: it shows the new title.

## 3. Reset the demo

To wipe changes and start from fresh demo data:

```bash
curl -X POST -H "X-Demo-Reset-Key: <DEMO_RESET_KEY>" https://onebridge-grid.onrender.com/demo/reset
```

The API restarts and reseeds in about a minute. Restarting the API service from the Render dashboard does the same.

## 4. Run the same setup locally

```bash
pnpm --filter "@onebridge/shared" --filter "@onebridge/api-contracts" run build
```

```bash
pnpm --filter "@onebridge/identity" --filter "@onebridge/organization" --filter "@onebridge/cards" run build
```

Then start the `demo-api-local` and `demo-app-local` configurations in `.claude/launch.json` (API on :8080, dashboard on :3002 with passcode `sahyadri-demo`). For everyday development use `pnpm dev` instead.

# Deployment Guide (Free / Low-Cost)

This app is a monorepo with:
- **Web**: Next.js (`apps/web`) → deploy on **Vercel** (free)
- **API**: NestJS (`apps/api`) → deploy on **Render** or **Railway** (free tier with limits)
- **Database**: SQLite locally → use **Turso** or **Neon** in production

## Recommended free stack

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | [Vercel](https://vercel.com) | Free |
| Backend API | [Render](https://render.com) Web Service | Free (sleeps after inactivity) |
| Database | [Turso](https://turso.tech) (SQLite-compatible) | Free tier |
| Cron (daily scan) | [cron-job.org](https://cron-job.org) | Free |
| Domain | Vercel/Render subdomain or your own domain | Free / included |

## Quick deploy checklist (≈15 minutes)

### A. Push code to GitHub
Your repo: `https://github.com/NirTimor/BettingScanner`

### B. Deploy API on Render (free)

**If you already created a Web Service** (like `BettingScanner`), fix Settings → Build & Deploy:

| Setting | Value |
|---------|-------|
| Root Directory | *(leave empty / repo root)* |
| Build Command | `npm install -g pnpm@8.15.0 && pnpm install --no-frozen-lockfile --prod=false && pnpm --filter api exec prisma generate && pnpm --filter api build` |
| Start Command | `cd apps/api && node dist/main` |

**Do not** use `pnpm build` / `turbo` — that builds the whole monorepo and fails on Render free.

Env vars:
- `THE_ODDS_API_KEY`
- `API_FOOTBALL_KEY`
- `FOOTBALL_DATA_TOKEN` (recommended for World Cup stats)
- `ADMIN_EMAILS` = your login email
- `DATABASE_URL` = `file:./dev.db` (used only for Prisma CLI locally / build)
- `TURSO_DATABASE_URL` = your Turso URL (production persistence)
- `TURSO_AUTH_TOKEN` = your Turso auth token
- `ALLOWED_ORIGINS` = your Vercel URL
- `NODE_ENV` = `production`

Then **Manual Deploy → Clear build cache & deploy**.

Alternative: **New → Blueprint** → select repo (reads `render.yaml`).

Copy your API URL, e.g. `https://bettingscanner.onrender.com`

### C. Deploy Web on Vercel (free)
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. **Add New Project** → import `BettingScanner`
3. Settings:
   - **Root Directory**: `apps/web`
   - **Framework**: Next.js (auto-detected)
4. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://betting-scanner-api.onrender.com
   NEXT_PUBLIC_SITE_URL=https://YOUR-PROJECT.vercel.app
   ```
5. Deploy → copy your Vercel URL

### D. Connect frontend ↔ API
1. Back in **Render** → your API service → **Environment**
2. Set `ALLOWED_ORIGINS` to your Vercel URL:
   ```
   https://YOUR-PROJECT.vercel.app
   ```
3. Save → Render redeploys automatically

### E. Test
1. Open your Vercel URL
2. Register / login
3. Run scan (admin only — your email must be in `ADMIN_EMAILS`)
4. Check World Cup recommendations appear

### F. Daily cron (optional)
Free Render sleeps → use [cron-job.org](https://cron-job.org):
- `POST https://betting-scanner-api.onrender.com/betting/scan`
- Header: `Authorization: Bearer YOUR_TOKEN`
- Schedule: daily 08:00

---

## Step 1: Database (Turso) — persistent production DB

Prisma Migrate cannot talk to Turso over HTTP. Use this one-time setup:

### 1) Create Turso DB
1. Sign up at [turso.tech](https://turso.tech)
2. Install CLI (Windows PowerShell):
   ```powershell
   irm get.tur.so/install.ps1 | iex
   ```
3. Login + create DB:
   ```bash
   turso auth login
   turso db create betting-scanner
   turso db show betting-scanner --url
   turso db tokens create betting-scanner
   ```

### 2) Apply schema once
From the repo root:
```bash
turso db shell betting-scanner < apps/api/prisma/turso-init.sql
```

### 3) Set on Render → Environment
```
TURSO_DATABASE_URL=libsql://betting-scanner-....turso.io
TURSO_AUTH_TOKEN=your_token
DATABASE_URL=file:./dev.db
```

Then redeploy the API. Logs should show: `Connected to Turso database`.

Local development keeps using SQLite (`DATABASE_URL=file:./dev.db`) and does **not** need Turso vars.

## Step 2: Deploy API (Render)

1. Connect your GitHub repo to Render.
2. Create a **Web Service** (or update existing):
   - Build: `npm install -g pnpm@8.15.0 && pnpm install --no-frozen-lockfile --prod=false && pnpm --filter api exec prisma generate && pnpm --filter api build`
   - Start: `cd apps/api && node dist/main`
3. Set environment variables:

```env
THE_ODDS_API_KEY=your_key
API_FOOTBALL_KEY=your_key
FOOTBALL_DATA_TOKEN=your_token
DATABASE_URL=file:./dev.db
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
ADMIN_EMAILS=your@email.com
NODE_ENV=production
```

4. Note your API URL, e.g. `https://bettingscanner.onrender.com`

## Step 3: Deploy Web (Vercel)

1. Import the repo in Vercel.
2. Set root directory to `apps/web`.
3. Environment variables:

```env
NEXT_PUBLIC_API_URL=https://bettingscanner.onrender.com
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

4. Deploy.

## Step 4: Daily scan cron (important)

Render free tier sleeps → built-in `@Cron` may not run reliably.

Use **cron-job.org**:
1. Create a daily job at 08:00 UTC (or your timezone).
2. URL: `POST https://your-api.onrender.com/betting/scan`
3. Header: `Authorization: Bearer <admin-session-token>`

For results update, schedule:
`POST https://your-api.onrender.com/betting/results/auto`

## Step 5: Custom domain (optional)

### On Vercel (web)
1. Project → Settings → Domains → add `yourdomain.com`
2. Point DNS CNAME to `cname.vercel-dns.com`

### On Render (API)
1. Service → Settings → Custom Domain → add `api.yourdomain.com`
2. Add the CNAME Render provides

Update env:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## Before going public

- Set `ADMIN_EMAILS` in production
- Add `FOOTBALL_DATA_TOKEN` for World Cup / league form stats
- Replace SQLite file DB with Turso/Neon
- Set up external cron for scan + results
- Test login, recommendations, World Cup filter, stats page

## Cost notes

- **The Odds API**: free tier ~500 requests/month (each league = 1 request per scan)
- **API-Football**: free tier limited daily calls
- **Football-Data.org**: free token, rate-limited
- World Cup adds 1 extra Odds API call per daily scan

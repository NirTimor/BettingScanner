# Betting Scanner

A standalone application for scanning and analyzing value bets from The Odds API.

## Project Structure

This is a monorepo managed by `pnpm` and `turbo`.

- `apps/api`: NestJS Backend
  - Scans odds using The Odds API
  - Stores recommendations in SQLite
  - Exposes REST endpoints
- `apps/web`: Next.js Frontend
  - Displays betting recommendations
  - Supports English and Hebrew via `next-intl`

## getting Started

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Setup Database**
   ```bash
   cd apps/api
   npx prisma db push
   ```

3. **Run Development**
   ```bash
   pnpm dev
   ```

   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend: [http://localhost:3001](http://localhost:3001)

## API Key

The project uses `The Odds API`. The key is configured in `apps/api/.env`.

# Outlet performance dashboard

A Vite app (plain JavaScript, no framework) that shows weekly sales vs target per outlet, read live from the `outlet_weekly` table in Supabase.

## Run locally

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
npm run dev
```

## Deploy to Vercel

1. Import this folder as a Vercel project (framework preset: **Vite**).
2. Under **Settings > Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`.
3. Deploy. Vercel runs `npm run build` and serves the `dist` folder.

Changing the environment variables needs a redeploy, because Vite bakes them in at build time.

## Data

All data access is in `loadData()` in `src/main.js`. Outlet filter buttons are built from the outlets present in the table, so adding or removing an outlet in Supabase needs no code change.

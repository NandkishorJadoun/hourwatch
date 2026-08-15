# first6

A minimal TanStack Start app with one route and plain CSS.

```bash
pnpm install
pnpm dev
```

Edit `src/routes/index.tsx` to get started. Add route files under
`src/routes`; TanStack Router updates `src/routeTree.gen.ts` for you.

Build the production app with:

```bash
pnpm build
```

## Deploy to Cloudflare Workers

This project uses the Cloudflare Vite plugin (configured in `vite.config.ts`) and `wrangler.jsonc`:

1. Install Wrangler: `npm install -g wrangler`
2. Authenticate: `wrangler login`
3. Deploy: `npx wrangler deploy`

For production env vars, run `wrangler secret put MY_VAR` for each secret listed in `.env.example`. Public (non-secret) vars go in `wrangler.jsonc` under `vars`.

KV, D1, R2, and Durable Object bindings are configured in `wrangler.jsonc` — see https://developers.cloudflare.com/workers/wrangler/configuration/.

## Database (Cloudflare D1)

The app uses D1 (bound as `DB`) with the Drizzle schema in `src/db/schema.ts`.

A D1 database must exist before deploying or migrating:

```bash
wrangler d1 create first6-db   # prints a database_id
```

Paste the printed `database_id` into the `d1_databases` entry in `wrangler.jsonc`.

Regenerate SQL migrations from the schema when you change it:

```bash
pnpm drizzle:generate
```

Apply migrations to the local dev database or the remote production database:

```bash
pnpm drizzle:migrate --local    # local (workerd)
pnpm drizzle:migrate --remote   # production
```



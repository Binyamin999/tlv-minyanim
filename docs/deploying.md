# Deploying

The site is server-rendered and reads Postgres on every request, so it needs a
host that runs Node and a database that speaks PostGIS. That rules out GitHub
Pages and any other static host: a frozen page would still say
"בעוד 6 שעות" tomorrow, and confidently wrong times are the one thing this
project exists to prevent.

Vercel gives the same experience GitHub Pages does — connect the repo, get a
URL, every push redeploys — and actually runs the server. Both tiers below are
free.

---

## What only you can do

**1. A Postgres with PostGIS.** [Neon](https://neon.tech) free tier is ample —
17 synagogues and 78 minyanim is nothing. Create a project, then copy the
connection string. Vercel Postgres and Supabase also work; anything without
PostGIS does not, and `npm run migrate` will say so rather than failing
obscurely.

**2. A Vercel account**, connected to `Binyamin999/tlv-minyanim`. Import the
repo; the framework is detected and the build command is the default.

**3. Two environment variables**, set in Vercel's project settings:

| | |
|---|---|
| `DATABASE_URL` | the connection string from step 1 |
| `NEXT_PUBLIC_SITE_URL` | the deployed URL, e.g. `https://tlv-minyanim.vercel.app` |

`NEXT_PUBLIC_SITE_URL` is what canonical links and `hreflang` alternates are
built from. Wrong, and every page tells search engines it lives somewhere else
— which matters here more than most places, since SEO is the whole discovery
strategy.

---

## What happens next

```bash
DATABASE_URL="<the Neon string>" npm run migrate      # 11 migrations, in order
DATABASE_URL="<the Neon string>" npm run import:seed  # 17 shuls, 78 minyanim
```

`migrate` records what it has applied in `schema_migrations`, so it is safe to
run repeatedly and will say "nothing to do". Verified on an empty database:
eleven applied, a second run a no-op, then a full seed and query against the
fresh schema.

The seed runs **from a laptop, not from CI**, and that is deliberate.
`data/seed-ramat-aviv.json` carries 442 gabbai and rabbi phone numbers, is
gitignored, and must never reach a build server. Nothing personal reaches the
database either — there is no phone column in the schema, so the numbers are
read during import and dropped.

---

## Where the code runs

`vercel.json` pins functions to **`fra1`**, the same region as the database.

This is not a micro-optimisation. Vercel defaults new projects to `iad1`
(Washington DC) regardless of where the data is, and `x-vercel-id` showed
`fra1::iad1::` — the request reaching Frankfurt's edge and then being handed to
a function in Virginia, which queried Frankfurt. Every page makes two queries,
so each request crossed the Atlantic four times before rendering. Server time
was ~650 ms.

Choosing Frankfurt for the database to be near Tel Aviv, and then leaving the
code in Virginia, is worse than putting both in Ohio would have been.

Check it after any deploy: `curl -sI <url>/he | grep x-vercel-id` — the second
segment is the function region and must read `fra1`.

## Once it is up

**HTTPS makes the location feature work.** It is the reason `מצאו מניין לידי`
does nothing over the LAN address today: browsers hand out a position only in
a secure context, and `http://192.168.1.105:3100` is not one.

**Check the time zone.** Everything resolves in `Asia/Jerusalem` explicitly,
so a server in another zone is not a problem — but confirm the homepage's
countdown against a watch before showing anyone.

**Watch the validity windows.** Verified times carry the week they were read
in, and outside it a shul reads as honestly unknown rather than stale. That is
the design, and it means the site needs boards re-read weekly until enough
times are stored as rules.

## Checking traffic

`<Analytics />` in the root layout sends a page view per load; the numbers live
in Vercel and nowhere else. Three ways to read them, in ascending order of
effort:

**The dashboard** — vercel.com -> tlv-minyanim -> Analytics. Visitors, page
views, top pages, referrers, countries. Panels export to CSV, up to 250 rows.

**The MCP server in this repo** — `scripts/mcp/analytics-server.mjs`, wired up
in `.mcp.json`, so an assistant can answer "how many people came this week"
without anyone opening a dashboard. Four tools: `traffic_summary`,
`traffic_by_day`, `traffic_breakdown`, `analytics_schema`.

It is read-only by construction. The subprocess is always `vercel metrics` —
a string literal in the file — every argument is an integer in a range or a
member of an allowlist, and it uses `execFile`, so there is no shell. Zero
dependencies: MCP over stdio is newline-delimited JSON-RPC and the four
methods a tools-only server needs are shorter than the SDK's import line.
Tested in `test/mcp-analytics.test.ts`.

**Vercel's own MCP was the obvious alternative and was deliberately not used.**
`https://mcp.vercel.com` is better at everything except the property that
decided it: authorising it grants the same access as the Vercel account —
projects, deployments, runtime logs, environment variables. `DATABASE_URL` is
an environment variable on this project. A traffic counter should not come
with the database credentials attached.

**The CLI**, which the MCP server wraps, and which needs `vercel login` once:

```
npx vercel metrics vercel.analytics_pageview.count \
  --since 7d --granularity 1d --project tlv-minyanim --prod

npx vercel metrics vercel.analytics_pageview.count \
  --aggregation unique/visitor_id --since 30d --project tlv-minyanim --prod
```

Hobby includes 50k events a month and a **one-month reporting window**. The
window binds the charts, not the lifetime total: `visits/count` in the REST API
answers "how many people have ever opened this" without it.

**Vercel cannot say what people searched for to get here.** It only sees a
visitor once they have arrived. Since SEO is the discovery strategy, Google
Search Console is the other half — free, sixteen months of history, and the
only place impressions and ranking appear. It is blind to the WhatsApp traffic
that is most of today's, so the two are complements rather than alternatives.

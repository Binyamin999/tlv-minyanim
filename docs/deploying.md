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

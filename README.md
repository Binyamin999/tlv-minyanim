# TLV Minyanim

Finding a minyan in Tel Aviv-Yafo, in Hebrew and English.

**The product is the times, not the buildings.** Anyone can scrape a synagogue
directory. Nobody in Tel Aviv can currently answer *"where can I daven in the
next 40 minutes?"*

`CLAUDE.md` is the binding contract — read it before changing anything. This
file is only how to run the thing.

---

## Setup

Postgres 17 with PostGIS, via Homebrew:

```bash
brew install postgresql@17 postgis && brew services start postgresql@17
```

Then create the database and apply the migrations in order:

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
createdb tlv_minyanim
psql -v ON_ERROR_STOP=1 -d tlv_minyanim -f db/migrations/0001_init.sql
psql -v ON_ERROR_STOP=1 -d tlv_minyanim -f db/migrations/0002_shiurim_and_parse_issues.sql
```

Put the connection URL in `.env.local` (gitignored, never committed):

```
DATABASE_URL=postgres:///tlv_minyanim
```

Install and load the seed data:

```bash
npm install && npm run import:seed
```

The import is idempotent — re-running it changes no row ids.

---

## Commands

| | |
|---|---|
| `npm run dev` | dev server on :3000 |
| `npm test` | the full suite |
| `npm run typecheck` | both projects — parser and app |
| `npm run import:seed` | load `data/seed-ramat-aviv.json` through the parser |
| `npm run coverage` | how much of the source data actually parsed |

Routes: `/he` and `/en`, `/{locale}/next`, `/{locale}/shul/{slug}`.

---

## Layout

```
src/minyan-times/   the parser — Hebrew free text to structured values.
                    Standalone: no framework, no database, no runtime deps.
src/zmanim/         rules to instants. Computes nothing itself; @hebcal/core does.
src/db/             queries. Plain SQL, no ORM — the schema is the source of truth.
src/app/[locale]/   pages. Server-rendered; every shul page must be crawlable.
db/migrations/      schema. The time invariant is a CHECK constraint here.
docs/               zmanim ground truth, sourced independently of the code.
data/               seed data. GITIGNORED — see below.
```

---

## Two things that will trip you up

**`data/seed-ramat-aviv.json` is gitignored and must stay that way.** It carries
gabbai and rabbi names and personal phone numbers, which are personal data under
Israeli privacy law. There are no columns for them in the schema, the importer
deletes those fields at the read boundary, and nothing may log, print, or fixture
them. If you need seed data and do not have this file, ask — do not reconstruct
it from the GIS layer into the repo.

**Do not serve the repo root over HTTP.** `python3 -m http.server` does not read
`.gitignore`, so it happily serves the file above to anyone on the network. The
artboard preview in `.claude/launch.json` is bound to `127.0.0.1` for this
reason. Leave it that way.

---

## State

Built: the parser, the schema, the import, shul pages with `schema.org`, the
zmanim engine, and the next-minyan timeline. 250 tests.

Not built: the designed homepage (the artboards in `*.dc.html` are the
reference), geo search, and the nightly refresh job.

**The gap that matters is not code.** Shacharit is fully known for all 16 shuls;
Mincha is 69% unknown, and exactly one shul in Ramat Aviv publishes a real
offset. The afternoon timeline stays thin until gabbaim are asked. That is
twelve conversations, not a feature.

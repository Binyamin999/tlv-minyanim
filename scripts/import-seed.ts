/**
 * import-seed — data/seed-ramat-aviv.json -> Postgres, through the parser.
 *
 *   npm run import:seed
 *
 * Three properties this script is built around:
 *
 * 1. IDEMPOTENT. Re-running it must not duplicate anything. Every table has a
 *    natural key from the source (`gis_source_id`; then "the nth time in this
 *    synagogue's weekday/shabbat field"), and rows that vanish from the source
 *    are deleted rather than left behind as orphans.
 *
 * 2. ALL OR NOTHING. One transaction for the whole file. A half-imported city
 *    is worse than an empty one, because it looks finished.
 *
 * 3. LOUD. Nothing the parser produces is silently dropped. Shiurim go to
 *    `shiurim`, issues go to `parse_issues`, and anything that should be
 *    impossible — a minyan with no day_type, an unattributed minyan carrying
 *    no review reason — throws and rolls the whole run back.
 *
 * PRIVACY. The seed file carries rabbi and gabbai names and personal phone
 * numbers. The schema has no columns for them, by design (see 0001). This
 * script must never read, insert, log or otherwise surface those fields; the
 * allowlist in `readSeed` is the enforcement, not a convention.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { PoolClient } from 'pg';

import { closePool, withTransaction } from '../src/db/client.ts';
import { curatedMovement, curatedNameEn } from '../src/lib/curation.ts';
import { verifiedFor, type VerifiedSynagogue } from '../src/lib/verified-times.ts';
import { slugCandidates } from '../src/lib/slug.ts';
import { parseMinyanTimes } from '../src/minyan-times/index.ts';
import type {
  DayType,
  ParsedMinyan,
  ParseIssue,
  ParseResult,
  ShiurFinding,
} from '../src/minyan-times/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(HERE, '../data/seed-ramat-aviv.json');

/* ------------------------------------------------------------------ */
/* Reading the seed — the privacy boundary                             */
/* ------------------------------------------------------------------ */

/**
 * Personal data under Israeli privacy law. Named here so the omission is
 * deliberate and greppable rather than an oversight: rabbi_he, gabbai_he,
 * gabbai_phone_raw, phone_raw. Nothing below may reference them.
 */
const PERSONAL_FIELDS = ['rabbi_he', 'gabbai_he', 'gabbai_phone_raw', 'phone_raw'] as const;

/** Exactly the fields this importer is allowed to see. */
interface SeedSynagogue {
  source_id: number;
  name_he: string;
  address_he: string | null;
  street_he: string | null;
  house_number: string | null;
  neighborhood_he: string | null;
  lat: number;
  lng: number;
  nusach_raw: string | null;
  movement: string | null;
  weekday_times_raw: string | null;
  shabbat_times_raw: string | null;
  daf_yomi_raw: string | null;
  status: string | null;
  last_verified_at: string | null;
  verified_by: string | null;
}

function readSeed(): SeedSynagogue[] {
  const parsed: unknown = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const list = (parsed as { synagogues?: unknown }).synagogues;
  if (!Array.isArray(list)) throw new Error(`${SEED_PATH} has no "synagogues" array`);

  // Copy field by field. Spreading the source object would carry the personal
  // fields along into every downstream value, and one careless log line would
  // then leak them.
  return list.map((row) => {
    const r = row as Record<string, unknown>;
    for (const field of PERSONAL_FIELDS) {
      if (field in r) delete r[field];
    }
    return {
      source_id: Number(r.source_id),
      name_he: String(r.name_he),
      address_he: str(r.address_he),
      street_he: str(r.street_he),
      house_number: str(r.house_number),
      neighborhood_he: str(r.neighborhood_he),
      lat: Number(r.lat),
      lng: Number(r.lng),
      nusach_raw: str(r.nusach_raw),
      movement: str(r.movement),
      weekday_times_raw: str(r.weekday_times_raw),
      shabbat_times_raw: str(r.shabbat_times_raw),
      daf_yomi_raw: str(r.daf_yomi_raw),
      status: str(r.status),
      last_verified_at: str(r.last_verified_at),
      verified_by: str(r.verified_by),
    } satisfies SeedSynagogue;
  });
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/* ------------------------------------------------------------------ */
/* Enum mapping                                                        */
/* ------------------------------------------------------------------ */

/**
 * The source labels nusach in Hebrew. Note what is deliberately absent:
 *
 *  - `תימני` alone maps to NULL, not to a guess. The enum distinguishes
 *    teimani_baladi from teimani_shami and the source does not, so choosing
 *    one would be inventing a fact about a congregation's liturgy. NULL, and
 *    the run reports it by name for hand enrichment.
 *  - Nothing here can ever produce a `movement`. Both Ramat Aviv Chabad houses
 *    are tagged `אשכנז`; inferring movement from nusach is forbidden.
 */
const NUSACH: Record<string, string> = {
  אשכנז: 'ashkenaz',
  ספרד: 'sefard',
  'עדות המזרח': 'edot_hamizrach',
  מרוקאי: 'moroccan',
  תוניסאי: 'tunisian',
  עיראקי: 'iraqi',
  פרסי: 'persian',
  סלוניקאי: 'salonikan',
  כללי: 'general',
};

/** movement comes only from the hand-enrichment column, never from nusach. */
const MOVEMENT = new Set(['chabad', 'breslev']);

const SYNAGOGUE_STATUS = new Set(['active', 'holidays_only', 'seasonal', 'dormant', 'closed']);

/* ------------------------------------------------------------------ */
/* Assertions — the things that must be impossible                     */
/* ------------------------------------------------------------------ */

/**
 * `isPublishable()` in TypeScript asks only whether `needsReview` is empty.
 * The database's generated `is_publishable` additionally requires a service
 * and a day_type. That divergence is resolved HERE, at the boundary, rather
 * than by loosening either side:
 *
 *  - day_type is never null, because we always know which column the string
 *    came from. A null is an import bug and throws.
 *  - service may be null, but only ever alongside an `unattributed_service`
 *    review reason — so the DB's extra condition can never disagree with the
 *    TypeScript one about a real row. If it ever could, that throws too.
 */
function assertImportable(minyan: ParsedMinyan, context: string): asserts minyan is ParsedMinyan & {
  dayType: DayType;
} {
  if (minyan.dayType == null) {
    throw new Error(
      `Import bug: ${context} produced a minyan with no dayType (index ${minyan.index}). ` +
        'dayType comes from the column name and is always known — fix the caller, ' +
        'never the constraint.',
    );
  }
  if (minyan.service == null && minyan.needsReview.length === 0) {
    throw new Error(
      `Import bug: ${context} produced a minyan with no service and no review reason ` +
        `(index ${minyan.index}). The database would call this unpublishable while ` +
        'TypeScript called it publishable. Reconcile before importing.',
    );
  }
}

/* ------------------------------------------------------------------ */
/* Verified times — a person reading the sign outranks the GIS layer   */
/* ------------------------------------------------------------------ */

/**
 * Turn a hand-verified record into the same shape the parser produces, so
 * everything downstream — the CHECK constraint, `is_publishable`, the timeline
 * — treats it identically. The only difference is provenance, and provenance
 * lives in `last_verified_at` / `verified_by`, not in a different code path.
 *
 * `rawSegment` and `rawField` carry the human source rather than a Hebrew
 * string, because that is literally where the value came from and those columns
 * exist so any row can be traced back to what it was read from.
 */
function verifiedToParsed(verified: VerifiedSynagogue, nameHe: string): ParsedMinyan[] {
  return verified.minyanim.map((entry, index) => {
    // The tzeit ambiguity is a property of the anchor, not of who wrote it
    // down: `צאת הכוכבים` on a sign still does not say WHICH nightfall. A human
    // reading the sign does not resolve that, so the same guard applies here.
    const needsReview =
      entry.time.kind === 'relative' && entry.time.anchor === 'tzeit'
        ? [
            {
              code: 'ambiguous_tzeit' as const,
              detail:
                `${nameHe}: verified as tzeit-anchored, but tzeit names two different ` +
                'times. Ask which nightfall before publishing.',
            },
          ]
        : [];

    return {
      service: entry.service,
      time: entry.time,
      season: null,
      dayType: entry.dayType,
      rawSegment: entry.note ?? `verified: ${verified.verifiedBy}`,
      rawField: `${verified.verifiedBy} (${verified.verifiedAt})`,
      index,
      needsReview,
    } satisfies ParsedMinyan;
  });
}

/* ------------------------------------------------------------------ */
/* Writing                                                            */
/* ------------------------------------------------------------------ */

interface Summary {
  synagogues: number;
  /** How many had their times read off the sign rather than from the GIS layer. */
  verified: number;
  minyanim: number;
  publishable: number;
  needsReview: number;
  byKind: Record<string, number>;
  shiurim: number;
  shiurTimes: number;
  issues: number;
  issuesByCode: Record<string, number>;
  statuses: number;
  unmappedNusach: Array<{ name: string; raw: string }>;
}

async function upsertSynagogue(
  client: PoolClient,
  seed: SeedSynagogue,
  status: string,
  summary: Summary,
  verified: VerifiedSynagogue | null,
): Promise<number> {
  const existing = await client.query<{ id: number; slug: string }>(
    'SELECT id, slug FROM synagogues WHERE gis_source_id = $1',
    [seed.source_id],
  );

  // A slug, once published, is permanent: never recompute one that exists.
  const slug = existing.rows[0]?.slug ?? (await pickSlug(client, seed));

  const nusach = seed.nusach_raw ? (NUSACH[seed.nusach_raw] ?? null) : null;
  if (seed.nusach_raw && nusach === null) {
    summary.unmappedNusach.push({ name: seed.name_he, raw: seed.nusach_raw });
  }

  // Movement comes from the seed's own column if it ever gains one, and
  // otherwise from the hand-curated table. Never from nusach — the source tags
  // both Ramat Aviv Chabad houses `אשכנז`, so nusach cannot reveal it.
  const movement =
    (seed.movement && MOVEMENT.has(seed.movement) ? seed.movement : null) ??
    curatedMovement(seed.name_he);

  // Transliterated, not translated. See src/lib/curation.ts — an English name
  // here is the Hebrew one in Latin letters, which is what lets a visitor match
  // a sign they cannot read. Null for anything not yet curated, because a
  // machine transliteration of unpointed Hebrew reads as nonsense and a
  // translation would be a name the congregation does not use.
  const nameEn = curatedNameEn(seed.name_he);

  // "Never claim a listing is verified without a source and a date" — the
  // schema enforces it, and we refuse to send a half-pair at all.
  // "Never claim a listing is verified without a source and a date." A verified
  // record supplies both together or it does not exist, so this pair can only
  // come from one place at a time.
  const lastVerifiedAt = verified ? verified.verifiedAt : seed.last_verified_at;
  const verifiedBy = verified ? verified.verifiedBy : seed.verified_by;
  if ((lastVerifiedAt === null) !== (verifiedBy === null)) {
    throw new Error(`${seed.name_he}: last_verified_at and verified_by must be set together`);
  }

  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO synagogues (
       gis_source_id, slug, name_he, name_en, address_he, address_en,
       location, nusach, movement, style, status, last_verified_at, verified_by
     ) VALUES (
       $1, $2, $3, $12, $4, NULL,
       ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
       $7::nusach, $8::movement, NULL, $9::synagogue_status, $10::timestamptz, $11
     )
     ON CONFLICT (gis_source_id) DO UPDATE SET
       name_he          = EXCLUDED.name_he,
       name_en          = EXCLUDED.name_en,
       address_he       = EXCLUDED.address_he,
       location         = EXCLUDED.location,
       nusach           = EXCLUDED.nusach,
       movement         = EXCLUDED.movement,
       status           = EXCLUDED.status,
       last_verified_at = EXCLUDED.last_verified_at,
       verified_by      = EXCLUDED.verified_by,
       updated_at       = now()
     RETURNING id`,
    [
      seed.source_id,
      slug,
      seed.name_he,
      seed.address_he,
      seed.lng, // ST_MakePoint is (x, y) = (lng, lat). Getting this backwards
      seed.lat, // puts every shul in the Indian Ocean and no test catches it.
      nusach,
      movement,
      status,
      lastVerifiedAt,
      verifiedBy,
      nameEn,
    ],
  );

  const id = rows[0]?.id;
  if (id == null) throw new Error(`${seed.name_he}: upsert returned no id`);
  return id;
}

async function pickSlug(client: PoolClient, seed: SeedSynagogue): Promise<string> {
  const candidates = slugCandidates({
    nameHe: seed.name_he,
    streetHe: seed.street_he,
    gisSourceId: seed.source_id,
  });
  for (const candidate of candidates) {
    const taken = await client.query('SELECT 1 FROM synagogues WHERE slug = $1', [candidate]);
    if (taken.rowCount === 0) return candidate;
  }
  throw new Error(
    `No free slug for ${seed.name_he}: tried ${candidates.join(', ')}. ` +
      'Add a curated slug in src/lib/slug.ts.',
  );
}

async function writeMinyanim(
  client: PoolClient,
  synagogueId: number,
  minyanim: ParsedMinyan[],
): Promise<void> {
  const keptIds: number[] = [];

  for (const minyan of minyanim) {
    const time = minyan.time;
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO minyanim (
         synagogue_id, service, day_type, season, kind,
         fixed_time, anchor, offset_minutes, sign_basis, raw_text,
         raw_segment, raw_field, source_index, clock_normalisation, needs_review
       ) VALUES (
         $1, $2::service, $3::day_type, $4::season, $5::minyan_time_kind,
         $6::time, $7::zman, $8, $9::sign_basis, $10,
         $11, $12, $13, $14::jsonb, $15::jsonb
       )
       ON CONFLICT (synagogue_id, day_type, source_index) DO UPDATE SET
         service             = EXCLUDED.service,
         season              = EXCLUDED.season,
         kind                = EXCLUDED.kind,
         fixed_time          = EXCLUDED.fixed_time,
         anchor              = EXCLUDED.anchor,
         offset_minutes      = EXCLUDED.offset_minutes,
         sign_basis          = EXCLUDED.sign_basis,
         raw_text            = EXCLUDED.raw_text,
         raw_segment         = EXCLUDED.raw_segment,
         raw_field           = EXCLUDED.raw_field,
         clock_normalisation = EXCLUDED.clock_normalisation,
         needs_review        = EXCLUDED.needs_review,
         updated_at          = now()
       RETURNING id`,
      [
        synagogueId,
        minyan.service,
        minyan.dayType,
        minyan.season,
        time.kind,
        // Exactly the columns belonging to `kind` are populated. The
        // minyan_time_shape CHECK will reject anything else, and if it fires
        // the importer is wrong — never the constraint.
        time.kind === 'fixed' ? time.time : null,
        time.kind === 'relative' ? time.anchor : null,
        time.kind === 'relative' ? time.offsetMinutes : null,
        time.kind === 'relative' ? (minyan.signBasis ?? null) : null,
        time.kind === 'unknown' ? time.rawText : null,
        minyan.rawSegment,
        minyan.rawField,
        minyan.index,
        minyan.clockNormalisation ? JSON.stringify(minyan.clockNormalisation) : null,
        JSON.stringify(minyan.needsReview),
      ],
    );
    const id = rows[0]?.id;
    if (id == null) throw new Error('minyan upsert returned no id');
    keptIds.push(id);
  }

  // A time removed from the source must disappear from the site, not linger.
  await client.query('DELETE FROM minyanim WHERE synagogue_id = $1 AND NOT (id = ANY($2::bigint[]))', [
    synagogueId,
    keptIds,
  ]);
}

async function writeShiurim(
  client: PoolClient,
  synagogueId: number,
  found: Array<{ sourceField: string; rawField: string; shiur: ShiurFinding; index: number }>,
): Promise<void> {
  const keptIds: number[] = [];

  for (const { sourceField, rawField, shiur, index } of found) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO shiurim (
         synagogue_id, source_field, raw_field, raw_segment, source_index, times, day_type
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL)
       ON CONFLICT (synagogue_id, source_field, source_index) DO UPDATE SET
         raw_field   = EXCLUDED.raw_field,
         raw_segment = EXCLUDED.raw_segment,
         times       = EXCLUDED.times,
         updated_at  = now()
       RETURNING id`,
      [synagogueId, sourceField, rawField, shiur.rawSegment, index, JSON.stringify(shiur.times)],
    );
    const id = rows[0]?.id;
    if (id == null) throw new Error('shiur upsert returned no id');
    keptIds.push(id);
  }

  await client.query('DELETE FROM shiurim WHERE synagogue_id = $1 AND NOT (id = ANY($2::bigint[]))', [
    synagogueId,
    keptIds,
  ]);
}

async function writeIssues(
  client: PoolClient,
  synagogueId: number,
  found: Array<{ sourceField: string; issue: ParseIssue }>,
): Promise<void> {
  // Replaced wholesale: an issue that the parser no longer raises is fixed,
  // and a stale review item is noise in the queue.
  await client.query('DELETE FROM parse_issues WHERE synagogue_id = $1', [synagogueId]);

  for (const { sourceField, issue } of found) {
    await client.query(
      `INSERT INTO parse_issues (synagogue_id, source_field, code, fragment, message, raw_field)
       VALUES ($1, $2, $3::parse_issue_code, $4, $5, $6)`,
      [synagogueId, sourceField, issue.code, issue.fragment, issue.message, issue.rawField],
    );
  }
}

/* ------------------------------------------------------------------ */
/* The run                                                             */
/* ------------------------------------------------------------------ */

/** Time columns, each with the day_type its NAME implies. Never inferred. */
const TIME_FIELDS: Array<{ field: 'weekday_times_raw' | 'shabbat_times_raw'; dayType: DayType }> = [
  { field: 'weekday_times_raw', dayType: 'weekday' },
  { field: 'shabbat_times_raw', dayType: 'shabbat' },
];

async function main(): Promise<void> {
  const seeds = readSeed().sort((a, b) => a.source_id - b.source_id);

  const summary: Summary = {
    synagogues: 0,
    verified: 0,
    minyanim: 0,
    publishable: 0,
    needsReview: 0,
    byKind: { fixed: 0, relative: 0, unknown: 0 },
    shiurim: 0,
    shiurTimes: 0,
    issues: 0,
    issuesByCode: {},
    statuses: 0,
    unmappedNusach: [],
  };

  await withTransaction(async (client) => {
    for (const seed of seeds) {
      const results: Array<{ sourceField: string; result: ParseResult }> = [];

      for (const { field, dayType } of TIME_FIELDS) {
        const raw = seed[field];
        if (raw === null) continue;
        results.push({ sourceField: field, result: parseMinyanTimes(raw, { dayType }) });
      }

      // The shiur column. No dayType is passed because the column name states
      // no day — and a shiur is not a minyan, so it never needs one.
      if (seed.daf_yomi_raw !== null) {
        results.push({ sourceField: 'daf_yomi_raw', result: parseMinyanTimes(seed.daf_yomi_raw) });
      }

      const minyanim: ParsedMinyan[] = [];
      const shiurim: Array<{
        sourceField: string;
        rawField: string;
        shiur: ShiurFinding;
        index: number;
      }> = [];
      const issues: Array<{ sourceField: string; issue: ParseIssue }> = [];
      let status = seedStatus(seed);

      // A person stood in front of the sign. Everything the municipality said
      // about this synagogue's times is superseded — wholesale, not merged, so
      // no record is ever half from one source and half from the other.
      const verified = verifiedFor(seed.name_he);

      for (const { sourceField, result } of results) {
        if (sourceField === 'daf_yomi_raw' && result.minyanim.length > 0) {
          throw new Error(
            `Import bug: ${seed.name_he} — daf_yomi_raw produced ${result.minyanim.length} ` +
              'minyan(im), but that column carries no day. Route it to a day-typed ' +
              'column or extend this importer; do not insert a dayless minyan.',
          );
        }
        for (const minyan of result.minyanim) {
          assertImportable(minyan, `${seed.name_he} / ${sourceField}`);
          minyanim.push(minyan);
        }
        result.shiurim.forEach((shiur, index) => {
          shiurim.push({ sourceField, rawField: result.raw, shiur, index });
        });
        for (const issue of result.issues) issues.push({ sourceField, issue });
        // A status finding is not a time: `פתוח בחגים בלבד` is the synagogue's
        // status column talking, and it outranks the seed's default.
        for (const finding of result.statuses) {
          status = finding.status;
          summary.statuses += 1;
        }
      }

      // Wholesale replacement, and the parsed rows are simply not written.
      // They are not merged and not kept alongside: a record that is half sign
      // and half municipality cannot be reasoned about, and the sign is the
      // better evidence for every line it covers.
      const finalMinyanim = verified ? verifiedToParsed(verified, seed.name_he) : minyanim;
      if (verified) summary.verified += 1;

      const synagogueId = await upsertSynagogue(client, seed, status, summary, verified);
      await writeMinyanim(client, synagogueId, finalMinyanim);
      await writeShiurim(client, synagogueId, shiurim);
      await writeIssues(client, synagogueId, issues);

      summary.synagogues += 1;
      summary.minyanim += finalMinyanim.length;
      for (const minyan of finalMinyanim) {
        summary.byKind[minyan.time.kind] = (summary.byKind[minyan.time.kind] ?? 0) + 1;
        if (minyan.needsReview.length === 0 && minyan.service !== null) summary.publishable += 1;
        else summary.needsReview += 1;
      }
      summary.shiurim += shiurim.length;
      summary.shiurTimes += shiurim.reduce((n, s) => n + s.shiur.times.length, 0);
      summary.issues += issues.length;
      for (const { issue } of issues) {
        summary.issuesByCode[issue.code] = (summary.issuesByCode[issue.code] ?? 0) + 1;
      }
    }
  });

  report(summary);
}

/**
 * The seed's own `status` column says `unverified`, which is a statement about
 * verification, not the synagogue_status enum — and verification is already
 * carried honestly by last_verified_at / verified_by being NULL. Anything that
 * is a real status is passed through; anything else falls back to the schema
 * default and is not treated as a claim.
 */
function seedStatus(seed: SeedSynagogue): string {
  if (seed.status && SYNAGOGUE_STATUS.has(seed.status)) return seed.status;
  return 'active';
}

function report(summary: Summary): void {
  const lines = [
    '',
    'Imported into tlv_minyanim',
    '--------------------------',
    `synagogues        ${summary.synagogues}`,
    `minyanim          ${summary.minyanim}  (fixed ${summary.byKind.fixed}, relative ${summary.byKind.relative}, unknown ${summary.byKind.unknown})`,
    `  publishable     ${summary.publishable}`,
    `  needs review    ${summary.needsReview}`,
    `shiurim           ${summary.shiurim}  (carrying ${summary.shiurTimes} time(s) — never minyanim)`,
    `status findings   ${summary.statuses}`,
    `parse issues      ${summary.issues}${
      summary.issues === 0
        ? ''
        : ' — ' +
          Object.entries(summary.issuesByCode)
            .map(([code, n]) => `${code}: ${n}`)
            .join(', ')
    }`,
  ];

  if (summary.unmappedNusach.length > 0) {
    lines.push('', 'Nusach left NULL rather than guessed:');
    for (const { name, raw } of summary.unmappedNusach) {
      lines.push(`  ${name} — source says "${raw}", which the enum does not resolve`);
    }
  }
  lines.push('');
  console.log(lines.join('\n'));
}

try {
  await main();
} finally {
  await closePool();
}

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
import {
  curatedMovement,
  curatedNameEn,
  curatedNameHe,
  curatedAddressEn,
  curatedNusachim,
  sharesBuildingWith,
} from '../src/lib/curation.ts';
import { verifiedFor, type VerifiedSynagogue } from '../src/lib/verified-times.ts';
import { ADDED, isLocatable, type AddedSynagogue } from '../src/lib/added-synagogues.ts';
import type { MinyanStyle, Nusach } from '../src/lib/taxonomy.ts';
import { slugCandidates } from '../src/lib/slug.ts';
import { parseMinyanTimes } from '../src/minyan-times/index.ts';
import type {
  DayType,
  MinyanLocation,
  ParsedMinyan,
  Weekday,
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
 *  - `תימני` alone maps to `teimani`, the unqualified value. It used to map to
 *    NULL on the grounds that the enum distinguishes baladi from shami and the
 *    source does not — but NULL says "we do not know how they daven", which is
 *    less true than "Yemenite, sub-rite unstated". Writing down what the sign
 *    says is reading it; choosing baladi or shami would be the guess, and that
 *    is still forbidden.
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
  תימני: 'teimani',
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

/**
 * A synagogue the municipal export does not contain.
 *
 * Keyed on `slug` rather than `gis_source_id`, which is null for these — the
 * slug is authored in `added-synagogues.ts` precisely so there is a stable
 * natural key to upsert against.
 */
async function upsertAdded(
  client: PoolClient,
  added: AddedSynagogue & { lat: number; lng: number },
): Promise<number> {
  const verified = verifiedFor(added.nameHe);
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO synagogues (
       gis_source_id, slug, name_he, name_en, address_he, address_en,
       location, nusachim, movement, style, status, last_verified_at, verified_by
     ) VALUES (
       NULL, $1, $2, $3, $4, $12,
       ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
       $7::nusach[], $8::movement, NULL, $9::synagogue_status, $10::timestamptz, $11
     )
     ON CONFLICT (slug) DO UPDATE SET
       name_he          = EXCLUDED.name_he,
       name_en          = EXCLUDED.name_en,
       address_he       = EXCLUDED.address_he,
       address_en       = EXCLUDED.address_en,
       location         = EXCLUDED.location,
       nusachim         = EXCLUDED.nusachim,
       movement         = EXCLUDED.movement,
       status           = EXCLUDED.status,
       last_verified_at = EXCLUDED.last_verified_at,
       verified_by      = EXCLUDED.verified_by,
       updated_at       = now()
     RETURNING id`,
    [
      added.slug,
      added.nameHe,
      added.nameEn,
      added.addressHe,
      added.lng, // (x, y) = (lng, lat). Backwards puts the shul in the sea.
      added.lat,
      added.nusachim,
      added.movement ?? null,
      added.status,
      verified ? verified.verifiedAt : null,
      verified ? verified.verifiedBy : null,
      curatedAddressEn(added.addressHe),
    ],
  );
  return rows[0]!.id;
}

/**
 * Replace a synagogue's stated absences.
 *
 * Wholesale, like its times: a record half from the current sheet and half
 * from an older one cannot be reasoned about. Deleting first also means a
 * claim that is withdrawn actually disappears, rather than lingering because
 * nothing upserted over it.
 *
 * Only ever called with a verified record. The parser has no way to state an
 * absence and must never reach this table — the GIS layer can fail to mention
 * Shabbat, which is the unknown, but cannot say a shul is closed.
 */
async function replaceAbsences(
  client: PoolClient,
  synagogueId: number,
  verified: VerifiedSynagogue | null,
): Promise<void> {
  await client.query('DELETE FROM synagogue_absences WHERE synagogue_id = $1', [synagogueId]);
  for (const absence of verified?.noMinyanim ?? []) {
    await client.query(
      `INSERT INTO synagogue_absences (synagogue_id, day_type, service)
       VALUES ($1, $2::day_type, $3::service)`,
      [synagogueId, absence.dayType, absence.service ?? null],
    );
  }
}

/* ------------------------------------------------------------------ */
/* Verified times — a person reading the sign outranks the GIS layer   */
/* ------------------------------------------------------------------ */

/**
 * What actually gets written: the parser's shape, plus a nusach.
 *
 * `ParsedMinyan` deliberately has no nusach. The parser reads a GIS time
 * string, and a time string cannot say which of a building's minyanim it
 * belongs to — only a person standing in front of the sign can. Widening the
 * parser's own type would invite someone to try.
 */
type ImportMinyan = ParsedMinyan & {
  nusach?: Nusach | null;
  validFrom?: string | null;
  validUntil?: string | null;
  /** Empty = every day of the day type. The parser never sets this. */
  daysOfWeek?: readonly Weekday[];
  /** Where in the building. NULL = nothing stated, not unknown. */
  location?: MinyanLocation | null;
  /** What the board calls it. NEVER an anchor — see MinyanStyle. */
  style?: MinyanStyle | null;
};

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
function verifiedToParsed(verified: VerifiedSynagogue, nameHe: string): ImportMinyan[] {
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
      // Absent unless this minyan is its own group. Null is "the house
      // minyan", not "unknown" — see migration 0003.
      nusach: entry.nusach ?? null,
      // How long the source vouched for this time. Null on both means no
      // stated end, which is a rule or a clock face that holds year round.
      validFrom: entry.validFrom ?? null,
      validUntil: entry.validUntil ?? null,
      // Which weekdays this one runs on, where the board says. Empty means all
      // of them — the normal case, and not an unknown.
      daysOfWeek: entry.daysOfWeek ?? [],
      // Null unless the board named a room. For a one-room shul that is the
      // truth, not a gap — see the enum's comment.
      location: entry.location ?? null,
      // The board's label for this minyan. It says what KIND of minyan it is
      // and nothing about how the time is computed — the time above is
      // untouched by it.
      style: entry.style ?? null,
    } satisfies ImportMinyan;
  });
}

/* ------------------------------------------------------------------ */
/* Writing                                                            */
/* ------------------------------------------------------------------ */

interface Summary {
  synagogues: number;
  /** Hand-added, i.e. not present in the municipal export. */
  added: number;
  /** Hand-added but missing coordinates, so not inserted. Reported by name. */
  skippedNoLocation: string[];
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

  const sourceNusach = seed.nusach_raw ? (NUSACH[seed.nusach_raw] ?? null) : null;
  if (seed.nusach_raw && sourceNusach === null) {
    summary.unmappedNusach.push({ name: seed.name_he, raw: seed.nusach_raw });
  }
  // A synagogue serves a SET of rites. The source gives one, which is why a
  // shul running several came through as `כללי`; where we know better, the
  // curated list wins. Empty means we cannot name one.
  const nusachim = curatedNusachim(seed.name_he, sourceNusach as never);

  // The municipality's name, corrected where the synagogue calls itself
  // something else. Keyed on the source spelling, so a re-import still finds
  // this row.
  const nameHe = curatedNameHe(seed.name_he);

  // The GIS layer separates street from number with two spaces — `נח  20` —
  // which is an artefact of a fixed-width export, not part of the address.
  // Folded here rather than at display time so the stored value is the one the
  // slug, the curation keys and schema.org all agree on.
  const addressHe = seed.address_he ? seed.address_he.replace(/\s+/g, ' ').trim() : null;

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
       location, nusachim, movement, style, status, last_verified_at, verified_by
     ) VALUES (
       $1, $2, $3, $12, $4, $13,
       ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
       $7::nusach[], $8::movement, NULL, $9::synagogue_status, $10::timestamptz, $11
     )
     ON CONFLICT (gis_source_id) DO UPDATE SET
       name_he          = EXCLUDED.name_he,
       name_en          = EXCLUDED.name_en,
       address_he       = EXCLUDED.address_he,
       address_en       = EXCLUDED.address_en,
       location         = EXCLUDED.location,
       nusachim         = EXCLUDED.nusachim,
       movement         = EXCLUDED.movement,
       status           = EXCLUDED.status,
       last_verified_at = EXCLUDED.last_verified_at,
       verified_by      = EXCLUDED.verified_by,
       updated_at       = now()
     RETURNING id`,
    [
      seed.source_id,
      slug,
      nameHe,
      addressHe,
      seed.lng, // ST_MakePoint is (x, y) = (lng, lat). Getting this backwards
      seed.lat, // puts every shul in the Indian Ocean and no test catches it.
      nusachim,
      movement,
      status,
      lastVerifiedAt,
      verifiedBy,
      nameEn,
      curatedAddressEn(addressHe),
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
  minyanim: ImportMinyan[],
): Promise<void> {
  const keptIds: number[] = [];

  for (const minyan of minyanim) {
    const time = minyan.time;
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO minyanim (
         synagogue_id, service, day_type, season, kind,
         fixed_time, anchor, offset_minutes, sign_basis, raw_text,
         raw_segment, raw_field, source_index, clock_normalisation, needs_review,
         nusach, valid_from, valid_until, days_of_week, location, style
       ) VALUES (
         $1, $2::service, $3::day_type, $4::season, $5::minyan_time_kind,
         $6::time, $7::zman, $8, $9::sign_basis, $10,
         $11, $12, $13, $14::jsonb, $15::jsonb,
         $16::nusach, $17::date, $18::date, $19::smallint[], $20::minyan_location,
         $21::minyan_style
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
         nusach              = EXCLUDED.nusach,
         valid_from          = EXCLUDED.valid_from,
         valid_until         = EXCLUDED.valid_until,
         days_of_week        = EXCLUDED.days_of_week,
         location            = EXCLUDED.location,
         style               = EXCLUDED.style,
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
        minyan.nusach ?? null,
        minyan.validFrom ?? null,
        minyan.validUntil ?? null,
        // Empty = every day of the day type. The parser never produces a day
        // restriction — the GIS layer has no way to state one — so this is only
        // ever non-empty for a verified record.
        minyan.daysOfWeek ?? [],
        minyan.location ?? null,
        minyan.style ?? null,
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

/**
 * A seed row moved to the building it actually stands in.
 *
 * The GIS layer puts `המרכזי רמת אביב ג'` at אבא אחימאיר 31, which is 329 m
 * from where it davens — a different building, and a four-minute walk to the
 * wrong door for someone who has never been. Where `SAME_BUILDING_AS` names
 * another shul, its coordinates and address are taken instead.
 *
 * The other shul's own row is the source, rather than a pair of numbers copied
 * into a table: if that point is ever corrected, this follows it. Throws
 * rather than falling back, because a silent miss here is the exact failure
 * being fixed — the shul would quietly keep the wrong location.
 */
function relocated(seed: SeedSynagogue, byName: Map<string, SeedSynagogue>): SeedSynagogue {
  const sharesWith = sharesBuildingWith(seed.name_he);
  if (!sharesWith) return seed;

  const host = byName.get(sharesWith.replace(/\s+/g, ' ').trim());
  if (!host) {
    throw new Error(
      `${seed.name_he}: SAME_BUILDING_AS names "${sharesWith}", which is not in the seed. ` +
        'Fix the key in src/lib/curation.ts — it must be the name as the source writes it.',
    );
  }
  return { ...seed, lat: host.lat, lng: host.lng, address_he: host.address_he };
}

async function main(): Promise<void> {
  const seeds = readSeed().sort((a, b) => a.source_id - b.source_id);
  const seedsByName = new Map(seeds.map((s) => [s.name_he.replace(/\s+/g, ' ').trim(), s]));

  const summary: Summary = {
    synagogues: 0,
    added: 0,
    skippedNoLocation: [],
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
    for (const raw of seeds) {
      const seed = relocated(raw, seedsByName);
      const results: Array<{ sourceField: string; result: ParseResult }> = [];

      for (const { field, dayType } of TIME_FIELDS) {
        const rawTimes = seed[field];
        if (rawTimes === null) continue;
        results.push({ sourceField: field, result: parseMinyanTimes(rawTimes, { dayType }) });
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
      await replaceAbsences(client, synagogueId, verified);
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

    // Synagogues the municipality does not list. Same transaction, so the run
    // is still all-or-nothing.
    for (const added of ADDED) {
      if (!isLocatable(added)) {
        // Skipped rather than thrown: the other sixteen are fine and breaking
        // the whole import over one missing coordinate pair would be worse.
        // Reported by name so it is not a silent omission.
        summary.skippedNoLocation.push(added.nameHe);
        continue;
      }
      const id = await upsertAdded(client, added);
      await replaceAbsences(client, id, verifiedFor(added.nameHe));
      const verified = verifiedFor(added.nameHe);
      const rows = verified ? verifiedToParsed(verified, added.nameHe) : [];
      await writeMinyanim(client, id, rows);
      summary.added += 1;
      summary.synagogues += 1;
      summary.minyanim += rows.length;
      for (const minyan of rows) {
        summary.byKind[minyan.time.kind] = (summary.byKind[minyan.time.kind] ?? 0) + 1;
        if (minyan.needsReview.length === 0 && minyan.service !== null) summary.publishable += 1;
        else summary.needsReview += 1;
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

  if (summary.skippedNoLocation.length > 0) {
    console.log('\nHand-added, NOT imported — no coordinates:');
    for (const name of summary.skippedNoLocation) {
      console.log(`  ${name} — a walking link needs an exact point; none was guessed`);
    }
  }

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

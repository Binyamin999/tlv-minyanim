/**
 * Typed reads. Every query lives here so that no page ever writes SQL, and so
 * that the row -> structured-value conversion happens in exactly one place.
 *
 * The conversion is the important part. `minyanim` stores the three-way time
 * across five columns because the database has to be able to constrain it;
 * everything above this file sees a `MinyanTime` and nothing else. A page can
 * therefore not accidentally read `fixed_time` on a row whose kind is
 * `unknown` — that column is not in the shape it is handed.
 */
import { query } from '@/db/client';
import type {
  DayType,
  MinyanLocation,
  Weekday,
  MinyanTime,
  ReviewReason,
  Season,
  Service,
  SignBasis,
  Zman,
} from '@/minyan-times';
import type { MinyanStyle, Movement, Nusach, SynagogueStatus } from '@/lib/taxonomy';

export type { Movement, Nusach, SynagogueStatus } from '@/lib/taxonomy';

export interface Synagogue {
  id: number;
  slug: string;
  nameHe: string;
  /** NULL until translated. Never invented — the UI falls back to Hebrew. */
  nameEn: string | null;
  addressHe: string | null;
  addressEn: string | null;
  lat: number;
  lng: number;
  /** Every rite this synagogue serves. Empty = we cannot name one. */
  nusachim: readonly Nusach[];
  movement: Movement | null;
  status: SynagogueStatus;
  /** NULL = never verified, and the UI says exactly that. */
  lastVerifiedAt: Date | null;
  verifiedBy: string | null;
  /**
   * Days this synagogue states it holds NO services on.
   *
   * A day in here is a positive claim of absence and the page says so. A day
   * merely missing from this array is the ordinary unknown — the two are not
   * the same and the UI must not render them the same way.
   */
  noMinyanimOn: readonly DayType[];
}

export interface Minyan {
  id: number;
  service: Service | null;
  dayType: DayType | null;
  season: Season | null;
  time: MinyanTime;
  signBasis: SignBasis | null;
  /** Non-empty ⇒ never presented as confirmed. */
  needsReview: ReviewReason[];
  /** Generated in the database: no review pending, and service + day known. */
  isPublishable: boolean;
  /**
   * The weekdays this minyan runs on. Empty = every day of its dayType, which
   * is the normal case and does NOT mean unknown.
   */
  daysOfWeek: readonly Weekday[];
  /** Where in the building. NULL = nothing stated, which is not unknown. */
  location: MinyanLocation | null;
  /** The board's label — netz, hodu, plag. NEVER read this as an anchor. */
  style: MinyanStyle | null;
  /** Verbatim slice of the source field. Provenance, not display. */
  rawSegment: string;
  /**
   * This minyan's own nusach, when it is a distinct group within the building.
   * NULL means the house minyan — it follows the synagogue's nusach — and does
   * NOT mean unknown.
   */
  nusach: Nusach | null;
  /**
   * How long the source vouched for this time, inclusive. Null on both means
   * no stated end — a rule, or a clock face that holds year round.
   *
   * A weekly printed board sets them, and outside the window the time is not
   * merely stale but WRONG: an 18:45 Mincha is shkia + 65 in December.
   */
  validFrom: string | null;
  validUntil: string | null;
}

export interface SynagogueWithMinyanim extends Synagogue {
  minyanim: Minyan[];
}

/* ------------------------------------------------------------------ */
/* Row shapes                                                          */
/* ------------------------------------------------------------------ */

interface SynagogueRow {
  id: number;
  slug: string;
  name_he: string;
  name_en: string | null;
  address_he: string | null;
  address_en: string | null;
  lat: number;
  lng: number;
  nusachim: Nusach[];
  movement: Movement | null;
  status: SynagogueStatus;
  last_verified_at: Date | null;
  verified_by: string | null;
  no_minyanim_on: DayType[];
}

interface MinyanRow {
  id: number;
  service: Service | null;
  day_type: DayType | null;
  season: Season | null;
  kind: MinyanTime['kind'];
  /** `time` arrives as HH:MM:SS. A clock face in Asia/Jerusalem, not a string. */
  fixed_time: string | null;
  anchor: Zman | null;
  offset_minutes: number | null;
  sign_basis: SignBasis | null;
  raw_text: string | null;
  raw_segment: string;
  needs_review: ReviewReason[];
  is_publishable: boolean;
  /** This minyan's own nusach, when it is a distinct group. NULL = house minyan. */
  nusach: Nusach | null;
  valid_from: Date | string | null;
  valid_until: Date | string | null;
  days_of_week: number[];
  location: MinyanLocation | null;
  style: MinyanStyle | null;
}

const SYNAGOGUE_COLUMNS = `
  id, slug, name_he, name_en, address_he, address_en,
  ST_Y(location::geometry) AS lat,
  ST_X(location::geometry) AS lng,
  -- The ::text[] cast is load-bearing. node-postgres ships parsers for the
  -- built-in array types but not for an array of a CUSTOM ENUM, so a bare
  -- nusach[] arrives as the raw literal string '{ashkenaz,edot_hamizrach}'
  -- while TypeScript believes it is an array. .map then throws at render time
  -- on a clean typecheck. text[] hits a parser that exists.
  nusachim::text[] AS nusachim, movement, status, last_verified_at, verified_by,
  -- ::text[] for the same reason as nusachim above: node-postgres has no
  -- parser for an array of a custom enum, so a bare day_type[] arrives as the
  -- literal string '{shabbat}' and .includes() then matches single letters.
  no_minyanim_on::text[] AS no_minyanim_on`;

function toSynagogue(row: SynagogueRow): Synagogue {
  return {
    id: row.id,
    slug: row.slug,
    nameHe: row.name_he,
    nameEn: row.name_en,
    addressHe: row.address_he,
    addressEn: row.address_en,
    lat: Number(row.lat),
    lng: Number(row.lng),
    nusachim: row.nusachim ?? [],
    movement: row.movement,
    status: row.status,
    lastVerifiedAt: row.last_verified_at,
    verifiedBy: row.verified_by,
    noMinyanimOn: row.no_minyanim_on ?? [],
  };
}

/**
 * Five columns back into one value. The `default` branch is unreachable while
 * `minyan_time_kind` has three members; it exists so that adding a fourth in
 * SQL breaks here loudly instead of rendering a blank.
 */
function toMinyanTime(row: MinyanRow): MinyanTime {
  switch (row.kind) {
    case 'fixed':
      if (row.fixed_time === null) throw new Error(`minyan ${row.id}: fixed with no fixed_time`);
      // HH:MM:SS -> HH:MM. Seconds are not a thing a minyan has.
      return { kind: 'fixed', time: row.fixed_time.slice(0, 5) };
    case 'relative':
      if (row.anchor === null || row.offset_minutes === null) {
        throw new Error(`minyan ${row.id}: relative with no anchor or offset`);
      }
      return {
        kind: 'relative',
        anchor: row.anchor,
        offsetMinutes: row.offset_minutes,
      };
    case 'unknown':
      if (row.raw_text === null) throw new Error(`minyan ${row.id}: unknown with no raw_text`);
      return { kind: 'unknown', rawText: row.raw_text };
    default: {
      const unreachable: never = row.kind;
      throw new Error(`minyan ${row.id}: unknown time kind ${String(unreachable)}`);
    }
  }
}

function toMinyan(row: MinyanRow): Minyan {
  return {
    id: row.id,
    service: row.service,
    dayType: row.day_type,
    season: row.season,
    time: toMinyanTime(row),
    signBasis: row.sign_basis,
    needsReview: row.needs_review ?? [],
    isPublishable: row.is_publishable,
    rawSegment: row.raw_segment,
    nusach: row.nusach,
    validFrom: asIsoDate(row.valid_from),
    validUntil: asIsoDate(row.valid_until),
    // `?? []` for the same reason asIsoDate tolerates undefined: a SELECT that
    // forgets the column would otherwise hand the timeline an undefined and
    // 500 at `.includes`. Empty is also the honest value — every day.
    daysOfWeek: (row.days_of_week ?? []) as Weekday[],
    location: row.location ?? null,
    style: row.style ?? null,
  };
}

/** `date` columns arrive as Date or string depending on the driver's mood. */
function asIsoDate(value: Date | string | null | undefined): string | null {
  // `undefined` means the caller's SELECT did not fetch the column — a
  // different failure from "the column is NULL", and one TypeScript cannot see
  // because the row type promises a field the query never provided. It cost a
  // 500 on the homepage while the shul page, whose query did fetch it, was
  // fine. Tolerate it here AND fetch it there.
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }
  return value.slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/**
 * The index. Ordered by Hebrew name because Hebrew is the primary locale and a
 * single stable order keeps the two locales' URLs pointing at the same list.
 */
export async function listSynagogues(): Promise<Synagogue[]> {
  const rows = await query<SynagogueRow>(
    `SELECT ${SYNAGOGUE_COLUMNS}
       FROM synagogues
      WHERE status <> 'closed'
      -- COLLATE "C" is deliberate, and not an optimisation. The host database
      -- here defaults to en_US.UTF-8, which sorts Hebrew into nonsense
      -- (המרכזי before אוהל). Hebrew codepoints are in alphabetical order, so
      -- byte order IS the correct order for this column — and "C" is the one
      -- collation guaranteed to exist on every Postgres, unlike he-IL-x-icu.
      ORDER BY name_he COLLATE "C"`,
  );
  return rows.map(toSynagogue);
}

/** Every slug, for generateStaticParams and the sitemap. */
export async function listSynagogueSlugs(): Promise<string[]> {
  const rows = await query<{ slug: string }>(
    `SELECT slug FROM synagogues WHERE status <> 'closed' ORDER BY slug`,
  );
  return rows.map((row) => row.slug);
}

export async function getSynagogueBySlug(slug: string): Promise<SynagogueWithMinyanim | null> {
  const rows = await query<SynagogueRow>(
    `SELECT ${SYNAGOGUE_COLUMNS} FROM synagogues WHERE slug = $1`,
    [slug],
  );
  const row = rows[0];
  if (!row) return null;

  const minyanRows = await query<MinyanRow>(
    `SELECT id, service, day_type, season, kind, fixed_time, anchor, offset_minutes,
            sign_basis, raw_text, raw_segment, needs_review, is_publishable, nusach,
            valid_from, valid_until, days_of_week, location, style
       FROM minyanim
      WHERE synagogue_id = $1
      ORDER BY day_type, source_index`,
    [row.id],
  );

  return { ...toSynagogue(row), minyanim: minyanRows.map(toMinyan) };
}

/**
 * Every synagogue with its minyanim, for the timeline.
 *
 * Two queries and a join in JavaScript rather than one query with an
 * aggregate, because the timeline needs whole rows and the row count is small:
 * 484 synagogues — the whole city, not just Ramat Aviv — is on the order of
 * 2,000 minyanim, which is nothing to load and nothing to iterate.
 *
 * The zmanim cannot be computed in SQL, so filtering by time has to happen in
 * TypeScript regardless; pushing a half-filter into Postgres would only split
 * the rule across two languages. `is_publishable` IS pushed down, because that
 * gate is defined in the database and belongs there.
 *
 * TODO(phase 4): when geo search lands, add an ST_DWithin predicate here so a
 * radius query never loads the city.
 */
export async function listSynagoguesWithMinyanim(): Promise<SynagogueWithMinyanim[]> {
  const rows = await query<SynagogueRow>(
    `SELECT ${SYNAGOGUE_COLUMNS}
       FROM synagogues
      WHERE status IN ('active', 'seasonal')
      ORDER BY name_he COLLATE "C"`,
  );
  if (rows.length === 0) return [];

  const minyanRows = await query<MinyanRow & { synagogue_id: number }>(
    `SELECT synagogue_id, id, service, day_type, season, kind, fixed_time, anchor,
            offset_minutes, sign_basis, raw_text, raw_segment, needs_review, is_publishable,
            nusach, valid_from, valid_until, days_of_week, location, style
       FROM minyanim
      WHERE is_publishable
      ORDER BY synagogue_id, day_type, source_index`,
  );

  const byShul = new Map<number, Minyan[]>();
  for (const minyanRow of minyanRows) {
    const list = byShul.get(minyanRow.synagogue_id);
    if (list) list.push(toMinyan(minyanRow));
    else byShul.set(minyanRow.synagogue_id, [toMinyan(minyanRow)]);
  }

  return rows.map((row) => ({
    ...toSynagogue(row),
    minyanim: byShul.get(row.id) ?? [],
  }));
}

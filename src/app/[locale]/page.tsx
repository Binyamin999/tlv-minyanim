import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { Filters } from '@/components/home/Filters';
import { HeroCard, HeroEmpty } from '@/components/home/HeroCard';
import { Masthead, type RibbonZman } from '@/components/home/Masthead';
import { ShulCard, UnknownShulCard } from '@/components/home/ShulCard';
import { PinIcon } from '@/components/icons';
import { listSynagoguesWithMinyanim } from '@/db/queries';
import { localeAlternates } from '@/i18n/alternates';
import { getDictionary } from '@/i18n/dictionaries';
import { LOCALES, isLocale } from '@/i18n/locales';
import {
  firstParam,
  homeHref,
  isNusach,
  isServiceFilter,
  type ServiceFilter,
} from '@/lib/home-filters';
import { sunsetWarmth } from '@/lib/sunset-warmth';
import { NUSACHIM, type Nusach } from '@/lib/taxonomy';
import { MODE_COOKIE, modeAt, readModePreference } from '@/lib/theme';
import {
  TEL_AVIV,
  clockFaceOf,
  nextMinyanim,
  parshaAt,
  type UnconfirmedMinyan,
  type UpcomingMinyan,
} from '@/zmanim';

/**
 * The homepage. "Where can I daven in the next 40 minutes?" — asked and
 * answered above the fold, server-rendered, in two languages.
 *
 * Everything on this page is HTML before any JavaScript runs. Every synagogue
 * page is a landing page and so is this one; SEO is the entire discovery
 * strategy, and a homepage that needs a bundle to show a time has failed its
 * main job. The single client component on the page is the light/dark
 * override, which is a preference, not content.
 */

/**
 * The clock moves and so does the answer. Nothing here may be cached — a
 * homepage frozen at build time would confidently show yesterday's next
 * minyan, which is the exact failure this product exists to prevent.
 */
export const dynamic = 'force-dynamic';

/**
 * Eight days.
 *
 * Not the 40 minutes of the product question: the card list is one card per
 * synagogue showing when *that* shul next davens, so a shul whose only Mincha
 * is tomorrow at 13:00 still has a card. Eight rather than seven so that a
 * Shabbat-only minyan is reachable from any day of the week including from
 * Saturday night. The hero, which really is "the next one", is simply the
 * first entry of that same ordering.
 */
const HORIZON_MINUTES = 8 * 24 * 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return {
    title: t.tagline,
    description: t.nextMinyanimLink,
    // Canonical is the unfiltered page: the chip views are the same content
    // sliced, and a crawler should be told which one is the page.
    alternates: localeAlternates(locale, ''),
  };
}

export default async function LocaleHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const t = getDictionary(locale);

  const now = new Date();
  const skyMode = modeAt(now);
  const modePreference = readModePreference((await cookies()).get(MODE_COOKIE)?.value);

  const synagogues = await listSynagoguesWithMinyanim();
  const timeline = nextMinyanim({
    now,
    within: HORIZON_MINUTES,
    location: TEL_AVIV,
    synagogues,
  });

  // Nusach is not part of placing a time, so the timeline does not carry it.
  const nusachById = new Map(synagogues.map((shul) => [shul.id, shul.nusach]));
  // `general` is a chip nobody wants to press. It is what the municipality
  // writes when a shul does not describe itself as any particular nusach, so
  // filtering to it answers "show me the ones we could not classify" — a fact
  // about our data rather than about how anyone davens. The value stays on the
  // record and still shows as the shul's tag; it is only removed from the
  // filter row. `all` still includes those shuls, so nothing becomes
  // unreachable — לכלל ישראל in particular, which is the one synagogue in
  // Ramat Aviv publishing real offsets.
  const availableNusachim = NUSACHIM.filter(
    (option) => option !== 'general' && synagogues.some((shul) => shul.nusach === option),
  );

  const requestedNusach = firstParam(query.nusach);
  const nusach: Nusach | null = isNusach(requestedNusach) ? requestedNusach : null;

  const requestedService = firstParam(query.service);
  // The default chip is the service of the soonest minyan anywhere. Not the
  // artboard's literal `mincha`, and not the halachic window `now` falls in
  // either: with no Arvit row in the source at all, "it is night, so Arvit"
  // would answer the product's one question with an empty page.
  const service: ServiceFilter = isServiceFilter(requestedService)
    ? requestedService
    : defaultService(timeline.upcoming);

  const matchesNusach = (id: number) => nusach === null || nusachById.get(id) === nusach;

  const upcoming = timeline.upcoming.filter(
    (row) => matchesServiceFilter(row, service) && matchesNusach(row.synagogue.id),
  );
  const unconfirmed = timeline.unconfirmed.filter(
    (row) => matchesServiceFilter(row, service) && matchesNusach(row.synagogue.id),
  );

  // One card per synagogue: its next occurrence. `upcoming` is already sorted
  // ascending by instant, so the first sighting of a shul is its next time.
  const resolved = firstPerSynagogue(upcoming);
  const hero = resolved[0] ?? null;
  const cards = resolved.slice(1);
  // A shul only appears as unknown if we have no time for it at all under the
  // current filter — otherwise the honest-unknown row would sit next to a time
  // we do know and read as doubt about that time.
  const known = new Set(resolved.map((row) => row.synagogue.id));
  const unknownCards = firstPerSynagogue(unconfirmed).filter(
    (row) => !known.has(row.synagogue.id),
  );

  const parsha = parshaAt(TEL_AVIV, now);
  const hebrewDate =
    locale === 'he' ? timeline.hebrewNow.renderGematriya : timeline.hebrewNow.renderEn;

  // The header ribbon, in the order the day happens. A phone shows only shkia
  // and the desktop board shows all four — which is the honest use of the
  // extra width: more of the day, not a bigger version of the same line.
  // Every value comes from the library via `timeline.today`; none is stored.
  const ribbonZmanim: readonly RibbonZman[] = [
    { zman: 'netz', clock: clockFaceOf(timeline.today.netz) },
    { zman: 'mincha_gedola', clock: clockFaceOf(timeline.today.mincha_gedola) },
    { zman: 'shkia', clock: clockFaceOf(timeline.today.shkia) },
    { zman: 'tzeit', clock: clockFaceOf(timeline.today.tzeit) },
  ];
  const heroWarmth = hero ? warmthFor(hero, now) : 0;

  return (
    <>
      <Masthead
        locale={locale}
        t={t}
        modePreference={modePreference}
        skyMode={skyMode}
        hebrewDate={hebrewDate}
        parsha={parsha ? (locale === 'he' ? parsha.he : parsha.en) : null}
        zmanim={ribbonZmanim}
        heroWarmth={heroWarmth}
        localeHrefs={Object.fromEntries(
          LOCALES.map((other) => [other, homeHref(other, service, nusach)]),
        ) as Record<(typeof LOCALES)[number], string>}
      >
        {/* The page's h1, and it is the question rather than the brand: this
            page exists to answer "where can I daven next", and the wordmark
            above it is navigation. */}
        <h1 className="band-hero-label">{t.nextNearYou}</h1>
        {hero ? (
          // Mincha only: the window that closes at shkia is Mincha's. A
          // Shacharit does not get warmer because the sun is going down.
          <HeroCard
            row={hero}
            nusach={nusachById.get(hero.synagogue.id) ?? null}
            warmth={heroWarmth}
            locale={locale}
            t={t}
          />
        ) : (
          <HeroEmpty t={t} />
        )}
      </Masthead>

      <main className="home">
        {/* Geo search is not built, so this states where the data is rather
            than offering to move. The artboard's "שנה מיקום" action is the
            entry point to radius search and arrives with it. */}
        <p className="place">
          <span className="place-pin" aria-hidden="true">
            <PinIcon />
          </span>
          <span>{t.neighbourhood}</span>
        </p>

        <Filters
          locale={locale}
          t={t}
          service={service}
          nusach={nusach}
          availableNusachim={availableNusachim}
        />

        <h2 className="count">
          {t.synagogueCount(cards.length + unknownCards.length + (hero ? 1 : 0))}
        </h2>

        {/* The לוח's column headers. Desktop only — a phone shows one card per
            shul and has nothing to head — and aria-hidden, because this labels
            a visual grid rather than a <table>: every row already says its own
            name, time and nusach, and a header row with no table semantics
            behind it is noise in a screen reader. */}
        {/* Nothing to head when nothing follows. `?service=arvit` has exactly
            one match and it is the hero, so the board below is empty — and a
            header row with no rows under it reads as a page that failed to
            load rather than as a page with one result. */}
        {cards.length + unknownCards.length > 0 ? (
          <div className="table-head" aria-hidden="true">
            <span>{t.columns.time}</span>
            <span>{t.columns.service}</span>
            <span>{t.columns.synagogue}</span>
            <span>{t.columns.nusach}</span>
            <span>{t.columns.verified}</span>
          </div>
        ) : null}

        <div className="cards">
          {cards.map((row) => (
            <ShulCard
              key={`${row.synagogue.id}-${row.instant.getTime()}`}
              row={row}
              nusach={nusachById.get(row.synagogue.id) ?? null}
              warmth={warmthFor(row, now)}
              now={now}
              locale={locale}
              t={t}
            />
          ))}
          {/* Last, and quiet. Never sorted in among times we know: a thing with
              no time cannot have a position among things that do. */}
          {unknownCards.map((row) => (
            <UnknownShulCard
              key={`${row.synagogue.id}-${row.service}-${row.phase}`}
              row={row}
              nusach={nusachById.get(row.synagogue.id) ?? null}
              locale={locale}
              t={t}
            />
          ))}
        </div>

        <footer className="home-foot">
          <p>{t.footerComputed}</p>
          <p>{t.footerNeverGuess}</p>
          <p className="home-foot-source">{t.zmanimSource}</p>
        </footer>
      </main>
    </>
  );
}

/** Mincha warms toward shkia; nothing else does. See src/lib/sunset-warmth.ts. */
function warmthFor(row: UpcomingMinyan, now: Date): number {
  return row.service === 'mincha' ? sunsetWarmth(now, row.shkia) : 0;
}

/**
 * Structural on purpose: the resolved and the unconfirmed lists are different
 * types that agree about these two fields, and the filter has no business
 * knowing which of the two it was handed.
 */
function matchesServiceFilter(
  row: Pick<UpcomingMinyan | UnconfirmedMinyan, 'service' | 'dayType'>,
  filter: ServiceFilter,
): boolean {
  return filter === 'shabbat' ? row.dayType === 'shabbat' : row.service === filter;
}

function firstPerSynagogue<T extends { synagogue: { id: number } }>(rows: readonly T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.synagogue.id)) continue;
    seen.add(row.synagogue.id);
    out.push(row);
  }
  return out;
}

/**
 * Which chip is on when nobody has chosen one: the service of the very next
 * minyan anywhere in the data.
 *
 * The fallback is only reached when nothing at all is upcoming — an empty
 * database, or a horizon that found nothing. It is named rather than taken as
 * `SERVICE_FILTERS[0]`, because that made the layout order and the default
 * silently the same decision: reordering the chips to put שחרית first, which is
 * purely visual, moved this too. Shacharit is the right fallback on its own
 * merits — it is the only service known for every shul in the data — but it
 * should be chosen, not inherited from an array index.
 */
const FALLBACK_SERVICE: ServiceFilter = 'shacharit';

function defaultService(upcoming: readonly UpcomingMinyan[]): ServiceFilter {
  const soonest = upcoming[0];
  if (soonest && isServiceFilter(soonest.service)) return soonest.service;
  return FALLBACK_SERVICE;
}

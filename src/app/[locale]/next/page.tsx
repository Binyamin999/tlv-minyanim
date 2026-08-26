import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { VerifiedStamp } from '@/components/VerifiedStamp';
import { listSynagoguesWithMinyanim } from '@/db/queries';
import { localeAlternates } from '@/i18n/alternates';
import { getDictionary, type Dictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/locales';
import { walkingDirectionsUrl } from '@/lib/directions';
import { displayMinyanTime } from '@/lib/minyan-display';
import { foreignAttrs, localisedAddress, localisedName } from '@/lib/synagogue-display';
import {
  clockFaceOf,
  nextMinyanim,
  TEL_AVIV,
  type UnconfirmedMinyan,
  type UpcomingMinyan,
} from '@/zmanim';

/**
 * "Where can I daven in the next N minutes?" — the question this product
 * exists to answer, rendered as plainly as possible.
 *
 * DELIBERATELY UNDESIGNED, and it stays that way now that the designed
 * homepage exists at `/{locale}`. This page is the engine's proof, not a
 * product surface: it shows that a rule becomes a clock time, that the
 * ordering is by real instant, and that a shul whose Mincha is only `בזמן`
 * still appears instead of vanishing. `?within=` points it at any horizon.
 *
 * Fully server-rendered, like every page here. A crawler and a phone on a bad
 * connection see the same thing, and neither waits for JavaScript.
 */

/** The clock moves. Nothing on this page may be cached. */
export const dynamic = 'force-dynamic';

/**
 * The product question is 40 minutes. The default here is wider, because at
 * most hours of the day a 40-minute window over 16 Ramat Aviv shuls is empty
 * and an empty page proves nothing. The homepage answers the same question a
 * different way — one card per shul over eight days, so nothing is ever empty
 * merely because the next hour happens to be.
 */
const DEFAULT_WITHIN = 180;
const MAX_WITHIN = 60 * 24 * 2;

function parseWithin(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return DEFAULT_WITHIN;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_WITHIN;
  return Math.min(parsed, MAX_WITHIN);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return {
    title: t.nextMinyanim,
    description: t.nextMinyanimLink,
    alternates: localeAlternates(locale, '/next'),
  };
}

export default async function NextMinyanimPage({
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
  const otherLocale: Locale = locale === 'he' ? 'en' : 'he';
  const within = parseWithin(query.within);

  const synagogues = await listSynagoguesWithMinyanim();
  const timeline = nextMinyanim({
    now: new Date(),
    within,
    location: TEL_AVIV,
    synagogues,
  });

  const hebrewDate = locale === 'he' ? timeline.hebrewNow.renderHe : timeline.hebrewNow.renderEn;

  return (
    <main className="page">
      <header className="masthead">
        <Link className="home-link" href={`/${locale}`}>
          {t.siteName}
        </Link>
        <Link className="lang-switch" href={`/${otherLocale}/next`} hrefLang={otherLocale}>
          {t.otherLanguageName}
        </Link>
      </header>

      <h1 className="section-heading">{t.nextMinyanim}</h1>
      <p className="quiet">
        {/* Mixed Hebrew, digits and a Latin-ish clock on one line — isolate
            each run or the RTL algorithm reorders them. */}
        <span className="tabular">{t.withinMinutes(within)}</span>
        {' · '}
        <span className="time tabular">{clockFaceOf(timeline.now)}</span>
        {' · '}
        <span>{t.phases[timeline.phase]}</span>
        {' · '}
        <span dir={locale === 'he' ? 'rtl' : 'ltr'}>{hebrewDate}</span>
      </p>

      {timeline.upcoming.length === 0 ? (
        <p className="quiet">{t.noneUpcoming}</p>
      ) : (
        <ol className="timeline">
          {timeline.upcoming.map((row) => (
            <UpcomingRow
              key={`${row.minyan.id}-${row.instant.getTime()}`}
              row={row}
              locale={locale}
              t={t}
            />
          ))}
        </ol>
      )}

      {timeline.unconfirmed.length > 0 ? (
        <section className="day-block unconfirmed">
          {/* Quiet on purpose. The quietness is the design saying we don't
              know — CLAUDE.md. Never make this louder. */}
          <h2 className="section-heading">{t.unconfirmedTimesHeading}</h2>
          <p className="quiet">{t.unconfirmedTimesNote}</p>
          <ul className="timeline">
            {timeline.unconfirmed.map((row) => (
              <UnconfirmedRow
                key={`${row.synagogue.id}-${row.service}-${row.phase}`}
                row={row}
                locale={locale}
                t={t}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="quiet zmanim-source">{t.zmanimSource}</p>

      <p className="actions">
        <Link className="action action-quiet" href={`/${locale}`}>
          {t.allSynagogues}
        </Link>
      </p>
    </main>
  );
}

function UpcomingRow({
  row,
  locale,
  t,
}: {
  row: UpcomingMinyan;
  locale: Locale;
  t: Dictionary;
}) {
  const name = localisedName(row.synagogue, locale);
  const address = localisedAddress(row.synagogue, locale);
  // The rule stays on screen beside the resolved time. The rule is the honest
  // thing; the clock face is the convenience.
  const rule = displayMinyanTime(row.minyan.time, t);

  return (
    <li className="timeline-row">
      <p className="timeline-when">
        <span className="time tabular timeline-clock">{row.clock}</span>
        <span className="quiet">{t.inMinutes(row.minutesFromNow)}</span>
      </p>
      <p className="timeline-what">
        <span className="service">{t.services[row.service]}</span>
        {' · '}
        <Link
          className="shul-link"
          href={`/${locale}/shul/${row.synagogue.slug}`}
          {...foreignAttrs(name)}
        >
          {name.text}
        </Link>
      </p>
      {address ? (
        <p className="address" {...foreignAttrs(address)}>
          {address.text}
        </p>
      ) : null}
      {row.minyan.time.kind === 'relative' ? <p className="quiet rule">{rule.text}</p> : null}
      {/* Walking, never driving. People walk to shul. */}
      <p className="actions">
        <a
          className="walk-link"
          href={walkingDirectionsUrl(row.synagogue.lat, row.synagogue.lng)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.walkingDirections}
          <span className="visually-hidden"> {t.directionsTo(name.text)}</span>
        </a>
      </p>
      {/* A time without its staleness is a claim we cannot back. */}
      <VerifiedStamp
        lastVerifiedAt={row.synagogue.lastVerifiedAt}
        verifiedBy={row.synagogue.verifiedBy}
        locale={locale}
        t={t}
      />
    </li>
  );
}

function UnconfirmedRow({
  row,
  locale,
  t,
}: {
  row: UnconfirmedMinyan;
  locale: Locale;
  t: Dictionary;
}) {
  const name = localisedName(row.synagogue, locale);

  return (
    <li className="timeline-row">
      <p className="timeline-what">
        <span className="service">{t.services[row.service]}</span>
        {' · '}
        <Link
          className="shul-link"
          href={`/${locale}/shul/${row.synagogue.slug}`}
          {...foreignAttrs(name)}
        >
          {name.text}
        </Link>
      </p>
      {/* The halachic span for this service today — a fact about the day from
          the zmanim library, NOT a claim about when this shul davens. */}
      <p className="quiet unknown">
        {t.betweenTimes(
          clockFaceOf(row.serviceWindow.from),
          clockFaceOf(row.serviceWindow.to),
        )}
      </p>
      <p className="quiet reasons">{t.unconfirmedReasons[row.reason.code]}</p>
      <p className="actions">
        <a
          className="walk-link"
          href={walkingDirectionsUrl(row.synagogue.lat, row.synagogue.lng)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.walkingDirections}
          <span className="visually-hidden"> {t.directionsTo(name.text)}</span>
        </a>
      </p>
      <VerifiedStamp
        lastVerifiedAt={row.synagogue.lastVerifiedAt}
        verifiedBy={row.synagogue.verifiedBy}
        locale={locale}
        t={t}
      />
    </li>
  );
}

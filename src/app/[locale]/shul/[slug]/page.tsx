import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSynagogueBySlug, type Minyan, type SynagogueWithMinyanim } from '@/db/queries';
import { SITE_URL, localeAlternates } from '@/i18n/alternates';
import { getDictionary, type Dictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/locales';
import { VerifiedStamp } from '@/components/VerifiedStamp';
import { walkingDirectionsUrl, wazeUrl } from '@/lib/directions';
import { displayMinyanTime } from '@/lib/minyan-display';
import { synagogueJsonLd } from '@/lib/jsonld';
import { foreignAttrs, localisedAddress, localisedName } from '@/lib/synagogue-display';
import type { DayType, Service } from '@/minyan-times';

/**
 * A synagogue page. This is the landing page — SEO is the entire discovery
 * strategy, so every word on it is server-rendered and none of it waits for
 * JavaScript.
 */

/** Live data: the importer and the nightly diff change these rows. */
export const dynamic = 'force-dynamic';

/** The two day columns, in the order a week runs. */
const DAY_TYPES: DayType[] = ['weekday', 'shabbat'];

/** Services in the order of the day, not alphabetically. */
const SERVICE_ORDER: Service[] = ['shacharit', 'mincha', 'arvit'];

function byService(a: Minyan, b: Minyan): number {
  const rank = (m: Minyan) => (m.service ? SERVICE_ORDER.indexOf(m.service) : SERVICE_ORDER.length);
  return rank(a) - rank(b);
}

async function load(slugParam: string): Promise<SynagogueWithMinyanim> {
  const synagogue = await getSynagogueBySlug(decodeURIComponent(slugParam));
  if (!synagogue) notFound();
  return synagogue;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const synagogue = await load(slug);
  const t = getDictionary(locale);
  const name = localisedName(synagogue, locale).text;
  const address = localisedAddress(synagogue, locale);

  return {
    title: name,
    description: address ? `${t.tagline} · ${address.text}` : t.tagline,
    alternates: localeAlternates(locale, `/shul/${synagogue.slug}`),
  };
}

export default async function ShulPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const otherLocale: Locale = locale === 'he' ? 'en' : 'he';
  const synagogue = await load(slug);

  const name = localisedName(synagogue, locale);
  const address = localisedAddress(synagogue, locale);

  const confirmed = synagogue.minyanim.filter((minyan) => minyan.isPublishable);
  // A non-empty needs_review is a hard gate. These are kept and shown — losing
  // them would hide the data — but never in the confirmed list and never
  // without saying so.
  const unconfirmed = synagogue.minyanim.filter((minyan) => !minyan.isPublishable);

  const url = `${SITE_URL}/${locale}/shul/${synagogue.slug}`;
  const jsonLd = synagogueJsonLd({ synagogue, minyanim: synagogue.minyanim, locale, url, t });

  return (
    <main className="page">
      <header className="masthead">
        <Link className="home-link" href={`/${locale}`}>
          {t.siteName}
        </Link>
        <Link
          className="lang-switch"
          href={`/${otherLocale}/shul/${synagogue.slug}`}
          hrefLang={otherLocale}
        >
          {t.otherLanguageName}
        </Link>
      </header>

      <article className="card shul">
        <h1 className="shul-title" {...foreignAttrs(name)}>
          {name.text}
        </h1>

        {address ? (
          <p className="address" {...foreignAttrs(address)}>
            {address.text}
          </p>
        ) : null}

        {/* nusach may legitimately be NULL: the source says only `תימני`, which
            does not resolve to baladi or shami, and we do not guess a
            congregation's liturgy. An empty tag row is not rendered at all. */}
        {synagogue.nusach || synagogue.movement || synagogue.status !== 'active' ? (
          <p className="tags">
            {synagogue.nusach ? <span className="tag">{t.nusachim[synagogue.nusach]}</span> : null}
            {/* movement is hand-enriched only — never inferred from nusach. */}
            {synagogue.movement ? (
              <span className="tag">{t.movements[synagogue.movement]}</span>
            ) : null}
            {synagogue.status !== 'active' ? (
              <span className="tag tag-status">{t.statuses[synagogue.status]}</span>
            ) : null}
          </p>
        ) : null}

        {DAY_TYPES.map((dayType) => {
          const rows = confirmed.filter((minyan) => minyan.dayType === dayType).sort(byService);
          return (
            <section className="day-block" key={dayType}>
              <h2 className="section-heading">{t.dayTypes[dayType]}</h2>

              {rows.length === 0 ? (
                <p className="quiet">{t.noKnownTimes}</p>
              ) : (
                <ul className="minyanim">
                  {rows.map((minyan) => (
                    <MinyanRow key={minyan.id} minyan={minyan} t={t} />
                  ))}
                </ul>
              )}

              {/* last_verified_at sits with the times, in every block, because
                  a time without its staleness is a claim we cannot back. */}
              <VerifiedStamp
                lastVerifiedAt={synagogue.lastVerifiedAt}
                verifiedBy={synagogue.verifiedBy}
                locale={locale}
                t={t}
              />
            </section>
          );
        })}

        {unconfirmed.length > 0 ? (
          <section className="day-block unconfirmed">
            <h2 className="section-heading">{t.unconfirmedHeading}</h2>
            <p className="quiet">{t.unconfirmedNote}</p>
            <ul className="minyanim">
              {unconfirmed.map((minyan) => (
                <MinyanRow key={minyan.id} minyan={minyan} t={t} showReasons />
              ))}
            </ul>
          </section>
        ) : null}

        <p className="actions">
          {/* Walking first, and on every listing: people walk to shul. */}
          <a
            className="action"
            href={walkingDirectionsUrl(synagogue.lat, synagogue.lng)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t.walkingDirections}
          </a>
          {/* Waze belongs here and nowhere else — a driving app for the rarer
              cross-town trip. */}
          <a
            className="action action-quiet"
            href={wazeUrl(synagogue.lat, synagogue.lng)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t.wazeDirections}
          </a>
        </p>

        <p className="actions">
          <Link className="action action-quiet" href={`/${locale}`}>
            {t.allSynagogues}
          </Link>
        </p>
      </article>

      {/* PlaceOfWorship + OpeningHoursSpecification. Only times we actually
          know become hours — see src/lib/jsonld.ts. */}
      <script
        type="application/ld+json"
        // JSON, not markup: `<` is escaped so a name containing "</script>"
        // cannot close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </main>
  );
}

function MinyanRow({
  minyan,
  t,
  showReasons = false,
}: {
  minyan: Minyan;
  t: Dictionary;
  showReasons?: boolean;
}) {
  const time = displayMinyanTime(minyan.time, t);

  return (
    <li className="minyan">
      <span className="service">
        {minyan.service ? t.services[minyan.service] : null}
        {/* ח / ק — the source states two clock faces for one minyan. The
            separator appears only when there is a service word to separate it
            from; an unattributed row must not read as a dangling bullet. */}
        {minyan.season ? (
          <span className="season">
            {minyan.service ? ' · ' : null}
            {t.seasons[minyan.season]}
          </span>
        ) : null}
      </span>

      <span
        className={['value', time.numeric ? 'time tabular' : '', time.known ? '' : 'unknown']
          .filter(Boolean)
          .join(' ')}
      >
        {time.text}
      </span>

      {showReasons ? (
        <span className="reasons">
          {minyan.needsReview.map((reason) => t.reviewReasons[reason.code]).join(' · ')}
        </span>
      ) : null}
    </li>
  );
}

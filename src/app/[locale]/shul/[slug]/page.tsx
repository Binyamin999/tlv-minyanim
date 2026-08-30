import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSynagogueBySlug, type Minyan, type SynagogueWithMinyanim } from '@/db/queries';
import { SITE_URL, localeAlternates } from '@/i18n/alternates';
import { getDictionary, type Dictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/locales';
import { VerifiedStamp } from '@/components/VerifiedStamp';
import { walkingDirectionsUrl, wazeUrl } from '@/lib/directions';
import { displayNusach } from '@/lib/taxonomy';
import { displayMinyanTime } from '@/lib/minyan-display';
import { synagogueJsonLd } from '@/lib/jsonld';
import { nextOccurrences, weekdayName, type NextOccurrence } from '@/lib/resolved-times';
import { bidiText } from '@/components/BidiText';
import { foreignAttrs, localisedAddress, localisedName } from '@/lib/synagogue-display';
import type { DayType, Service } from '@/minyan-times';
import { clockFaceOf, jerusalemDateOf, TEL_AVIV, zmanimFor, type DayZmanim } from '@/zmanim';

/**
 * A synagogue page. This is the landing page — SEO is the entire discovery
 * strategy, so every word on it is server-rendered and none of it waits for
 * JavaScript.
 */

/** Live data: the importer and the nightly diff change these rows. */
export const dynamic = 'force-dynamic';

/** The two day columns, in the order a week runs. */
const DAY_TYPES: DayType[] = ['weekday', 'erev_shabbat', 'shabbat'];

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
  const shownNusachim = synagogue.nusachim;

  const confirmed = synagogue.minyanim.filter((minyan) => minyan.isPublishable);
  // A non-empty needs_review is a hard gate. These are kept and shown — losing
  // them would hide the data — but never in the confirmed list and never
  // without saying so.
  const unconfirmed = synagogue.minyanim.filter((minyan) => !minyan.isPublishable);

  // Resolved times for this shul's own rules, from the same engine that
  // drives /next — so `shkia - 20min` shows the clock face it actually works
  // out to today. The rule stays on screen beside it; the rule is the honest
  // thing and the clock face is the convenience.
  const now = new Date();
  const resolved = nextOccurrences(synagogue, now);
  const today = zmanimFor(TEL_AVIV, jerusalemDateOf(now));

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
            {bidiText(address.text)}
          </p>
        ) : null}
        {/* The Hebrew address stays on the English page, under the Latin one.
            A transliteration is what a visitor says to a driver and matches
            against a bilingual street sign; the Hebrew is what is painted on
            the building and what they can hold up to somebody. Neither
            replaces the other, and this page has room for both — the cards do
            not, which is why they carry the transliteration alone. Suppressed
            when it IS the Hebrew already, or the line would appear twice. */}
        {locale === 'en' && synagogue.addressHe && !address?.foreign ? (
          <p className="address address-native" lang="he" dir="rtl">
            {bidiText(synagogue.addressHe)}
          </p>
        ) : null}

        {/* nusach may legitimately be NULL: the source says only `תימני`, which
            does not resolve to baladi or shami, and we do not guess a
            congregation's liturgy. `general` reaches the same blank through
            displayNusach — it is stored but never shown, being a statement
            about our data rather than about this congregation. Both must also
            be absent from the GUARD, or a shul with nothing else to tag renders
            an empty row. An empty tag row is not rendered at all. */}
        {shownNusachim.length > 0 || synagogue.movement || synagogue.status !== 'active' ? (
          <p className="tags">
            {/* One tag per rite. A building serving three shows three; one that
                we cannot classify shows none, which is the same silence the old
                suppressed `general` produced and for the same reason. */}
            {shownNusachim.map((n) => (
              <span className="tag" key={n}>
                {t.nusachim[n]}
              </span>
            ))}
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
          // An empty block has two possible meanings and they are not
          // interchangeable. `אין שעות ידועות` says we are missing data and
          // sends a reader looking; where the synagogue has told us it holds
          // nothing that day, saying that would be false. The block is still
          // drawn — omitting it entirely reads as a page with a hole in it.
          const statedEmpty = synagogue.noMinyanimOn.includes(dayType);
          return (
            <section className="day-block" key={dayType}>
              <h2 className="section-heading">{t.dayTypes[dayType]}</h2>

              {rows.length === 0 ? (
                <p className="quiet">{statedEmpty ? t.noServicesHeld : t.noKnownTimes}</p>
              ) : (
                <ul className="minyanim">
                  {rows.map((minyan) => (
                    <MinyanRow
                      key={minyan.id}
                      minyan={minyan}
                      t={t}
                      locale={locale}
                      resolved={resolved.get(minyan.id)}
                    />
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
                <MinyanRow key={minyan.id} minyan={minyan} t={t} locale={locale} showReasons />
              ))}
            </ul>
          </section>
        ) : null}

        {/* The arithmetic behind every resolved time above, so a reader can
            check it rather than trust it. */}
        <ZmanimToday day={today} t={t} />

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

function ZmanimToday({ day, t }: { day: DayZmanim; t: Dictionary }) {
  // Only the anchors an actual minyan in our data hangs off, plus candle
  // lighting on the days it exists. A full luach is somebody else's product.
  const rows: Array<[string, Date]> = [
    [t.zmanim.netz, day.netz],
    [t.zmanim.chatzot, day.chatzot],
    [t.zmanim.shkia, day.shkia],
    [t.zmanim.tzeit, day.tzeit],
  ];
  if (day.candle_lighting) rows.push([t.zmanim.candle_lighting, day.candle_lighting]);

  return (
    <section className="day-block zmanim-today">
      <h2 className="section-heading">{t.zmanimToday}</h2>
      <ul className="minyanim">
        {rows.map(([label, at]) => (
          <li className="minyan" key={label}>
            <span className="service">{label}</span>
            <span className="value time tabular">{clockFaceOf(at)}</span>
          </li>
        ))}
      </ul>
      <p className="quiet zmanim-source">{t.zmanimSource}</p>
    </section>
  );
}

function MinyanRow({
  minyan,
  t,
  locale,
  resolved,
  showReasons = false,
}: {
  minyan: Minyan;
  t: Dictionary;
  locale: Locale;
  resolved?: NextOccurrence | undefined;
  showReasons?: boolean;
}) {
  const time = displayMinyanTime(minyan.time, t);
  // Shown only where the rule is not already a clock face. Repeating "= 06:30"
  // beside a stored 06:30 would be noise; `shkia - 20min` is the case this is
  // for. An unknown never gets one — there is nothing to resolve.
  const showResolved = minyan.time.kind === 'relative' && resolved !== undefined;

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
        {/* Which weekdays, when it is not all of them. Never omitted: a 07:10
            row sitting under a 07:15 row with nothing to separate them reads
            as a contradiction, and a reader picking the wrong one is five
            minutes late on exactly the two days the difference exists for.
            Empty means every day and prints nothing — silence is correct
            there, because there is no restriction to state. */}
        {minyan.daysOfWeek.length > 0 ? (
          <span className="minyan-days">
            {minyan.service || minyan.season ? ' · ' : null}
            {t.onDays(minyan.daysOfWeek.map((d) => t.weekdaysShort[d]).join(' '))}
          </span>
        ) : null}
        {/* What the board calls this minyan. It sits before the room because
            it says what KIND of minyan this is, which is what a reader picks
            by; the room only matters once they have picked. Says nothing about
            how the time is computed — 05:40 is still a clock face with a
            window, not netz − 34. */}
        {minyan.style ? (
          <span className="minyan-style">
            {minyan.service || minyan.season || minyan.daysOfWeek.length > 0 ? ' · ' : null}
            {t.styles[minyan.style]}
          </span>
        ) : null}
        {/* Which room, when the board named one. Two Arvits an hour apart in
            one building are two different staircases to a stranger, and the
            times alone cannot say which. NULL prints nothing, because for a
            one-room shul there is nothing to say. */}
        {minyan.location ? (
          <span className="minyan-where">
            {minyan.service || minyan.season || minyan.daysOfWeek.length > 0 || minyan.style
              ? ' · '
              : null}
            {t.locations[minyan.location]}
          </span>
        ) : null}
        {/* Only when this minyan is its own group. The house minyan carries no
            nusach here and must not be labelled with the synagogue's — every
            row would then read as a separate congregation, which is the
            opposite of what this column is for. */}
        {minyan.nusach ? (
          <span className="minyan-nusach">
            {minyan.service || minyan.season ? ' · ' : null}
            {t.nusachim[minyan.nusach]}
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

      {showResolved && resolved ? (
        <span className="resolved">
          <span className="time tabular">{t.resolvesTo(resolved.clock)}</span>
          {/* Say which day when it is not today: a Shabbat-only minyan
              resolving to next Saturday must not read as "in ten minutes". */}
          <span className="quiet">
            {' '}
            {resolved.isToday ? t.today : weekdayName(resolved.instant, locale)}
          </span>
        </span>
      ) : null}

      {showReasons ? (
        <span className="reasons">
          {minyan.needsReview.map((reason) => t.reviewReasons[reason.code]).join(' · ')}
        </span>
      ) : null}
    </li>
  );
}

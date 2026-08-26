/**
 * schema.org for a synagogue page.
 *
 * SEO is the entire discovery strategy, so this markup has to be *correct*,
 * not merely present. Two rules follow from that, and both are about refusing
 * to state more than we know:
 *
 * 1. Only `fixed` times become an `opens`. Revisited in phase 3, when the
 *    zmanim library landed and a `relative` time COULD be resolved — and the
 *    answer did not change. `OpeningHoursSpecification` states a recurring
 *    weekly clock time; `shkia - 20min` is a different clock time every week,
 *    so today's resolved value would be published as a permanent claim and be
 *    wrong by next Shabbat. An `unknown` has no clock face at all. Emitting a
 *    plausible-looking `opens` for either would be publishing a fabricated
 *    time in machine-readable form — the worst place to be wrong, because
 *    nobody sees it to correct it.
 *
 *    TODO: schema.org has `validFrom`/`validThrough`; a nightly job could emit
 *    a dated spec per week. That is a refresh-engine change, not a rendering
 *    one, and it needs the nightly diff job first.
 *
 * 2. Only publishable rows are emitted. A row with a pending review reason is
 *    not confirmed, and structured data is a claim.
 */
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { Minyan, Synagogue } from '@/db/queries';

/**
 * `weekday` deliberately stops at Thursday.
 *
 * The source column means חול, which in Israel spans Sunday to Friday — but
 * Friday is erev Shabbat, when Mincha and Arvit move to candle lighting and
 * are emphatically not the weekday time. The source does not distinguish
 * them, so claiming Friday would over-state what we know for two services out
 * of three. Under-claiming a day is recoverable; sending someone to a shul on
 * a wrong day is not.
 */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const;
const SHABBAT = ['Saturday'] as const;

const DAY_URL = (day: string): string => `https://schema.org/${day}`;

export interface OpeningHours {
  '@type': 'OpeningHoursSpecification';
  name: string;
  dayOfWeek: string[];
  opens: string;
}

export function openingHours(minyanim: Minyan[], t: Dictionary): OpeningHours[] {
  const specs: OpeningHours[] = [];

  for (const minyan of minyanim) {
    if (!minyan.isPublishable) continue;
    if (minyan.time.kind !== 'fixed') continue;
    if (minyan.service === null || minyan.dayType === null) continue;
    // A seasonal time holds for only part of the year and schema.org would
    // need validFrom/validThrough to say so. The source gives no dates, and
    // inventing them would make a year-round claim out of half a year.
    if (minyan.season !== null) continue;

    specs.push({
      '@type': 'OpeningHoursSpecification',
      name: t.services[minyan.service],
      dayOfWeek: (minyan.dayType === 'shabbat' ? SHABBAT : WEEKDAYS).map(DAY_URL),
      // No `closes`: a minyan is a start time, not an interval. schema.org
      // makes both optional; a made-up end time would be worse than silence.
      opens: minyan.time.time,
    });
  }

  return specs;
}

export interface SynagogueJsonLdInput {
  synagogue: Synagogue;
  minyanim: Minyan[];
  locale: Locale;
  /** Absolute canonical URL of this page. */
  url: string;
  t: Dictionary;
}

export function synagogueJsonLd({
  synagogue,
  minyanim,
  locale,
  url,
  t,
}: SynagogueJsonLdInput): Record<string, unknown> {
  // English name and address are NULL until translated; falling back to the
  // Hebrew is right, because the Hebrew is true and an invented English is not.
  const name = (locale === 'en' ? synagogue.nameEn : synagogue.nameHe) ?? synagogue.nameHe;
  const street = (locale === 'en' ? synagogue.addressEn : synagogue.addressHe) ?? synagogue.addressHe;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'PlaceOfWorship',
    '@id': url,
    url,
    name,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: synagogue.lat,
      longitude: synagogue.lng,
    },
  };

  if (street) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: street,
      addressLocality: locale === 'en' ? 'Tel Aviv-Yafo' : 'תל אביב-יפו',
      addressCountry: 'IL',
    };
  }

  const hours = openingHours(minyanim, t);
  if (hours.length > 0) jsonLd.openingHoursSpecification = hours;

  return jsonLd;
}

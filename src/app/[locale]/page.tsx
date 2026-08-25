import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { localeAlternates } from '@/i18n/alternates';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/locales';
import { displayMinyanTime, formatVerifiedDate } from '@/lib/minyan-display';
import { isPublishable, minyanimOnly, type ParsedMinyan } from '@/minyan-times';

/**
 * Smoke test, not the homepage. It exists to prove four things end to end:
 * the page is server-rendered, `dir` is right in both locales, the parser
 * imports cleanly into the app, and an unknown time renders as unknown.
 *
 * TODO(phase 4): replace with the real homepage — the design is already
 * settled in the artboards. TODO(phase 2): read from Postgres instead of this
 * hard-coded fixture.
 */

/**
 * One real Ramat Aviv congregation, with its raw GIS time fields parsed at
 * render time. Deliberately *not* hand-written MinyanTime objects: running the
 * strings through the real parser is what proves nothing is being faked.
 *
 * Note the address — היכל חיים and נוה קודש share Oppenheimer 5 and are two
 * independent congregations. Address is never a key.
 */
const FIXTURE = {
  nameHe: 'היכל חיים',
  nameEn: 'Heichal Chaim',
  addressHe: 'אופנהיימר 5, רמת אביב',
  addressEn: '5 Oppenheimer St, Ramat Aviv',
  weekdayFields: ['שחרית-נץ-7:00', 'מנחה-13:30-בזמן'],
  /** The GIS import date. We do not claim a verification we did not do. */
  lastVerifiedAt: new Date('2025-06-13T00:00:00+03:00'),
  verifiedBy: 'TLV GIS layer 568',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return { title: t.tagline, alternates: localeAlternates(locale, '') };
}

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const otherLocale: Locale = locale === 'he' ? 'en' : 'he';

  const minyanim: ParsedMinyan[] = FIXTURE.weekdayFields
    .flatMap((field) => minyanimOnly(field, { dayType: 'weekday' }))
    // A non-empty needsReview is a hard publication gate, enforced here as
    // well as in the database.
    .filter(isPublishable);

  return (
    <main className="page">
      <header className="masthead">
        <h1>{t.siteName}</h1>
        <p>{t.tagline}</p>
        <Link className="lang-switch" href={`/${otherLocale}`} hrefLang={otherLocale}>
          {t.otherLanguageName}
        </Link>
      </header>

      <article className="card">
        <h2>{locale === 'he' ? FIXTURE.nameHe : FIXTURE.nameEn}</h2>
        <p className="address">{locale === 'he' ? FIXTURE.addressHe : FIXTURE.addressEn}</p>

        <ul className="minyanim">
          {minyanim.map((minyan) => {
            const time = displayMinyanTime(minyan.time, t);
            return (
              <li className="minyan" key={`${minyan.rawField}#${minyan.index}`}>
                <span className="service">{minyan.service ? t.services[minyan.service] : ''}</span>
                <span
                  className={[
                    'value',
                    time.numeric ? 'time tabular' : '',
                    time.known ? '' : 'unknown',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {time.text}
                </span>
              </li>
            );
          })}
        </ul>

        {/* last_verified_at is shown wherever a time is shown. Honest decay is
            the trust model — no competitor admits staleness. */}
        <p className="verified">
          <span className="stamp tabular">
            {t.lastVerified(formatVerifiedDate(FIXTURE.lastVerifiedAt, locale))}
          </span>
          {' · '}
          <span className="stamp">{t.verifiedBy(FIXTURE.verifiedBy)}</span>
        </p>
      </article>
    </main>
  );
}

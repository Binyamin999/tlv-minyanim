import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { listSynagogues } from '@/db/queries';
import { localeAlternates } from '@/i18n/alternates';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/locales';
import { walkingDirectionsUrl } from '@/lib/directions';
import { foreignAttrs, localisedAddress, localisedName } from '@/lib/synagogue-display';

/**
 * The index of synagogues, server-rendered from Postgres.
 *
 * Plain on purpose. The designed homepage — the one that answers "where can I
 * daven in the next 40 minutes?" — is phase 4 and already settled in the
 * artboards; building a second design here would only be thrown away.
 * TODO(phase 4): replace with the real homepage.
 */

/**
 * Read at request time. The row set changes whenever the importer or the
 * nightly diff job runs, and a page cached at build time would go stale
 * silently — the exact failure this product exists to avoid.
 * TODO(phase 4): revalidate on a timer once the refresh cadence is fixed.
 */
export const dynamic = 'force-dynamic';

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
  const synagogues = await listSynagogues();

  return (
    <main className="page">
      <header className="masthead">
        <h1>{t.siteName}</h1>
        <p>{t.tagline}</p>
        <Link className="lang-switch" href={`/${otherLocale}`} hrefLang={otherLocale}>
          {t.otherLanguageName}
        </Link>
      </header>

      {/* The engine proof, phase 3. The designed answer to this question is
          the phase 4 homepage; this is a plain link to a plain list. */}
      <p className="actions">
        <Link className="action" href={`/${locale}/next`}>
          {t.nextMinyanimLink}
        </Link>
      </p>

      <h2 className="section-heading">{t.synagogues}</h2>

      <ul className="shul-index">
        {synagogues.map((synagogue) => {
          const name = localisedName(synagogue, locale);
          const address = localisedAddress(synagogue, locale);
          return (
            <li className="shul-index-item" key={synagogue.slug}>
              <Link className="shul-link" href={`/${locale}/shul/${synagogue.slug}`}>
                <span className="shul-name" {...foreignAttrs(name)}>
                  {name.text}
                </span>
              </Link>
              {address ? (
                <span className="address" {...foreignAttrs(address)}>
                  {address.text}
                </span>
              ) : null}
              {/* Walking, never driving. Waze is a driving app and belongs on
                  the individual shul page only. */}
              <a
                className="walk-link"
                href={walkingDirectionsUrl(synagogue.lat, synagogue.lng)}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t.walkingDirections}
                <span className="visually-hidden"> {t.directionsTo(name.text)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

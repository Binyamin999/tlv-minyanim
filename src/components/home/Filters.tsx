import Link from 'next/link';

import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { Nusach } from '@/lib/taxonomy';
import type { ServiceFilter } from '@/lib/home-filters';
import { SERVICE_FILTERS, homeHref } from '@/lib/home-filters';

/**
 * The two chip rows, as plain links.
 *
 * Links, not buttons with client state. Every filtered view is a real URL that
 * a crawler can follow and a person can send to a friend, and the page it
 * lands on is server-rendered — which is the whole discovery strategy. A
 * client-side filter would make four views of this page invisible to Google.
 */
export function Filters({
  locale,
  t,
  service,
  nusach,
  availableNusachim,
}: {
  locale: Locale;
  t: Dictionary;
  service: ServiceFilter;
  nusach: Nusach | null;
  /**
   * The nusachim that actually exist in the data, in taxonomy order.
   *
   * Derived rather than hard-coded. The artboard draws אשכנז / עדות המזרח /
   * תימני because that is a plausible Tel Aviv row, but there is no Yemenite
   * shul in Ramat Aviv, and a chip that always returns nothing is a worse
   * answer than no chip. At 484 this row grows on its own.
   */
  availableNusachim: readonly Nusach[];
}) {
  return (
    <div className="filters">
      <nav className="filter-row filter-services" aria-label={t.filterServicesLabel}>
        {SERVICE_FILTERS.map((option) => (
          <Link
            key={option}
            className="chip chip-service"
            href={homeHref(locale, option, nusach)}
            aria-current={option === service ? 'true' : undefined}
          >
            {option === 'shabbat' ? t.filterShabbat : t.services[option]}
          </Link>
        ))}
      </nav>

      <nav className="filter-row filter-nusach" aria-label={t.filterNusachLabel}>
        <Link
          className="chip chip-nusach"
          href={homeHref(locale, service, null)}
          aria-current={nusach === null ? 'true' : undefined}
        >
          {t.filterAllNusachim}
        </Link>
        {availableNusachim.map((option) => (
          <Link
            key={option}
            className="chip chip-nusach"
            href={homeHref(locale, service, option)}
            aria-current={option === nusach ? 'true' : undefined}
          >
            {t.nusachim[option]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

import { formatVerifiedDate } from '@/lib/minyan-display';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';

/**
 * The staleness stamp. It appears wherever a time appears, including when the
 * answer is "never" — no competitor admits staleness, and honest decay is the
 * whole trust model. `null` here is not a missing value to hide; it is the
 * strongest thing we have to say about this listing.
 */
export function VerifiedStamp({
  lastVerifiedAt,
  verifiedBy,
  locale,
  t,
}: {
  lastVerifiedAt: Date | null;
  verifiedBy: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  if (lastVerifiedAt === null || verifiedBy === null) {
    return (
      <p className="verified">
        <span className="stamp">{t.neverVerified}</span>
      </p>
    );
  }

  return (
    <p className="verified">
      <span className="stamp tabular">
        {t.lastVerified(formatVerifiedDate(lastVerifiedAt, locale))}
      </span>
      {' · '}
      <span className="stamp">{t.verifiedBy(verifiedBy)}</span>
    </p>
  );
}

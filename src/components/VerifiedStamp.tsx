import { formatVerifiedDate, formatVerifiedDateShort } from '@/lib/minyan-display';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';

/**
 * The staleness stamp. It appears wherever a time appears, including when the
 * answer is "never" — no competitor admits staleness, and honest decay is the
 * whole trust model. `null` here is not a missing value to hide; it is the
 * strongest thing we have to say about this listing.
 *
 * `compact` is the card footer's version: `נבדק 12.8.26` on one 10px line, as
 * the artboards draw it. Same fact, same null case, less room.
 */
export function VerifiedStamp({
  lastVerifiedAt,
  verifiedBy,
  locale,
  t,
  compact = false,
}: {
  lastVerifiedAt: Date | null;
  verifiedBy: string | null;
  locale: Locale;
  t: Dictionary;
  compact?: boolean;
}) {
  if (lastVerifiedAt === null || verifiedBy === null) {
    return (
      <p className={compact ? 'verified verified-compact' : 'verified'}>
        <span className="stamp">{t.neverVerified}</span>
      </p>
    );
  }

  // `verified_by` is a CODE, localised here. It used to be free text, which
  // rendered an English sentence inside the Hebrew page. A row carrying prose
  // from before that change falls through to showing itself rather than an
  // empty source line — wrong language beats no provenance.
  const source = t.verificationSources[verifiedBy] ?? verifiedBy;

  if (compact) {
    return (
      <p className="verified verified-compact">
        <span className="stamp tabular" title={t.verifiedBy(source)}>
          {t.verifiedShort(formatVerifiedDateShort(lastVerifiedAt, locale))}
        </span>
      </p>
    );
  }

  return (
    <p className="verified">
      <span className="stamp tabular">
        {t.lastVerified(formatVerifiedDate(lastVerifiedAt, locale))}
      </span>
      {' · '}
      <span className="stamp">{t.verifiedBy(source)}</span>
    </p>
  );
}

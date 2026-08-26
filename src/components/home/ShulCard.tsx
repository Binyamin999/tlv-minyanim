import Link from 'next/link';

import { VerifiedStamp } from '@/components/VerifiedStamp';
import { WalkIcon } from '@/components/icons';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { walkingDirectionsUrl } from '@/lib/directions';
import { foreignAttrs, localisedAddress, localisedName } from '@/lib/synagogue-display';
import { warmthPercent } from '@/lib/sunset-warmth';
import type { Nusach } from '@/lib/taxonomy';
import type { TimelineSynagogue, UnconfirmedMinyan, UpcomingMinyan } from '@/zmanim';

/**
 * One synagogue, one time. The list below the hero is one of these per shul,
 * ordered by when that shul next davens.
 *
 * Two variants, and the difference between them is the whole trust model:
 * either we know the time, or we say we do not.
 */
export function ShulCard({
  row,
  nusach,
  warmth,
  locale,
  t,
}: {
  row: UpcomingMinyan;
  /** Passed in, not read off the row: the timeline's synagogue shape is
   *  deliberately the minimum it needs to place a time, and a nusach is not
   *  part of placing a time. */
  nusach: Nusach | null;
  warmth: number;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <CardShell
      synagogue={row.synagogue}
      nusach={nusach}
      warmth={warmth}
      locale={locale}
      t={t}
      value={
        <>
          <p className="card-clock">
            <span className="time tabular">{row.clock}</span>
          </p>
          <p className="card-service-pill">{t.services[row.service]}</p>
        </>
      }
      footerEnd={
        <VerifiedStamp
          compact
          lastVerifiedAt={row.synagogue.lastVerifiedAt}
          verifiedBy={row.synagogue.verifiedBy}
          locale={locale}
          t={t}
        />
      }
    />
  );
}

/**
 * The honest-unknown row. This shul davens this service; the source never said
 * when, and we will not invent it.
 *
 * QUIET ON PURPOSE. CLAUDE.md: "its quietness is the design saying we don't
 * know", and if a contrast sweep points here, what is failing is the *action*
 * beside it, not this. Do not make this louder.
 *
 * The directions control is identical in kind to the resolved card's: the time
 * is unpublished, the way there is not.
 */
export function UnknownShulCard({
  row,
  nusach,
  locale,
  t,
}: {
  row: UnconfirmedMinyan;
  nusach: Nusach | null;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <CardShell
      synagogue={row.synagogue}
      nusach={nusach}
      warmth={0}
      locale={locale}
      t={t}
      value={<p className="card-unknown">{t.unknownTimeCard}</p>}
      footerEnd={
        // Deliberately not a link. There is nowhere honest to send anyone yet
        // — the gabbai portal does not exist — and a dead link would be a
        // worse lie than a line of text. The artboard draws it as text too.
        <p className="card-cta">{t.knowTheTime}</p>
      }
    />
  );
}

function CardShell({
  synagogue,
  nusach,
  warmth,
  locale,
  t,
  value,
  footerEnd,
}: {
  synagogue: TimelineSynagogue;
  nusach: Nusach | null;
  warmth: number;
  locale: Locale;
  t: Dictionary;
  value: React.ReactNode;
  footerEnd: React.ReactNode;
}) {
  const name = localisedName(synagogue, locale);
  const address = localisedAddress(synagogue, locale);

  return (
    <article
      className="card"
      style={{ '--warm-pct': warmthPercent(warmth) } as React.CSSProperties}
    >
      <div className="card-head">
        <div className="card-where">
          <h3 className="card-name">
            <Link href={`/${locale}/shul/${synagogue.slug}`} {...foreignAttrs(name)}>
              {name.text}
            </Link>
          </h3>
          <p className="card-address">
            {address ? <span {...foreignAttrs(address)}>{address.text}</span> : null}
            {address ? (
              <span className="card-dot" aria-hidden="true">
                ·
              </span>
            ) : null}
            {/* Walking, never driving — people walk to shul. */}
            <a
              className="walk-link"
              href={walkingDirectionsUrl(synagogue.lat, synagogue.lng)}
              rel="noopener noreferrer"
              target="_blank"
            >
              <WalkIcon />
              {t.walkingDirections}
              <span className="visually-hidden"> {t.directionsTo(name.text)}</span>
            </a>
          </p>
        </div>
        <div className="card-value">{value}</div>
      </div>

      <div className="card-foot">
        {nusach ? <p className="card-nusach">{t.nusachim[nusach]}</p> : <span />}
        {footerEnd}
      </div>
    </article>
  );
}

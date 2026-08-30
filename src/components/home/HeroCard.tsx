import Link from 'next/link';

import { VerifiedStamp } from '@/components/VerifiedStamp';
import { WalkIcon } from '@/components/icons';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { walkingDirectionsUrl, wazeUrl } from '@/lib/directions';
import { displayMinyanTime } from '@/lib/minyan-display';
import { bidiText } from '@/components/BidiText';
import { foreignAttrs, localisedAddress, localisedName } from '@/lib/synagogue-display';
import { warmthPercent } from '@/lib/sunset-warmth';
import type { Nusach } from '@/lib/taxonomy';
import type { UpcomingMinyan } from '@/zmanim';

/**
 * The answer to the only question this product exists to answer, drawn once,
 * large, at the foot of the photograph.
 *
 * The sunset warming rides on `--warm-pct`. Every colour in this card that can
 * warm is a `color-mix` against that one number, so the whole card moves
 * together as shkia approaches instead of one label going terracotta while the
 * rest stays cyan. Zero for anything that is not Mincha — the window closing
 * is Mincha's window.
 *
 * `last_verified_at` is here even though the artboard's hero omits it. That is
 * not a liberty: CLAUDE.md requires the stamp "wherever a time is shown", and
 * this is the largest time on the site. Quiet, at the foot, in the card
 * footer's own size.
 */
export function HeroCard({
  row,
  nusachim,
  warmth,
  locale,
  t,
}: {
  row: UpcomingMinyan;
  /**
   * Rendered always, shown only on desktop.
   *
   * The phone card has no room for it and the artboards it was built to do
   * not draw it. The desktop לוח does — the hero is the table's own top row
   * there, so it has to carry the same five columns as every row below it or
   * the column rhythm the whole direction rests on breaks at the first row.
   * Passed in rather than read off `row` for the same reason as ShulCard: a
   * nusach is not part of placing a time, so the timeline does not carry one.
   */
  nusachim: readonly Nusach[];
  warmth: number;
  locale: Locale;
  t: Dictionary;
}) {
  const name = localisedName(row.synagogue, locale);
  const address = localisedAddress(row.synagogue, locale);
  // The rule stays on screen beside the resolved clock face. The rule is the
  // honest thing; the clock face is the convenience.
  const rule = displayMinyanTime(row.minyan.time, t);

  return (
    <article
      className="hero"
      style={{ '--warm-pct': warmthPercent(warmth) } as React.CSSProperties}
      /* The hero carries a distance but is never re-sorted — it is the next
         minyan by TIME, and a shul 200 m away whose next minyan is tomorrow
         morning is not the answer to "where can I daven now". See NearMe. */
      data-lat={row.synagogue.lat}
      data-lng={row.synagogue.lng}
      data-at={row.instant.toISOString()}
    >
      <div className="hero-head">
        <p className="hero-service">{t.services[row.service]}</p>
      </div>

      {/* The digits are their own bidi run, but the LINE is the page's — a
          `direction: ltr` block would drag the whole clock to the wrong edge
          of an RTL card. Isolate the run, not the paragraph. */}
      <p className="hero-clock">
        <span className="time tabular">{row.clock}</span>
      </p>

      <div className="hero-meta">
        <span className="hero-pill tabular">{t.inMinutes(row.minutesFromNow)}</span>
        {row.minyan.time.kind === 'relative' ? <span className="hero-rule">{rule.text}</span> : null}
      </div>

      <div className="hero-where">
        <h2 className="hero-name">
          <Link href={`/${locale}/shul/${row.synagogue.slug}`} {...foreignAttrs(name)}>
            {name.text}
          </Link>
        </h2>
        {/* Address and directions share a line, the address at the reading
            edge and the directions at the far one. `display: contents` on
            desktop so the board's grid still places each of them in its own
            column — the wrapper exists for the phone only. */}
        <div className="hero-place-row">
          {address ? (
            // `dir` goes on the RUN, not on the paragraph. On the English page
            // a Hebrew address is an RTL island inside an LTR line; putting the
            // attribute on the <p> would also flush the whole line to the far
            // edge, so the name sits left and its own address sits right.
            <p className="hero-address">
              <span {...foreignAttrs(address)}>{bidiText(address.text)}</span>
              <span className="near-slot tabular" hidden />
              <span className="near-too-far" hidden />
            </p>
          ) : (
            <span />
          )}
        {/* With the address, because that is what you navigate TO — and
            because every card below this one does the same. They used to sit
            in the head, opposite the service label, which offered a reader
            directions before telling them which synagogue or when.

            Walking first and never displaced: most journeys to a minyan are on
            foot, often on erev Shabbat. Waze is the quiet second, for the rarer
            cross-town trip. Order carries the recommendation. */}
        <span className="hero-directions">
          <a
            className="walk-link"
            href={walkingDirectionsUrl(row.synagogue.lat, row.synagogue.lng)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <WalkIcon size={13} />
            {t.walkingDirections}
            <span className="visually-hidden"> {t.directionsTo(name.text)}</span>
          </a>
          <span className="card-dot" aria-hidden="true">
            ·
          </span>
          <a
            className="walk-link walk-link-quiet"
            href={wazeUrl(row.synagogue.lat, row.synagogue.lng)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t.wazeDirections}
            <span className="visually-hidden"> {t.directionsTo(name.text)}</span>
          </a>
        </span>
        </div>
        {nusachim.length > 0 ? (
          <p className="hero-nusach">{nusachim.map((n) => t.nusachim[n]).join(' · ')}</p>
        ) : null}
        {/* A time without its staleness is a claim we cannot back. */}
        <VerifiedStamp
          compact
          lastVerifiedAt={row.synagogue.lastVerifiedAt}
          verifiedBy={row.synagogue.verifiedBy}
          locale={locale}
          t={t}
        />
      </div>
    </article>
  );
}

/**
 * What the hero says when the filter in force has nothing resolved in it.
 *
 * The artboards have no empty state, because a mockup is never empty. A real
 * page is — there is not a single Arvit row in the source data for Ramat Aviv
 * — and the honest answer is the same shape of card saying so, not a hero that
 * quietly disappears and leaves the photograph looking broken.
 */
export function HeroEmpty({ t }: { t: Dictionary }) {
  return (
    <article className="hero hero-empty">
      <p className="hero-empty-text">{t.noneUpcoming}</p>
    </article>
  );
}

import Link from 'next/link';

import { ModeToggle } from '@/components/ModeToggle';
import type { Dictionary } from '@/i18n/dictionaries';
import { LOCALES, type Locale } from '@/i18n/locales';
import type { Mode, ModePreference } from '@/lib/theme';

/**
 * The photographic header band.
 *
 * THE PHOTOGRAPH FILLS THE HEADER IN BOTH MODES. That was corrected twice
 * during design and is not up for reinterpretation: it is not a side panel, it
 * is not a painted gradient standing in for a missing picture. Day is sharp,
 * night is blurred 6px — softness there is ambient texture, the deliberate
 * treatment that lets an identity image be treated heavily, not a defect.
 *
 * ---------------------------------------------------------------------------
 * WHY BACKGROUND IMAGES AND NOT TWO <img> TAGS
 * ---------------------------------------------------------------------------
 * Both photographs have to be in the markup, because the light/dark override
 * flips modes in the browser with no server round trip and the picture has to
 * flip with it. Two <img> tags would download 145KB to show 86KB of it — on
 * "a slow connection", which is the stated bar. A background image on an
 * element that is `display: none` is never fetched, so only the current mode's
 * photograph crosses the wire, and the other one arrives if and when somebody
 * actually switches. The layout preloads the mode the server decided on.
 *
 * Decorative either way: `alt=""` in the artboards, and a masthead is not
 * evidence about a place. CLAUDE.md — "closer to a masthead than an
 * illustration".
 */
export function Masthead({
  locale,
  t,
  modePreference,
  skyMode,
  hebrewDate,
  parsha,
  shkia,
  localeHrefs,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  modePreference: ModePreference;
  skyMode: Mode;
  /** Already gematriya in Hebrew, spelled out in English. Rolled at sunset. */
  hebrewDate: string;
  /** null on a week whose Shabbat is a chag — we do not name a parsha then. */
  parsha: string | null;
  /** Today's shkia as a wall clock. Print this; never print a Date. */
  shkia: string;
  /**
   * Where each language chip goes, filters and all.
   *
   * Not `/he` and `/en` flat: switching language must land on the SAME page in
   * the other language, or the two halves of a bilingual site stop pointing at
   * each other — which reads to a crawler as two thin duplicates rather than
   * one page in two languages, and reads to a person as "it lost my place".
   */
  localeHrefs: Record<Locale, string>;
  /** The hero card, which floats at the foot of the band. */
  children: React.ReactNode;
}) {
  return (
    <header className="band">
      {/* Only one of these is ever displayed, so only one is ever fetched. */}
      <div className="band-photo band-photo-day" aria-hidden="true" />
      <div className="band-photo band-photo-night" aria-hidden="true" />
      <div className="band-scrim" aria-hidden="true" />

      {/* The masthead and the ribbon share a local scrim of their own. The
          band-wide wash is kept light in the middle so the photograph reads as
          a photograph; a wash dark enough to carry 11.5px white everywhere
          would drown it. Measured over the real pixels, not modelled. */}
      <div className="band-head">
        <div className="band-top">
          <Link className="wordmark" href={`/${locale}`}>
            {t.wordmark}
          </Link>
          <div className="band-controls">
            <ModeToggle
              preference={modePreference}
              skyMode={skyMode}
              labels={{
                group: t.modeControlLabel,
                auto: t.modeAuto,
                names: t.modeNames,
              }}
            />
            <nav
              className="segmented lang-chips"
              aria-label={t.languageSwitchLabel}
            >
              {LOCALES.map((other) => (
                <Link
                  key={other}
                  className="segment"
                  href={localeHrefs[other]}
                  hrefLang={other}
                  lang={other}
                  aria-current={other === locale ? 'page' : undefined}
                >
                  {t.localeChips[other]}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="band-ribbon">
          {/* Hebrew date and parsha are one bidi run; the clock is another. Mixed
            Hebrew, Latin and digits on one line is exactly where RTL breaks. */}
          <p className="ribbon-date">
            <span dir={locale === 'he' ? 'rtl' : 'ltr'}>{hebrewDate}</span>
            {parsha ? (
              <>
                <span aria-hidden="true"> · </span>
                <span dir={locale === 'he' ? 'rtl' : 'ltr'}>{parsha}</span>
              </>
            ) : null}
          </p>
          <p className="ribbon-shkia">
            <span className="ribbon-zman-name">{t.zmanim.shkia}</span>
            <span className="time tabular">{shkia}</span>
          </p>
        </div>
      </div>

      <div className="band-hero">{children}</div>
    </header>
  );
}

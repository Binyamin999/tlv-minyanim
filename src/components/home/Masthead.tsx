import Link from 'next/link';

import { ModeToggle } from '@/components/ModeToggle';
import type { Dictionary } from '@/i18n/dictionaries';
import { LOCALES, type Locale } from '@/i18n/locales';
import type { Zman } from '@/minyan-times';
import { warmthPercent } from '@/lib/sunset-warmth';
import type { Mode, ModePreference } from '@/lib/theme';

/** One zman as the ribbon prints it: the name, and the wall clock it works out to. */
export interface RibbonZman {
  zman: Zman;
  /** "HH:MM" in Asia/Jerusalem. Print this; never print a Date. */
  clock: string;
}

/**
 * The one zman a phone has room for.
 *
 * Named rather than taken as `zmanim[0]`, for the same reason the default
 * service chip is named: otherwise reordering the ribbon to read the way the
 * day happens — netz, mincha gedola, shkia, tzeit — would silently change
 * which zman a phone shows. Shkia is the one on its own merits: it is the
 * boundary the whole page moves around, and the only zman a person checks
 * when deciding whether they still have time to get to Mincha.
 */
const PHONE_ZMAN: Zman = 'shkia';

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
  zmanim,
  heroWarmth,
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
  /**
   * The zmanim strip, in the order the day happens. All four are rendered;
   * only `PHONE_ZMAN` is visible below the desktop breakpoint, because the
   * extra three are exactly what the extra width is for.
   */
  zmanim: readonly RibbonZman[];
  /**
   * How far the sunset warming has travelled for the hero minyan, 0..1.
   *
   * The hero card carries this too, and has to: on desktop the hero stops
   * being a card and becomes the band's own bottom strip, so the 4px accent
   * rule that warms toward shkia is painted by THIS element rather than by
   * the card inside it. Zero for anything that is not Mincha.
   */
  heroWarmth: number;
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
          <div className="ribbon-zmanim">
            {zmanim.map(({ zman, clock }) => (
              <p
                key={zman}
                className={
                  zman === PHONE_ZMAN ? 'ribbon-zman' : 'ribbon-zman ribbon-zman-wide'
                }
              >
                <span className="ribbon-zman-name">{t.zmanim[zman]}</span>
                <span className="time tabular">{clock}</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* On a phone this is the pad the hero card floats on; above the desktop
          breakpoint it IS the hero — a full-width ruled strip, the top row of
          the לוח rather than a separate object. Hence the warmth here. */}
      <div
        className="band-hero"
        style={{ '--warm-pct': warmthPercent(heroWarmth) } as React.CSSProperties}
      >
        {children}
      </div>
    </header>
  );
}

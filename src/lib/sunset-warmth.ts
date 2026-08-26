/**
 * The signature detail: as real shkia approaches, Mincha listings warm toward
 * the sunset colour.
 *
 * CLAUDE.md — "Beautiful *and* functional: the colour says your window is
 * closing." Mincha's halachic window ends at shkia, so the closer shkia is,
 * the less choice is left. The colour is the deadline, drawn.
 *
 * ---------------------------------------------------------------------------
 * NOBODY SWITCHES THIS ON
 * ---------------------------------------------------------------------------
 * There is no `sunset` prop and there never will be. The artboards carry one
 * because a static mockup cannot be 19:01; a real page simply is 19:01 when it
 * is. What makes that testable rather than untestable is this function being
 * pure — `now` and today's shkia in, a number out — so 19:01 is a unit test
 * argument, not a wait.
 *
 * ---------------------------------------------------------------------------
 * THE CURVE, AND WHY THESE TWO NUMBERS
 * ---------------------------------------------------------------------------
 * The two artboard states pin both ends of it, so the curve is fitted to them
 * rather than picked by feel:
 *
 *   PhotoDayMobile "normal"  — the hero minyan is 46 minutes away at 19:01,
 *                              so `now` is 18:15 and shkia 19:21 is 66 minutes
 *                              off. Cyan. Not warm.
 *   PhotoDayMobile "sunset"  — the same minyan is 8 minutes away, so `now` is
 *                              18:53 and shkia is 28 minutes off. Fully
 *                              terracotta.
 *
 * Warming therefore has to be invisible at ~66 minutes and complete by ~28.
 * The chosen span is:
 *
 *     starts   90 minutes before shkia
 *     complete 20 minutes before shkia
 *     eased    quadratically, so the first half of the span is barely there
 *
 *     progress = clamp((90 - minutesToShkia) / 70, 0, 1)
 *     warmth   = progress²
 *
 *          90 min out -> 0.00   nothing
 *          66 min out -> 0.12   the artboard's "normal": a hint, no more
 *          45 min out -> 0.41
 *          28 min out -> 0.79   the artboard's "sunset", near the top
 *          20 min out -> 1.00   full
 *          after shkia -> 1.00  (Mincha rows stop existing; see below)
 *
 * The ease matters. A linear ramp reads as a colour that is slowly wrong for
 * an hour; a squared one reads as nothing happening, and then a sunset. The
 * eye should notice the last twenty minutes, not the first twenty.
 *
 * 90 rather than 120: mincha ketana is roughly 3 hours before shkia in Tel
 * Aviv in summer, and a warning that starts before the *preferred* time to
 * daven Mincha even begins is not a warning, it is a background colour.
 *
 * Past shkia the value stays 1 rather than resetting. A Mincha row should not
 * be on screen at all then — the timeline drops it — but if one ever is, the
 * honest colour is "your window has closed", not "your window is wide open".
 */

/** Minutes before shkia at which warming starts. Before this, exactly 0. */
export const WARMING_STARTS_MINUTES_BEFORE_SHKIA = 90;

/** Minutes before shkia at which warming is complete. After this, exactly 1. */
export const WARMING_COMPLETE_MINUTES_BEFORE_SHKIA = 20;

const SPAN =
  WARMING_STARTS_MINUTES_BEFORE_SHKIA - WARMING_COMPLETE_MINUTES_BEFORE_SHKIA;

/**
 * How warm a Mincha listing should be right now, 0 (cyan/accent) to 1 (sunset).
 *
 * `shkia` is shkia on the day of the minyan being drawn, which is why a
 * Mincha tomorrow at 13:00 is not warm: tomorrow's shkia is twenty hours off.
 * Only the window actually closing gets the colour.
 */
export function sunsetWarmth(now: Date, shkia: Date): number {
  return warmthFromMinutes((shkia.getTime() - now.getTime()) / 60_000);
}

/** The same curve, expressed on the value the timeline already computes. */
export function warmthFromMinutes(minutesToShkia: number): number {
  if (!Number.isFinite(minutesToShkia)) return 0;
  const progress = clamp(
    (WARMING_STARTS_MINUTES_BEFORE_SHKIA - minutesToShkia) / SPAN,
    0,
    1,
  );
  return progress * progress;
}

/**
 * The warmth as a CSS percentage, for `color-mix`.
 *
 * Quantised to whole percent on purpose: the number is rendered into HTML by
 * the server, and an unrounded 0.7346938775510204 would make every response
 * byte-different from the last for no visible gain.
 */
export function warmthPercent(warmth: number): string {
  return `${Math.round(clamp(warmth, 0, 1) * 100)}%`;
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

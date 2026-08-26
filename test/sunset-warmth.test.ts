/**
 * The signature detail, tested at 19:01 without waiting until 19:01.
 *
 * This is the whole reason the warming is a pure function of `now` and today's
 * shkia rather than something the page works out from a clock it reads itself.
 * There is no `sunset` toggle to flip — CLAUDE.md is explicit that shipping
 * one would be as wrong as shipping a button that makes it evening — so the
 * only way this behaviour can be checked at all is by handing it the two
 * instants and asserting the number. Hence these tests.
 *
 * The two pinned values come from the artboards, not from the implementation:
 * PhotoDayMobile's "normal" pane is `now` 18:15 against a 19:21 shkia and must
 * read as cyan, and its "sunset" pane is 18:53 against the same shkia and must
 * read as terracotta. Any curve that fails those two fails the design.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  WARMING_COMPLETE_MINUTES_BEFORE_SHKIA,
  WARMING_STARTS_MINUTES_BEFORE_SHKIA,
  sunsetWarmth,
  warmthFromMinutes,
  warmthPercent,
} from '../src/lib/sunset-warmth.ts';

/** A wall clock on 2026-08-26 in Asia/Jerusalem (UTC+3 that day). */
function at(clock: string): Date {
  const [h = '0', m = '0'] = clock.split(':');
  return new Date(Date.UTC(2026, 7, 26, Number(h) - 3, Number(m)));
}

const SHKIA = at('19:21');

describe('the sunset warming curve', () => {
  it('is exactly zero before the span opens', () => {
    assert.equal(sunsetWarmth(at('17:51'), SHKIA), 0); // 90 minutes out
    assert.equal(sunsetWarmth(at('12:00'), SHKIA), 0);
    assert.equal(sunsetWarmth(at('06:00'), SHKIA), 0);
  });

  it('is exactly one from 20 minutes before shkia onward', () => {
    assert.equal(sunsetWarmth(at('19:01'), SHKIA), 1); // the artboard's 19:01
    assert.equal(sunsetWarmth(at('19:15'), SHKIA), 1);
    // Past shkia it stays closed rather than resetting to wide open. A Mincha
    // row should not be on screen then at all, but if one ever is, this is the
    // honest colour for it.
    assert.equal(sunsetWarmth(at('19:40'), SHKIA), 1);
  });

  it('matches the artboards at both of their pinned moments', () => {
    // PhotoDayMobile "normal": 18:15, 66 minutes to shkia. A hint, not a hue.
    const normal = sunsetWarmth(at('18:15'), SHKIA);
    assert.ok(normal > 0, `expected some warmth at 66 minutes, got ${normal}`);
    assert.ok(normal < 0.2, `expected the 66-minute state to still read cyan, got ${normal}`);

    // PhotoDayMobile "sunset": 18:53, 28 minutes to shkia. Terracotta.
    const sunset = sunsetWarmth(at('18:53'), SHKIA);
    assert.ok(sunset > 0.75, `expected the 28-minute state to read as sunset, got ${sunset}`);
  });

  it('never goes backwards as shkia approaches', () => {
    let previous = -1;
    for (let minutes = 240; minutes >= -60; minutes -= 1) {
      const warmth = warmthFromMinutes(minutes);
      assert.ok(
        warmth >= previous,
        `warmth fell from ${previous} to ${warmth} at ${minutes} minutes out`,
      );
      assert.ok(warmth >= 0 && warmth <= 1, `warmth out of range at ${minutes}: ${warmth}`);
      previous = warmth;
    }
  });

  it('eases in, so the last twenty minutes are what the eye notices', () => {
    // Half way through the span in time is much less than half way in colour.
    const midpoint =
      (WARMING_STARTS_MINUTES_BEFORE_SHKIA + WARMING_COMPLETE_MINUTES_BEFORE_SHKIA) / 2;
    const half = warmthFromMinutes(midpoint);
    assert.ok(half < 0.3, `a linear ramp would be 0.5 here; got ${half}`);
  });

  it('does not depend on the day, only on the distance to that day evening', () => {
    // Midwinter, when shkia is at 16:44 rather than 19:21.
    const winterShkia = new Date(Date.UTC(2026, 11, 10, 14, 44));
    const winterNow = new Date(winterShkia.getTime() - 28 * 60_000);
    assert.equal(warmthFromMinutes(28), sunsetWarmth(winterNow, winterShkia));
  });

  it('survives a shkia that could not be computed', () => {
    assert.equal(sunsetWarmth(new Date(0), new Date(NaN)), 0);
  });

  it('quantises to whole percent for the stylesheet', () => {
    assert.equal(warmthPercent(0), '0%');
    assert.equal(warmthPercent(1), '100%');
    assert.equal(warmthPercent(0.734693877), '73%');
    assert.equal(warmthPercent(-3), '0%');
    assert.equal(warmthPercent(42), '100%');
  });
});

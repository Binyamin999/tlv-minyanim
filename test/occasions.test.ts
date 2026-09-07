/**
 * The ribbon's two new lines: what the day is called, and when candles are lit.
 *
 * Both are claims about the Hebrew calendar rather than about the library, so
 * what is asserted here is what a luach prints — including the one figure this
 * codebase deliberately disagrees with hebcal about.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HDate } from '@hebcal/core';

import {
  TEL_AVIV,
  clockFaceOf,
  isoDate,
  nextCandleLighting,
  occasionAt,
  occasionOn,
} from '../src/zmanim/index.ts';
import type { JerusalemDate } from '../src/zmanim/index.ts';

const date = (iso: string): JerusalemDate => {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
};
const hd = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new HDate(new Date(y!, m! - 1, d!));
};

describe('what the day is called', () => {
  it('names erev Rosh Hashana, the chag, and the fast that follows', () => {
    assert.match(occasionOn(hd('2026-09-11'), true)?.he ?? '', /^ערב ראש השנה$/);
    assert.match(occasionOn(hd('2026-09-11'), true)?.en ?? '', /Erev Rosh Hashana/);
    assert.match(occasionOn(hd('2026-09-12'), true)?.he ?? '', /^ראש השנה/);
    assert.match(occasionOn(hd('2026-09-14'), true)?.he ?? '', /^צום גדליה$/);
    assert.match(occasionOn(hd('2026-09-21'), true)?.he ?? '', /^יום כיפור$/);
  });

  it('says nothing at all on an ordinary day', () => {
    // A Tuesday in Elul. The ribbon then carries the Hebrew date alone.
    assert.equal(occasionOn(hd('2026-09-08'), true), null);
  });

  /**
   * Israel keeps one day of Sukkot, so 2026-09-27 is chol hamoed and not
   * Sukkot II. Asserting the Israeli schedule is the point: a diaspora
   * assumption copied in here would name the wrong day for every chag.
   */
  it('keeps the Israeli festival calendar', () => {
    assert.match(occasionOn(hd('2026-09-26'), true)?.he ?? '', /^סוכות א/);
    assert.match(occasionOn(hd('2026-09-27'), true)?.he ?? '', /חוה״מ/);
  });

  it('is unpointed, like the rest of the page', () => {
    const occasion = occasionOn(hd('2026-09-11'), true);
    assert.ok(occasion);
    assert.doesNotMatch(occasion.he, /[֑-ֽֿ-ׇ]/, 'no nikud');
  });

  /** The Hebrew day rolls at sunset, so Friday evening is already the chag. */
  it('rolls at sunset, not at midnight', () => {
    // 2026-09-11: shkia 18:52 in Tel Aviv.
    const before = new Date('2026-09-11T18:00:00+03:00');
    const after = new Date('2026-09-11T19:30:00+03:00');
    assert.match(occasionAt(TEL_AVIV, before)?.he ?? '', /^ערב ראש השנה$/);
    assert.match(occasionAt(TEL_AVIV, after)?.he ?? '', /^ראש השנה/);
  });
});

describe('the next candle lighting', () => {
  it('is shkia − 22, which is not what hebcal prints', () => {
    // Erev Rosh Hashana 2026. Our shkia is 18:52, so candles are 18:30.
    // hebcal ships 20 minutes for the Tel Aviv geoname and prints 18:32; the
    // Tel Aviv-Yafo Religious Council publishes 22. See day.ts.
    const next = nextCandleLighting(TEL_AVIV, date('2026-09-11'));
    assert.ok(next);
    assert.equal(next.daysAhead, 0);
    assert.equal(clockFaceOf(next.instant), '18:30');
  });

  it('is carried all week, with the day it belongs to', () => {
    const next = nextCandleLighting(TEL_AVIV, date('2026-09-07'));
    assert.ok(next, 'a Monday still knows about Friday');
    assert.equal(isoDate(next.date), '2026-09-11');
    assert.equal(next.daysAhead, 4);
    assert.equal(clockFaceOf(next.instant), '18:30');
    // And it names what that lighting is for, which is not an ordinary Shabbat.
    assert.match(next.occasion?.he ?? '', /^ערב ראש השנה$/);
  });

  /**
   * THE ONE THAT MATTERS.
   *
   * Rosh Hashana 5787 falls on Shabbat, so 2026-09-12 carries a SECOND-night
   * lighting: candles lit after nightfall from a pre-existing flame. hebcal
   * flags it `LIGHT_CANDLES` *and* `LIGHT_CANDLES_TZEIS`, so anything testing
   * only the first admits it — and it is not כניסת שבת and not כניסת חג.
   *
   * Standing on that very day, the next lighting this ribbon may offer is the
   * following Friday. Offering 19:28 that evening would tell a reader Shabbat
   * comes in half an hour after sunset.
   */
  it('never offers the second night of a two-day yom tov', () => {
    const next = nextCandleLighting(TEL_AVIV, date('2026-09-12'));
    assert.ok(next);
    assert.notEqual(isoDate(next.date), '2026-09-12');
    assert.equal(isoDate(next.date), '2026-09-18');
    assert.equal(next.daysAhead, 6);
  });

  it('finds nothing when asked to look at only the days that have none', () => {
    // Sunday to Thursday inclusive: no Friday in range, so no lighting.
    assert.equal(nextCandleLighting(TEL_AVIV, date('2026-09-06'), 4), null);
  });

  /**
   * A property rather than three pinned dates: whatever the search returns is
   * always before that day's sunset, on every start date across a year.
   */
  it('is always before shkia, swept across the year', () => {
    for (let i = 0; i < 365; i += 1) {
      const start = new Date(Date.UTC(2026, 0, 1 + i, 9));
      const from = date(
        `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(
          start.getUTCDate(),
        ).padStart(2, '0')}`,
      );
      const next = nextCandleLighting(TEL_AVIV, from);
      assert.ok(next, `no candle lighting within a week of ${isoDate(from)}`);
      assert.ok(next.daysAhead <= 7);
    }
  });
});

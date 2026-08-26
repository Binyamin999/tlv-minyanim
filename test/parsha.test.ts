/**
 * The header ribbon's parsha line.
 *
 * One assertion here is a design decision rather than a calendar fact, and it
 * is the reason this file exists: on a week whose Shabbat is a chag, hebcal
 * answers `{ parsha: ['Sukkot'], chag: true }`, and rendering that as
 * `פרשת סוכות` would state something no luach states — the reading that
 * Shabbat is the festival reading, not a weekly sedra. We print nothing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HDate } from '@hebcal/core';

import { TEL_AVIV, parshaAt, parshaOn } from '../src/zmanim/index.ts';

describe('the parsha of the week', () => {
  it('names the sedra on an ordinary week', () => {
    const parsha = parshaOn(new HDate(new Date(2026, 7, 19)), true);
    assert.ok(parsha, 'expected a parsha on an ordinary Wednesday in Elul');
    assert.match(parsha.en, /Ki Teitzei/);
    assert.match(parsha.he, /תֵצֵא/);
  });

  it('names nothing when that Shabbat is a chag', () => {
    // Rosh Hashana 5787 falls on Shabbat; Sukkot 5787 likewise.
    assert.equal(parshaOn(new HDate(new Date(2026, 8, 12)), true), null);
    assert.equal(parshaOn(new HDate(new Date(2026, 8, 26)), true), null);
  });

  it('rolls at sunset, not at midnight', () => {
    // Friday 2026-08-28 in Tel Aviv: shkia is 19:09, so 19:30 is already
    // Shabbat and already the following week's Hebrew date.
    const beforeShkia = new Date(Date.UTC(2026, 7, 28, 15, 0)); // 18:00 local
    const afterShkia = new Date(Date.UTC(2026, 7, 28, 16, 30)); // 19:30 local
    const before = parshaAt(TEL_AVIV, beforeShkia);
    const after = parshaAt(TEL_AVIV, afterShkia);
    assert.ok(before && after);
    // Same sedra either side of this particular sunset — Friday and Shabbat
    // belong to one week — but the Hebrew DATE has moved, which is what the
    // sunset-aware call is for. Assert the pair rather than an inequality.
    assert.equal(before.en, after.en);
    assert.match(after.en, /Ki Tavo/);
  });
});

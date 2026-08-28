/**
 * The hand-verified times, and the reasoning that let each one be stored.
 *
 * These are not tests that a constant equals itself. Each verified entry rests
 * on a claim — "this clock face is safe year-round", "this offset is the rule
 * and not one week's printing" — and a claim can be wrong. What is checked here
 * is the claim.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VERIFIED, verifiedFor } from '../src/lib/verified-times.ts';
import { TEL_AVIV, addDays, isoDate, resolveOnDate, zmanimFor } from '../src/zmanim/index.ts';
import type { JerusalemDate } from '../src/zmanim/index.ts';

const date = (iso: string): JerusalemDate => {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
};

describe('every verified time is structurally legal', () => {
  for (const [nameHe, record] of Object.entries(VERIFIED)) {
    it(`${nameHe}: shapes match the invariant`, () => {
      for (const entry of record.minyanim) {
        const t = entry.time;
        if (t.kind === 'fixed') {
          assert.match(t.time, /^\d{2}:\d{2}$/, 'fixed times are HH:MM');
        } else if (t.kind === 'relative') {
          assert.ok(Number.isInteger(t.offsetMinutes));
          assert.ok(Math.abs(t.offsetMinutes) <= 180, 'an offset over three hours is a typo');
        } else {
          assert.fail('a verified entry should never be unknown — do not store a blank');
        }
      }
    });

    it(`${nameHe}: has a date and a source together`, () => {
      // "Never claim a listing is verified without a source and a date."
      assert.match(record.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(record.verifiedBy.length > 0);
    });

    it(`${nameHe}: records what it held back`, () => {
      // A sign carries more than we can store. An empty `held` on a real
      // record almost always means someone forgot to write down what they
      // decided not to keep.
      for (const held of record.held) {
        assert.ok(held.what.length > 0 && held.why.length > 0);
      }
    });
  }
});

describe('לכלל ישראל — the claims each stored time rests on', () => {
  const record = verifiedFor('לכלל ישראל');

  it('exists', () => assert.ok(record));

  it('the weekday Mincha clock face is possible on every day of the year', () => {
    // 14:00 is stored as `fixed`, which is only honest if it lands after
    // mincha gedola and before shkia on EVERY date — otherwise it is a summer
    // time masquerading as a rule. This is exactly the check that rules out
    // storing the 18:55 Mincha, which is shkia + 135 in December.
    const mincha = record!.minyanim.find(
      (m) => m.service === 'mincha' && m.dayType === 'weekday',
    );
    assert.ok(mincha && mincha.time.kind === 'fixed');
    const [h, min] = (mincha.time as { time: string }).time.split(':').map(Number);
    const asMinutes = h! * 60 + min!;

    const start = date('2026-01-01');
    for (let i = 0; i < 365; i++) {
      const day = addDays(start, i);
      const z = zmanimFor(TEL_AVIV, day);
      const clock = (d: Date) => {
        const s = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Jerusalem',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d);
        const [hh, mm] = s.split(':').map(Number);
        return hh! * 60 + mm!;
      };
      assert.ok(
        asMinutes > clock(z.mincha_gedola),
        `${isoDate(day)}: 14:00 is before mincha gedola`,
      );
      assert.ok(asMinutes < clock(z.shkia), `${isoDate(day)}: 14:00 is after shkia`);
    }
  });

  it('the held 18:55 Mincha would NOT survive that check — which is why it is held', () => {
    // The negative case. If this ever passes, the reason for holding it back
    // has evaporated and the entry should be revisited.
    const winter = zmanimFor(TEL_AVIV, date('2026-12-21'));
    const shkiaMinutes = (() => {
      const s = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
      }).format(winter.shkia);
      const [hh, mm] = s.split(':').map(Number);
      return hh! * 60 + mm!;
    })();
    assert.ok(18 * 60 + 55 > shkiaMinutes, '18:55 should be after the December shkia');
    assert.ok(
      record!.held.some((h) => h.what.includes('18:55')),
      'and it should be recorded as held',
    );
  });

  it('the erev-Shabbat Mincha is stored on FRIDAY, not on Shabbat', () => {
    // The distinction this shul forced into the schema. The sheet separates
    // ליל שבת from יום השבת, so the day is stated rather than guessed from the
    // anchor — which is what previously put this minyan a day late.
    const mincha = record!.minyanim.find((m) => m.service === 'mincha' && m.dayType !== 'weekday');
    assert.ok(mincha, 'there is a Shabbat-period Mincha');
    assert.equal(mincha.dayType, 'erev_shabbat');
  });

  it('the erev-Shabbat Mincha rule resolves to the printed 18:50', () => {
    // shkia − 20 against a candle lighting of shkia − 22 means Mincha starts
    // two minutes AFTER candles, which is the normal erev Shabbat order and
    // the thing the GIS reading got wrong in the other direction.
    const friday = date('2026-08-28');
    const z = zmanimFor(TEL_AVIV, friday);
    const mincha = record!.minyanim.find(
      (m) => m.service === 'mincha' && m.dayType === 'erev_shabbat',
    );
    assert.ok(mincha && mincha.time.kind === 'relative');
    const { resolved } = resolveOnDate(mincha.time, friday, TEL_AVIV);
    assert.equal(resolved.kind, 'resolved');
    if (resolved.kind !== 'resolved') return;

    assert.ok(z.candle_lighting, 'that Friday has candle lighting');
    assert.ok(resolved.instant < z.shkia, 'Mincha is before shkia');
    // And it is the printed 18:50, not the GIS layer's 18:38.
    const hhmm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
    }).format(resolved.instant);
    assert.equal(hhmm, '18:50', 'matches the printed sheet');
  });

  it('reproduces the two numbers the printed sheet independently confirmed', () => {
    // The sheet for שבת פרשת כי־תבוא prints כניסת השבת 18:48 and צאת השבת
    // 19:47. Those are the shul's own numbers, arrived at without us, and they
    // are the strongest evidence we have that shkia − 22 and 8.5° are right.
    const z = zmanimFor(TEL_AVIV, date('2026-08-28'));
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    assert.ok(z.candle_lighting);
    assert.equal(fmt(z.candle_lighting), '18:48', 'כניסת השבת on the sheet');
    assert.equal(fmt(z.tzeit), '19:47', 'צאת השבת on the sheet');
  });
});

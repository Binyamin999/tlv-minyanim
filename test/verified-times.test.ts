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

  /**
   * The rule that replaced "hold anything not valid year-round".
   *
   * A stored clock face makes a claim, and the claim has a scope. Either it
   * holds every day — in which case it needs no window — or it does not, in
   * which case it MUST carry one. What is forbidden is the middle: an
   * unwindowed 18:45 Mincha is shkia + 65 in December and would be shown, with
   * confidence, all winter.
   */
  const clockMinutes = (d: Date) => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(d)
      .split(':')
      .map(Number);
    return h! * 60 + m!;
  };

  const holdsAllYear = (hhmm: string, service: string): boolean => {
    const [h, m] = hhmm.split(':').map(Number);
    const at = h! * 60 + m!;
    const start = date('2026-01-01');
    for (let i = 0; i < 365; i++) {
      const z = zmanimFor(TEL_AVIV, addDays(start, i));
      if (service === 'mincha' && !(at > clockMinutes(z.mincha_gedola) && at < clockMinutes(z.shkia))) {
        return false;
      }
      if (service === 'arvit' && !(at > clockMinutes(z.shkia))) return false;
    }
    return true;
  };

  it('every unwindowed clock face holds on all 365 days', () => {
    for (const entry of record!.minyanim) {
      if (entry.time.kind !== 'fixed') continue;
      if (entry.validUntil) continue; // windowed: it claims only its own week
      if (entry.service === 'shacharit') continue; // morning does not track shkia
      assert.ok(
        holdsAllYear(entry.time.time, entry.service),
        `${entry.service} ${entry.time.time} has no validity window, so it claims ` +
          'to hold all year — and it does not. Give it a window or hold it back.',
      );
    }
  });

  it('every clock face that does NOT hold all year carries a window', () => {
    // The negative half, and the one that catches the real mistake. 18:45 is
    // shkia − 22 this week and shkia + 65 in December.
    for (const entry of record!.minyanim) {
      if (entry.time.kind !== 'fixed' || entry.service === 'shacharit') continue;
      if (holdsAllYear(entry.time.time, entry.service)) continue;
      assert.ok(
        entry.validFrom && entry.validUntil,
        `${entry.service} ${entry.time.time} cannot hold all year and has no window`,
      );
    }
  });

  it('a rule never carries a window — sunset moves and it moves with it', () => {
    for (const entry of record!.minyanim) {
      if (entry.time.kind !== 'relative') continue;
      assert.equal(
        entry.validUntil,
        undefined,
        `${entry.service} is anchored to ${entry.time.anchor} and needs no expiry`,
      );
    }
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

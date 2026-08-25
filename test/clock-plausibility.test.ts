/**
 * A stated clock time must be read for the service it belongs to.
 *
 * `מנחה 1:30` means half past one in the afternoon. Mincha at 01:30 does not
 * exist, so the literal reading is not a conservative choice — it is a wrong
 * answer delivered with a clean record and no warning, which is the one way
 * this module can be confidently wrong.
 *
 * This is NOT the invented-offset problem that `invariants.test.ts` guards.
 * There the source states no time at all and supplying one is fabrication.
 * Here the time IS stated and only the clock convention is in question, and
 * for a given service exactly one convention is possible. Where BOTH readings
 * are impossible we still refuse to choose — the record is flagged, not fixed.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPublishable, parseMinyanTimes } from '../src/minyan-times/index.ts';

/** The single minyan a one-time field produces. */
function only(raw: string) {
  const { minyanim } = parseMinyanTimes(raw);
  assert.equal(minyanim.length, 1, `expected exactly one minyan from "${raw}"`);
  return minyanim[0]!;
}

function fixedTime(raw: string): string {
  const t = only(raw).time;
  assert.equal(t.kind, 'fixed');
  return t.kind === 'fixed' ? t.time : '';
}

describe('a 12-hour clock face is resolved when only one reading is possible', () => {
  it('מנחה-1:30 is 13:30 — Mincha at 01:30 does not exist', () => {
    assert.equal(fixedTime('מנחה-1:30'), '13:30');
  });

  it('records the shift rather than performing it silently', () => {
    const m = only('מנחה-1:30');
    assert.deepEqual(m.clockNormalisation, {
      from: '01:30',
      to: '13:30',
      basis: 'only_possible_reading_for_service',
    });
  });

  it('keeps the raw field verbatim so the claim stays checkable', () => {
    assert.equal(only('מנחה-1:30').rawField, 'מנחה-1:30');
  });

  it('a resolved time is publishable — it is read, not guessed', () => {
    assert.equal(isPublishable(only('מנחה-1:30')), true);
  });

  for (const [raw, expected] of [
    ['מנחה-2:00', '14:00'],
    ['מנחה-7:30', '19:30'],
    ['ערבית-8:00', '20:00'],
    ['ערבית-5:15', '17:15'],
  ] as const) {
    it(`${raw} -> ${expected}`, () => assert.equal(fixedTime(raw), expected));
  }
});

describe('a plausible time is never shifted', () => {
  // The failure this guards against is over-eagerness: a rule that "fixes"
  // 12:30 into 00:30, or shunts every morning Shacharit into the evening.
  for (const [raw, expected] of [
    ['מנחה-13:30', '13:30'],
    ['מנחה-12:30', '12:30'], // mincha gedola, the earliest legitimate Mincha
    ['מנחה-19:45', '19:45'], // midsummer, just before shkia
    ['שחרית-6:30', '06:30'],
    ['שחרית-10:00', '10:00'], // Shabbat
    ['שחרית-5:00', '05:00'], // vatikin in midsummer
    ['ערבית-20:00', '20:00'],
    ['ערבית-22:30', '22:30'],
  ] as const) {
    it(`${raw} stays ${expected}`, () => {
      assert.equal(fixedTime(raw), expected);
      assert.equal(only(raw).clockNormalisation, undefined);
    });
  }
});

describe('when no reading works we flag, we do not choose', () => {
  for (const raw of [
    'שחרית-22:00', // 22:00 impossible; 10:00 would need subtracting, not adding
    'מנחה-11:00', //  before chatzot as written, 23:00 if shifted
    'שחרית-0:15', //  midnight Shacharit; 12:15 is past chatzot
    'ערבית-14:00', // early afternoon Arvit; 02:00 is worse
  ]) {
    it(`${raw} is flagged implausible and held back`, () => {
      const m = only(raw);
      assert.ok(
        m.needsReview.some((r) => r.code === 'implausible_for_service'),
        `${raw} should be flagged implausible_for_service`,
      );
      assert.equal(isPublishable(m), false);
    });
  }

  it('keeps the stated time rather than dropping or altering it', () => {
    const m = only('שחרית-22:00');
    assert.deepEqual(m.time, { kind: 'fixed', time: '22:00' });
    assert.equal(m.clockNormalisation, undefined);
  });

  it('says what it expected, so the reviewer need not read this file', () => {
    const reason = only('מנחה-11:00').needsReview.find(
      (r) => r.code === 'implausible_for_service',
    );
    assert.ok(reason && /12:00/.test(reason.detail) && /20:00/.test(reason.detail));
  });
});

describe('the guard does not overreach', () => {
  it('leaves an unlabelled time alone — no service means no window', () => {
    // The bare 21:00 in the חב"ד row. Already held back by unattributed_service;
    // testing it against a window would mean picking the service first.
    const { minyanim } = parseMinyanTimes('מנחה-14:05-15:15-בזמן, 1:30');
    const bare = minyanim.at(-1)!;
    assert.equal(bare.service, null);
    assert.deepEqual(bare.time, { kind: 'fixed', time: '01:30' });
    assert.equal(bare.clockNormalisation, undefined);
    assert.equal(isPublishable(bare), false); // unattributed, not implausible
  });

  it('never touches a relative time — there is no clock face to misread', () => {
    const m = only("מנחה 20 דק' לפי שקיעה");
    assert.deepEqual(m.time, { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 });
    assert.equal(m.clockNormalisation, undefined);
  });

  it('never resolves בזמן into a clock time', () => {
    const m = only('מנחה-בזמן');
    assert.deepEqual(m.time, { kind: 'unknown', rawText: 'בזמן' });
    assert.equal(m.clockNormalisation, undefined);
  });

  it('applies per service, not globally: 8:00 is a fine Shacharit', () => {
    assert.equal(fixedTime('שחרית-8:00'), '08:00');
    assert.equal(fixedTime('ערבית-8:00'), '20:00');
  });
});

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

import { SHARED_BOARD, VERIFIED, verifiedFor } from '../src/lib/verified-times.ts';
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
    // Across EVERY verified record, not just the one this sweep was written
    // for. Scoped to כלל ישראל it silently stopped guarding as soon as a
    // second shul was added — and the next two brought fourteen clock faces,
    // five of which do not hold all year.
    for (const [name, r] of Object.entries(VERIFIED))
    for (const entry of r.minyanim) {
      if (entry.time.kind !== 'fixed') continue;
      if (entry.validUntil) continue; // windowed: it claims only its own week
      if (entry.service === 'shacharit') continue; // morning does not track shkia
      assert.ok(
        holdsAllYear(entry.time.time, entry.service),
        `${name}: ${entry.service} ${entry.time.time} has no validity window, so it ` +
          'claims to hold all year — and it does not. Give it a window or hold it back.',
      );
    }
  });

  it('every clock face that does NOT hold all year carries a window', () => {
    // The negative half, and the one that catches the real mistake. 18:45 is
    // shkia − 22 this week and shkia + 65 in December.
    for (const [name, r] of Object.entries(VERIFIED))
    for (const entry of r.minyanim) {
      if (entry.time.kind !== 'fixed' || entry.service === 'shacharit') continue;
      if (holdsAllYear(entry.time.time, entry.service)) continue;
      assert.ok(
        entry.validFrom && entry.validUntil,
        `${name}: ${entry.service} ${entry.time.time} cannot hold all year and has no window`,
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

/**
 * "There are none" is not "we do not know".
 *
 * `noMinyanimOn` is the only way this codebase can assert an absence, and an
 * assertion is worth exactly as much as the check that it is not contradicted
 * elsewhere in the same record. A shul that says it holds nothing on Shabbat
 * and also carries a Shabbat minyan is not a display bug — it is two claims,
 * one of which is false, and the page would print whichever it reached first.
 */
describe('stated absence', () => {
  it('never contradicts a minyan in the same record', () => {
    for (const [name, record] of Object.entries(VERIFIED)) {
      for (const day of record.noMinyanimOn) {
        const clash = record.minyanim.filter((m) => m.dayType === day);
        assert.deepEqual(
          clash.map((m) => `${m.service} ${JSON.stringify(m.time)}`),
          [],
          `${name} states no minyanim on ${day} yet lists ${clash.length}`,
        );
      }
    }
  });

  it('is stated, never inferred from having no rows', () => {
    // היכל חיים has no Shabbat rows at all — its GIS Shabbat times were
    // dropped as untrustworthy — and that must NOT read as "no Shabbat
    // services". It is the plain unknown, and somebody still has to go and
    // photograph the Shabbat sheet.
    const heichal = VERIFIED['היכל חיים'];
    assert.ok(heichal, 'היכל חיים is in the verified file');
    assert.equal(
      heichal.minyanim.some((m) => m.dayType === 'shabbat'),
      false,
      'no Shabbat rows',
    );
    assert.deepEqual(heichal.noMinyanimOn, [], 'yet nothing is claimed about Shabbat');
  });

  it('records the mall shul as closed on both Shabbat days', () => {
    // The mall closes, so erev Shabbat AND Shabbat are both empty. Listing one
    // and not the other would leave Friday night reading as unknown.
    const chabad = VERIFIED['בית חב"ד קניון רמת אביב'];
    assert.ok(chabad);
    assert.deepEqual([...chabad.noMinyanimOn].sort(), ['erev_shabbat', 'shabbat']);
  });
});

/**
 * The tzeit ambiguity closing the way it was designed to.
 *
 * The board said צאת הכוכבים, which names two times twenty-five minutes apart;
 * the guard held the minyan back rather than pick one, and the shul supplied
 * the rule. Asserting `shkia + 20` here is asserting that the answer came from
 * the shul and not from the luach — resolving it against 8.5° would put this
 * minyan around shkia + 39.
 */
describe('the mall shul Arvit', () => {
  it('is a shkia rule, not a tzeit one', () => {
    const chabad = VERIFIED['בית חב"ד קניון רמת אביב'];
    assert.ok(chabad);
    const arvit = chabad.minyanim.find((m) => m.service === 'arvit');
    assert.ok(arvit, 'Arvit is no longer held');
    assert.deepEqual(arvit.time, { kind: 'relative', anchor: 'shkia', offsetMinutes: 20 });
  });

  it('carries no validity window, because a rule does not expire', () => {
    const arvit = VERIFIED['בית חב"ד קניון רמת אביב']!.minyanim.find((m) => m.service === 'arvit')!;
    assert.equal(arvit.validFrom, undefined);
    assert.equal(arvit.validUntil, undefined);
  });
});

/**
 * One board, two synagogues.
 *
 * What is checked here is that sharing is by REFERENCE. A copy would agree on
 * the day it was made and drift the moment כלל ישראל's weekly board is read
 * again — and a stale copy still carries its own `last_verified_at`, so it
 * would go on looking freshly checked while being wrong.
 */
describe('a shared notice board', () => {
  it('gives the sharing shul the very same record, not an equal one', () => {
    const host = verifiedFor('לכלל ישראל');
    const sharer = verifiedFor("המרכזי רמת אביב ג'");
    assert.ok(host);
    // Identity, not deepEqual: deepEqual would pass for a copy, which is the
    // thing this is here to forbid.
    assert.equal(sharer, host);
  });

  it('names a synagogue that actually has a record', () => {
    for (const [from, to] of Object.entries(SHARED_BOARD)) {
      assert.ok(VERIFIED[to], `${from} shares the board of ${to}, which has no record`);
    }
  });

  it('never chains, so one hop always lands', () => {
    // A pointer to another pointer would resolve to null under the one-hop
    // rule and silently drop a shul's times.
    for (const [from, to] of Object.entries(SHARED_BOARD)) {
      assert.equal(SHARED_BOARD[to], undefined, `${from} -> ${to} -> … is a chain`);
    }
  });

  it('does not also carry a record of its own', () => {
    // Both would be a second source of truth, and verifiedFor would silently
    // prefer the shared one while the local one sat there looking authoritative.
    for (const from of Object.keys(SHARED_BOARD)) {
      assert.equal(VERIFIED[from], undefined, `${from} both shares a board and has one`);
    }
  });
});

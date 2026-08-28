/**
 * The invariants. These tests are the contract, not a convenience.
 *
 * If one of these fails, the fix is never to relax the test. CLAUDE.md:
 * "A hallucinated Mincha time is far worse than a blank — blank is honest,
 * wrong destroys trust permanently."
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPublishable, parseMinyanTimes } from '../src/minyan-times/index.ts';
import { ALL_RAW_STRINGS } from './fixtures.seed-ramat-aviv.ts';

describe('בזמן is unknown, always', () => {
  const withBizman = ALL_RAW_STRINGS.filter((r) => r.raw.includes('בזמן'));

  it('appears in the sample at all (otherwise this suite proves nothing)', () => {
    assert.ok(withBizman.length >= 10, `only ${withBizman.length} rows contain בזמן`);
  });

  for (const { nameHe, raw } of withBizman) {
    it(`${nameHe}: בזמן stays unknown — ${raw}`, () => {
      const result = parseMinyanTimes(raw);
      const unknowns = result.minyanim.filter((m) => m.time.kind === 'unknown');
      assert.ok(unknowns.length > 0, 'בזמן must produce at least one unknown');
      for (const m of unknowns) {
        assert.equal(m.time.kind, 'unknown');
        // The raw text is preserved verbatim. It is the only evidence we have.
        assert.ok(m.time.kind === 'unknown' && m.time.rawText.length > 0);
        assert.ok(raw.includes(m.time.kind === 'unknown' ? m.time.rawText : ''));
      }
    });
  }

  it('never resolves בזמן to an offset, however tempting the neighbours are', () => {
    // Two shuls, same field shape. One states shkia-20. The other says בזמן.
    // The second must NOT inherit the first — not by averaging, not by
    // "the shul down the road does this", not by a plausible default.
    const stated = parseMinyanTimes("מנחה 20 דק' לפי שקיעה");
    const unstated = parseMinyanTimes('מנחה-בזמן');

    assert.deepEqual(stated.minyanim[0]?.time, {
      kind: 'relative',
      anchor: 'shkia',
      offsetMinutes: -20,
    });
    assert.deepEqual(unstated.minyanim[0]?.time, { kind: 'unknown', rawText: 'בזמן' });
  });

  it('an anchor with no number is unknown, not offset zero', () => {
    // `לפני השקיעה` says "before sunset" and gives no number. Reading the
    // missing number as 0 would be an invented offset.
    const result = parseMinyanTimes('מנחה לפני השקיעה');
    assert.equal(result.minyanim[0]?.time.kind, 'unknown');
  });
});

describe('nothing is silently lost', () => {
  it('unparseable text surfaces as an issue naming the exact fragment', () => {
    const result = parseMinyanTimes('מנחה-כשעה לפני');
    assert.deepEqual(
      result.issues.map((i) => i.fragment),
      ['כשעה', 'לפני'],
    );
  });

  it('an unknown word does not swallow the time next to it', () => {
    const result = parseMinyanTimes('מנחה וערבית-18:00');
    assert.equal(result.minyanim.length, 1);
    assert.deepEqual(result.minyanim[0]?.time, { kind: 'fixed', time: '18:00' });
    assert.deepEqual(
      result.issues.map((i) => i.fragment),
      ['וערבית'],
    );
    // Kept, but not publishable: we do not know it is only Mincha.
    assert.equal(isPublishable(result.minyanim[0]!), false);
  });

  it('an impossible clock time fails rather than being coerced', () => {
    const result = parseMinyanTimes('שחרית-25:70');
    assert.equal(result.minyanim.length, 0);
    assert.equal(result.issues[0]?.code, 'invalid_time');
  });

  it('a field with content but nothing recognised reports it', () => {
    const result = parseMinyanTimes('לפרטים נא לפנות');
    assert.equal(result.minyanim.length, 0);
    assert.ok(result.issues.length > 0);
  });

  it('an empty field is an issue, not an empty success', () => {
    assert.equal(parseMinyanTimes('').issues[0]?.code, 'empty_field');
    assert.equal(parseMinyanTimes('  ,  ').issues[0]?.code, 'empty_field');
  });
});

describe('nothing is attributed that the source did not say', () => {
  it('a bare time gets no service and cannot be published', () => {
    const result = parseMinyanTimes('מנחה-14:05-15:15-בזמן, 21:00');
    const bare = result.minyanim.at(-1)!;
    assert.equal(bare.service, null);
    assert.deepEqual(bare.time, { kind: 'fixed', time: '21:00' });
    assert.equal(isPublishable(bare), false);
    assert.equal(bare.needsReview[0]?.code, 'unattributed_service');
  });

  it('a service label never carries across a comma', () => {
    // If it did, `ח 12:30 ק 13:30` would become Shacharit at 12:30.
    const result = parseMinyanTimes('שחרית-נץ-7:45, ח 12:30 ק 13:30-בזמן');
    assert.deepEqual(
      result.minyanim.map((m) => m.service),
      ['shacharit', 'shacharit', null, null, null],
    );
  });

  it('dayType comes from the caller and is never read out of the text', () => {
    const raw = "מנחה - 10 דק' לפי כניסת שבת";
    assert.equal(parseMinyanTimes(raw).minyanim[0]?.dayType, null);
    assert.equal(
      parseMinyanTimes(raw, { dayType: 'shabbat' }).minyanim[0]?.dayType,
      'shabbat',
    );
  });

  it('a daf yomi time never becomes a shacharit', () => {
    const result = parseMinyanTimes('שיעור דף יומי, בימים א-ה בשעה 7:00');
    assert.equal(result.minyanim.length, 0);
    assert.equal(result.shiurim.length, 2);
    assert.deepEqual(result.shiurim[1]?.times, [{ kind: 'fixed', time: '07:00' }]);
  });
});

describe('the module computes nothing', () => {
  it('a relative time is a rule, not a clock time', () => {
    const result = parseMinyanTimes("מנחה 20 דק' לפי שקיעה");
    const time = result.minyanim[0]!.time;
    assert.equal(time.kind, 'relative');
    // No Date, no timezone, no sunset table. A zmanim library applies this.
    assert.deepEqual(Object.keys(time).sort(), ['anchor', 'kind', 'offsetMinutes']);
  });
});

describe('tzeit names two different times, so a tzeit minyan is never published', () => {
  // On a luach יציאת שבת is the stringent 8.5° value — about shkia + 39 in Tel
  // Aviv — and that is what this codebase resolves `tzeit` to, matching the
  // Rabbanut. A shul writing צאת הכוכבים on its Arvit line means the nightfall
  // it actually davens at: shkia + 13.5 to 25, depending on the community.
  //
  // Resolving the shul's word against the luach's definition lists that minyan
  // up to twenty-six minutes LATE. Someone walks over and the room is empty,
  // which is the precise failure this project exists to prevent — and unlike a
  // blank, it looks confident. So we keep the anchor and hold the record back.
  const tzeitLines = [
    'ערבית - צאת הכוכבים',
    'ערבית-צאת',
    'מעריב - צאת הכוכבים',
    "ערבית 20 דק' אחרי צאת הכוכבים",
    'ערבית - צאת השבת',
  ];

  for (const raw of tzeitLines) {
    it(`${raw} is kept but held back`, () => {
      const [minyan] = parseMinyanTimes(raw, { dayType: 'weekday' }).minyanim;
      assert.ok(minyan, 'should still parse — we keep the anchor');
      assert.equal(minyan.time.kind, 'relative');
      assert.equal(minyan.time.kind === 'relative' && minyan.time.anchor, 'tzeit');
      assert.ok(
        minyan.needsReview.some((r) => r.code === 'ambiguous_tzeit'),
        'must carry ambiguous_tzeit',
      );
      assert.equal(isPublishable(minyan), false);
    });
  }

  it('an explicit offset from tzeit is still ambiguous — it does not say WHICH tzeit', () => {
    // The tempting mistake is to treat a stated number as resolving the
    // question. It does not: 20 minutes after which nightfall?
    const [minyan] = parseMinyanTimes("ערבית 20 דק' אחרי צאת הכוכבים").minyanim;
    assert.deepEqual(minyan!.time, { kind: 'relative', anchor: 'tzeit', offsetMinutes: 20 });
    assert.equal(isPublishable(minyan!), false);
  });

  it('shkia is unaffected — that anchor means exactly one thing', () => {
    const [minyan] = parseMinyanTimes("ערבית 20 דק' אחרי השקיעה").minyanim;
    assert.deepEqual(minyan!.time, { kind: 'relative', anchor: 'shkia', offsetMinutes: 20 });
    assert.equal(isPublishable(minyan!), true);
  });

  it('netz is unaffected too, so this did not become a blanket anchor ban', () => {
    const [minyan] = parseMinyanTimes('שחרית-נץ').minyanim;
    assert.deepEqual(minyan!.time, { kind: 'relative', anchor: 'netz', offsetMinutes: 0 });
    assert.equal(isPublishable(minyan!), true);
  });

  it('a בזמן Arvit stays unknown and is NOT reclassified as tzeit', () => {
    // CLAUDE.md: "Never map a bare בזמן on an Arvit line onto any tzeit value."
    // The fix above must not tempt anyone into treating בזמן as "probably
    // tzeit, flagged" — that would be inventing an anchor to go with the flag.
    const [minyan] = parseMinyanTimes('ערבית-בזמן').minyanim;
    assert.deepEqual(minyan!.time, { kind: 'unknown', rawText: 'בזמן' });
    assert.ok(!minyan!.needsReview.some((r) => r.code === 'ambiguous_tzeit'));
  });
});

/**
 * The shapes table from CLAUDE.md, verbatim, plus shapes we expect from the
 * other 468 synagogues.
 *
 * Ramat Aviv is 16 shuls and the tidiest corner of the GIS layer. Everything in
 * the "beyond the sample" block below is a shape this parser will meet and has
 * not yet been verified against real rows — it is here so that a future change
 * cannot quietly break it, and so that the loud-failure behaviour is pinned.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMinyanTimes } from '../src/minyan-times/index.ts';
import { sigs } from './helpers.ts';

describe('CLAUDE.md — real data shapes the parser must handle', () => {
  const cases: Array<[string, string[]]> = [
    ["מנחה 20 דק' לפי שקיעה", ['mincha shkia-20']],
    ["מנחה - 10 דק' לפי כניסת שבת", ['mincha candle_lighting-10']],
    ['מנחה-בזמן', ['mincha ?בזמן']],
    ['שחרית-נץ-7:00', ['shacharit netz+0', 'shacharit 07:00']],
    ['שחרית-6:30-7:30-9:00-10:00', [
      'shacharit 06:30',
      'shacharit 07:30',
      'shacharit 09:00',
      'shacharit 10:00',
    ]],
    ['מנחה-13:30-13:55-בזמן', ['mincha 13:30', 'mincha 13:55', 'mincha ?בזמן']],
    ['שחרית-7.30-8.30', ['shacharit 07:30', 'shacharit 08:30']],
  ];

  for (const [raw, expected] of cases) {
    it(raw, () => {
      const result = parseMinyanTimes(raw);
      assert.deepEqual(sigs(result), expected);
      assert.deepEqual(result.issues, []);
    });
  }

  it("ח 12:30 ק 13:30 — winter/summer, and no service is invented", () => {
    const result = parseMinyanTimes('ח 12:30 ק 13:30');
    assert.deepEqual(sigs(result), ['· 12:30 [winter] !', '· 13:30 [summer] !']);
  });

  it('פתוח בחגים בלבד — a status, not a time', () => {
    const result = parseMinyanTimes('פתוח בחגים בלבד');
    assert.deepEqual(result.minyanim, []);
    assert.deepEqual(
      result.statuses.map((s) => s.status),
      ['holidays_only'],
    );
  });
});

describe('the sign of an offset', () => {
  it('לפני is before — explicitly', () => {
    const m = parseMinyanTimes('מנחה 20 דקות לפני השקיעה').minyanim[0]!;
    assert.deepEqual(m.time, { kind: 'relative', anchor: 'shkia', offsetMinutes: -20 });
    assert.equal(m.signBasis, 'explicit');
  });

  it('אחרי is after — explicitly', () => {
    const m = parseMinyanTimes('ערבית 15 דקות אחרי השקיעה').minyanim[0]!;
    assert.deepEqual(m.time, { kind: 'relative', anchor: 'shkia', offsetMinutes: 15 });
    assert.equal(m.signBasis, 'explicit');
  });

  it("לפי is read as before, but flagged as convention rather than explicit", () => {
    // `לפי` literally means "according to" and carries no direction. CLAUDE.md
    // fixes it as before; halacha agrees (Mincha precedes shkia). The flag
    // exists so every one of these can be re-checked against a source in one
    // query rather than being lost among the explicit ones.
    const m = parseMinyanTimes("מנחה 20 דק' לפי שקיעה").minyanim[0]!;
    assert.equal(m.time.kind === 'relative' && m.time.offsetMinutes, -20);
    assert.equal(m.signBasis, 'convention');
  });
});

describe('beyond the Ramat Aviv sample — built for all 484', () => {
  it('recognises the other anchors', () => {
    const anchors: Array<[string, string]> = [
      ['ערבית-צאת הכוכבים', 'arvit tzeit+0'],
      ['מנחה-פלג המנחה', 'mincha plag+0'],
      ['שחרית-עלות השחר', 'shacharit alot+0'],
      ['מנחה-הדלקת נרות', 'mincha candle_lighting+0'],
      ['שחרית-זריחה', 'shacharit netz+0'],
    ];
    for (const [raw, expected] of anchors) {
      assert.deepEqual(sigs(parseMinyanTimes(raw)), [expected], raw);
    }
  });

  it('accepts מעריב as arvit', () => {
    assert.deepEqual(sigs(parseMinyanTimes('מעריב-20:15')), ['arvit 20:15']);
  });

  it('מנחה גדולה is a label, not a second phantom minyan', () => {
    assert.deepEqual(sigs(parseMinyanTimes('מנחה גדולה 13:00')), ['mincha 13:00']);
    assert.deepEqual(sigs(parseMinyanTimes('מנחה גדולה')), ['mincha mincha_gedola+0']);
  });

  it('does not mistake ק"ש for the summer marker', () => {
    // `ק` is the summer marker only when a number follows it.
    const result = parseMinyanTimes('שחרית 6:30 ק"ש 9:15');
    assert.deepEqual(
      result.minyanim.map((m) => m.season),
      [null, null],
    );
    assert.deepEqual(
      result.issues.map((i) => i.fragment),
      ['ק"ש'],
    );
  });

  it('normalises Hebrew punctuation and bidi marks', () => {
    // Hebrew maqaf, geresh, and an embedded RTL mark — all of these turn up.
    const raw = '‏שחרית־6:30, מנחה 20 דק׳ לפי שקיעה';
    assert.deepEqual(sigs(parseMinyanTimes(raw)), ['shacharit 06:30', 'mincha shkia-20']);
  });

  it('fails loudly on a shape it has never seen', () => {
    const result = parseMinyanTimes('מנחה כרבע שעה טרם השקיעה');
    assert.ok(result.issues.length > 0);
    assert.ok(result.issues.every((i) => i.code === 'unrecognized_text'));
    // Crucially it does NOT produce a shkia-15 minyan by reading "רבע שעה",
    // and it does not fall back to shkia+0 either — the words it failed on are
    // exactly the offset, so the honest answer is `unknown`.
    assert.deepEqual(result.minyanim.map((m) => m.time.kind), ['unknown']);
    assert.equal(result.minyanim.every((m) => m.needsReview.length > 0), true);
  });
});

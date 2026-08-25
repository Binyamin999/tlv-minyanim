/**
 * Every raw time string in `data/seed-ramat-aviv.json`, with the exact minyanim
 * it must produce. If a string in the seed has no entry in EXPECTED, this file
 * fails — a new shape can never slip in unexamined.
 *
 * PRIVACY: only `name_he` and the time strings appear here. See fixtures file.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMinyanTimes } from '../src/minyan-times/index.ts';
import type { DayType, SynagogueStatus } from '../src/minyan-times/index.ts';
import { ALL_RAW_STRINGS, SEED_FIXTURES } from './fixtures.seed-ramat-aviv.ts';
import { sigs } from './helpers.ts';

interface Expectation {
  minyanim: string[];
  statuses?: SynagogueStatus[];
  /** Raw segments recognised as classes rather than minyanim. */
  shiurim?: number;
  /** Fragments the parser must report as failures. Empty means fully parsed. */
  issues?: string[];
}

const EXPECTED = new Map<string, Expectation>([
  // --- plain single-service fields ---------------------------------------
  ['שחרית-8:30', { minyanim: ['shacharit 08:30'] }],
  ['שחרית-7:00', { minyanim: ['shacharit 07:00'] }],
  ['שחרית-6:45', { minyanim: ['shacharit 06:45'] }],
  ['מנחה-בזמן', { minyanim: ['mincha ?בזמן'] }],

  // trailing comma with nothing after it: punctuation, not a missing minyan
  ['שחרית-6:30,', { minyanim: ['shacharit 06:30'] }],

  // --- one fixed + one בזמן ----------------------------------------------
  ['שחרית-5:45, מנחה-בזמן', { minyanim: ['shacharit 05:45', 'mincha ?בזמן'] }],
  ['שחרית-8:15, מנחה-בזמן', { minyanim: ['shacharit 08:15', 'mincha ?בזמן'] }],
  ['שחרית-6:00, מנחה-בזמן', { minyanim: ['shacharit 06:00', 'mincha ?בזמן'] }],
  ['שחרית-7:00, מנחה-בזמן', { minyanim: ['shacharit 07:00', 'mincha ?בזמן'] }],
  ['שחרית-7:50, מנחה-בזמן', { minyanim: ['shacharit 07:50', 'mincha ?בזמן'] }],
  ['שחרית-7:30, מנחה-בזמן', { minyanim: ['shacharit 07:30', 'mincha ?בזמן'] }],
  ['שחרית-7:45, מנחה-בזמן', { minyanim: ['shacharit 07:45', 'mincha ?בזמן'] }],
  ['שחרית-8:45, מנחה-בזמן', { minyanim: ['shacharit 08:45', 'mincha ?בזמן'] }],
  ['שחרית-10:00, מנחה-בזמן', { minyanim: ['shacharit 10:00', 'mincha ?בזמן'] }],

  // stray space after the dash — `מנחה- בזמן` is still one unknown Mincha
  ['שחרית-9:00, מנחה- בזמן', { minyanim: ['shacharit 09:00', 'mincha ?בזמן'] }],

  // --- several minyanim in one field --------------------------------------
  [
    'שחרית-6:15-7:30, מנחה-בזמן',
    { minyanim: ['shacharit 06:15', 'shacharit 07:30', 'mincha ?בזמן'] },
  ],
  // periods instead of colons
  [
    'שחרית-7.30-8.30, מנחה-בזמן',
    { minyanim: ['shacharit 07:30', 'shacharit 08:30', 'mincha ?בזמן'] },
  ],
  [
    'שחרית-6:30-8:00, מנחה-14:00-בזמן',
    {
      minyanim: [
        'shacharit 06:30',
        'shacharit 08:00',
        'mincha 14:00',
        'mincha ?בזמן',
      ],
    },
  ],
  // two known Mincha times and one nobody wrote down
  [
    'שחרית-7:20, מנחה-13:30-13:55-בזמן',
    {
      minyanim: [
        'shacharit 07:20',
        'mincha 13:30',
        'mincha 13:55',
        'mincha ?בזמן',
      ],
    },
  ],
  // four separate Shacharit minyanim, plus a bare 21:00 with no service word
  [
    'שחרית-6:30-7:30-9:00-10:00, מנחה-14:05-15:15-בזמן, 21:00',
    {
      minyanim: [
        'shacharit 06:30',
        'shacharit 07:30',
        'shacharit 09:00',
        'shacharit 10:00',
        'mincha 14:05',
        'mincha 15:15',
        'mincha ?בזמן',
        // 21:00 is kept, but NOT attributed. Carrying Mincha over would
        // publish a 21:00 Mincha; reading the clock to call it Arvit would be
        // us deciding rather than the source. It goes to a human.
        '· 21:00 !',
      ],
    },
  ],

  // --- netz-relative + fixed in one field ---------------------------------
  [
    'שחרית-נץ-7:00, מנחה-13:00-בזמן',
    {
      minyanim: [
        'shacharit netz+0',
        'shacharit 07:00',
        'mincha 13:00',
        'mincha ?בזמן',
      ],
    },
  ],
  // netz + fixed, then a winter/summer pair that carries no service label
  [
    'שחרית-נץ-7:45, ח 12:30 ק 13:30-בזמן',
    {
      minyanim: [
        'shacharit netz+0',
        'shacharit 07:45',
        '· 12:30 [winter] !',
        '· 13:30 [summer] !',
        '· ?בזמן !',
      ],
    },
  ],

  // --- explicit offsets: the most valuable rows in the dataset ------------
  [
    "שחרית - 6:25, מנחה 20 דק' לפי שקיעה",
    { minyanim: ['shacharit 06:25', 'mincha shkia-20'] },
  ],
  [
    "שחרית - 8:00, מנחה - 10 דק' לפי כניסת שבת",
    { minyanim: ['shacharit 08:00', 'mincha candle_lighting-10'] },
  ],

  // --- not a time at all ---------------------------------------------------
  ['פתוח בחגים בלבד', { minyanim: [], statuses: ['holidays_only'] }],
  ['פתוח בחגים ובמועדי ישראל', { minyanim: [], statuses: ['holidays_only'] }],

  // --- classes, not minyanim ----------------------------------------------
  // A 7:00 daf yomi is not a 7:00 Shacharit. It must never become a minyan.
  ['שיעור דף יומי, בימים א-ה בשעה 7:00', { minyanim: [], shiurim: 2 }],
  ['שיעור דף יומי, בימים א-ה אחרי ערבית', { minyanim: [], shiurim: 2 }],
  ["בימים א'- ה' שיעור בין מנחה לערבית", { minyanim: [], shiurim: 1 }],
]);

const DAY_TYPE: Record<string, DayType | undefined> = {
  weekday: 'weekday',
  shabbat: 'shabbat',
  dafYomi: undefined,
  notes: undefined,
};

describe('seed fixtures — every raw string in data/seed-ramat-aviv.json', () => {
  it('covers all 16 Ramat Aviv synagogues', () => {
    assert.equal(SEED_FIXTURES.length, 16);
  });

  it('has an expectation for every raw string in the seed', () => {
    const missing = ALL_RAW_STRINGS.filter((r) => !EXPECTED.has(r.raw)).map(
      (r) => `${r.nameHe} / ${r.field}: ${JSON.stringify(r.raw)}`,
    );
    assert.deepEqual(
      missing,
      [],
      'A raw shape appeared with no expectation. Examine it, then add it here.',
    );
  });

  for (const { nameHe, field, raw } of ALL_RAW_STRINGS) {
    it(`${nameHe} — ${field}: ${raw}`, () => {
      const expected = EXPECTED.get(raw);
      assert.ok(expected, `no expectation for ${JSON.stringify(raw)}`);

      const dayType = DAY_TYPE[field];
      const result = parseMinyanTimes(raw, dayType ? { dayType } : {});

      assert.deepEqual(sigs(result), expected.minyanim);
      assert.deepEqual(
        result.statuses.map((s) => s.status),
        expected.statuses ?? [],
      );
      assert.equal(result.shiurim.length, expected.shiurim ?? 0);
      assert.deepEqual(
        result.issues.map((i) => i.fragment),
        expected.issues ?? [],
      );

      // Round-trip: every minyan can be traced back to the text it came from.
      for (const m of result.minyanim) {
        assert.equal(m.rawField, raw);
        assert.ok(raw.includes(m.rawSegment.replace(/ {2,}/g, ' ').trim()) || raw.includes(m.rawSegment));
        assert.equal(m.dayType, dayType ?? null);
      }
    });
  }
});

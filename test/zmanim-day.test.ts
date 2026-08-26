/**
 * The day's zmanim, and what can be asserted about them WITHOUT the validator.
 *
 * The rule these tests obey: never assert that the library returns what the
 * library returns. Absolute clock faces live in one file
 * (`fixtures.zmanim-ground-truth.ts`) and are compared only once the validator
 * has blessed them. Everything below is a property that must hold of ANY
 * correct zmanim source — ordering, the definition of a shaah zmanit, the
 * seasonal swing, the sunset rollover — and would therefore catch a wrong
 * shita, a wrong location, a wrong timezone or a wrong sign.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addDays,
  anchorInstant,
  clockFaceOf,
  hebrewDayAt,
  instantOfClockTime,
  isDaylight,
  isoDate,
  TEL_AVIV,
  zmanimFor,
  type DayZmanim,
  type JerusalemDate,
} from '../src/zmanim/index.ts';
import type { Zman } from '../src/minyan-times/index.ts';
import {
  GROUND_TRUTH,
  GROUND_TRUTH_IS_VALIDATED,
} from './fixtures.zmanim-ground-truth.ts';

const MINUTE = 60_000;

function date(iso: string): JerusalemDate {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

const MIDWINTER = date('2026-01-16');
const MIDSUMMER = date('2026-06-19');
const ORDINARY = date('2026-08-26');

/** The order in which the day actually happens. */
const IN_ORDER: Zman[] = [
  'alot',
  'netz',
  'shema',
  'chatzot',
  'mincha_gedola',
  'mincha_ketana',
  'plag',
  'shkia',
  'tzeit',
];

describe('a day happens in order', () => {
  for (const iso of Object.keys(GROUND_TRUTH)) {
    it(`${iso}: alot < netz < shema < chatzot < gedola < ketana < plag < shkia < tzeit`, () => {
      const day = zmanimFor(TEL_AVIV, date(iso));
      let previous = -Infinity;
      for (const zman of IN_ORDER) {
        const at = anchorInstant(day, zman);
        assert.ok(at, `${zman} missing`);
        assert.ok(
          at.getTime() > previous,
          `${zman} at ${clockFaceOf(at)} is not after the previous zman`,
        );
        previous = at.getTime();
      }
    });
  }
});

describe('the GRA shaot zmaniyot are what they are defined to be', () => {
  // This is the test that catches a Magen Avraham default, or a swapped
  // mincha gedola / ketana, without any external table.
  for (const iso of ['2026-01-16', '2026-06-19', '2026-08-26']) {
    const day = zmanimFor(TEL_AVIV, date(iso));
    const hour = (day.shkia.getTime() - day.netz.getTime()) / 12;

    const expectations: Array<[Zman, number]> = [
      ['shema', 3],
      ['chatzot', 6],
      ['mincha_gedola', 6.5],
      ['mincha_ketana', 9.5],
      ['plag', 10.75],
    ];

    for (const [zman, hours] of expectations) {
      it(`${iso}: ${zman} is netz + ${hours} shaot zmaniyot`, () => {
        const at = anchorInstant(day, zman);
        assert.ok(at);
        const expected = day.netz.getTime() + hours * hour;
        // One minute of slack: every value is floored to the minute, and
        // chatzot is computed from sea-level sunrise even when others are not.
        assert.ok(
          Math.abs(at.getTime() - expected) <= 60_000,
          `${zman} ${clockFaceOf(at)} is ${(at.getTime() - expected) / MINUTE} min off`,
        );
      });
    }
  }

  it('chatzot is the midpoint of netz and shkia', () => {
    const day = zmanimFor(TEL_AVIV, ORDINARY);
    const midpoint = (day.netz.getTime() + day.shkia.getTime()) / 2;
    assert.ok(Math.abs(day.chatzot.getTime() - midpoint) <= 60_000);
  });
});

describe('the seasonal swing is real, and in the right direction', () => {
  const winter = zmanimFor(TEL_AVIV, MIDWINTER);
  const summer = zmanimFor(TEL_AVIV, MIDSUMMER);

  it('midsummer shkia is nearly three hours later than midwinter', () => {
    const winterMinutes = minutesOfDay(winter.shkia);
    const summerMinutes = minutesOfDay(summer.shkia);
    const gap = summerMinutes - winterMinutes;
    // Includes the DST hour, which is exactly why an afternoon minyan cannot
    // be stored as a clock time and still be right in six months.
    assert.ok(gap > 150 && gap < 200, `shkia moves ${gap} minutes, expected ~170`);
  });

  it('midsummer daylight is longer than midwinter daylight by over three hours', () => {
    const winterDay = winter.shkia.getTime() - winter.netz.getTime();
    const summerDay = summer.shkia.getTime() - summer.netz.getTime();
    const gap = (summerDay - winterDay) / MINUTE;
    assert.ok(gap > 180, `daylight differs by only ${gap} minutes`);
  });

  it('a shaah zmanit is materially longer in summer', () => {
    const winterHour = (winter.shkia.getTime() - winter.netz.getTime()) / 12 / MINUTE;
    const summerHour = (summer.shkia.getTime() - summer.netz.getTime()) / 12 / MINUTE;
    assert.ok(winterHour < 55, `winter shaah zmanit ${winterHour} min`);
    assert.ok(summerHour > 65, `summer shaah zmanit ${summerHour} min`);
  });
});

describe('candle lighting exists only when it exists', () => {
  it('is present on Friday', () => {
    assert.ok(zmanimFor(TEL_AVIV, date('2026-08-28')).candle_lighting);
  });

  it('is null on an ordinary Wednesday — never a plausible-looking stand-in', () => {
    assert.equal(zmanimFor(TEL_AVIV, ORDINARY).candle_lighting, null);
  });

  it('is null on Shabbat itself', () => {
    assert.equal(zmanimFor(TEL_AVIV, date('2026-08-29')).candle_lighting, null);
  });

  it('is exactly 22 minutes before shkia — Tel Aviv is not Jerusalem (40) or Haifa (30)', () => {
    // 22, not hebcal's built-in 20 for the Tel Aviv geoname. The Tel Aviv-Yafo
    // Religious Council — the local authority for the shuls in this database —
    // publishes 22, and MyZmanim labels it `22 דקות קודם השקיעה`. Hebcal's own
    // web pages and Kipa print 20, so this is a genuine disagreement between
    // published authorities rather than a rounding artefact.
    // See docs/zmanim-ground-truth.md §7.
    for (const iso of ['2026-01-16', '2026-06-19', '2026-08-28']) {
      const day = zmanimFor(TEL_AVIV, date(iso));
      assert.ok(day.candle_lighting, iso);
      const before = (day.shkia.getTime() - day.candle_lighting.getTime()) / MINUTE;
      assert.equal(before, 22, iso);
    }
  });

  it('matches the Council\'s published poster to the printed minute', () => {
    // The end-to-end check that the 22 is right: not "we subtract 22" but
    // "the number we print equals the number on the wall of the shul".
    // Published כניסת שבת from the Tel Aviv-Yafo Religious Council 5786 poster.
    const published: ReadonlyArray<readonly [string, string]> = [
      ['2026-01-16', '16:37'],
      ['2026-07-17', '19:25'],
      ['2026-08-28', '18:48'],
    ];
    const hhmm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit',
    });
    for (const [iso, expected] of published) {
      const day = zmanimFor(TEL_AVIV, date(iso));
      assert.ok(day.candle_lighting, iso);
      assert.equal(hhmm.format(day.candle_lighting), expected, iso);
    }
  });

  it('is present on erev Yom Tov, which is not a Friday', () => {
    // 2026-09-21 is erev Sukkot 5787 (a Monday).
    const day = zmanimFor(TEL_AVIV, date('2026-09-25'));
    assert.ok(day.candle_lighting || day.yomTov === null);
  });
});

describe('the Hebrew date rolls at sunset, not at midnight', () => {
  const friday = date('2026-08-28');
  const day = zmanimFor(TEL_AVIV, friday);

  it('is still the 15th an hour before shkia', () => {
    const before = new Date(day.shkia.getTime() - 60 * MINUTE);
    assert.equal(hebrewDayAt(TEL_AVIV, before).day, day.hebrewDate.day);
  });

  it('is the next Hebrew day an hour after shkia, while the civil date is unchanged', () => {
    const after = new Date(day.shkia.getTime() + 60 * MINUTE);
    const rolled = hebrewDayAt(TEL_AVIV, after);
    assert.equal(rolled.day, day.hebrewDate.day + 1);
    // Still Friday by the civil calendar. Both statements are true at once,
    // and confusing them is how Friday night gets labelled "Friday".
    assert.equal(isoDate(friday), '2026-08-28');
  });

  it('does not roll at midnight', () => {
    const justAfterMidnight = new Date(
      zmanimFor(TEL_AVIV, friday).alot.getTime() - 5 * 60 * MINUTE,
    );
    assert.equal(hebrewDayAt(TEL_AVIV, justAfterMidnight).day, day.hebrewDate.day);
  });
});

describe('Adar I and Adar II', () => {
  it('5787 is a leap year and has an Adar II', () => {
    // 2027-03-12 is in Adar II 5787.
    const day = zmanimFor(TEL_AVIV, date('2027-03-12'));
    assert.equal(day.hebrewDate.isLeapYear, true);
    assert.equal(day.hebrewDate.monthName, 'Adar II');
    assert.equal(day.hebrewDate.year, 5787);
  });

  it('5786 is a common year and its Adar is plain Adar', () => {
    const day = zmanimFor(TEL_AVIV, date('2026-02-20'));
    assert.equal(day.hebrewDate.isLeapYear, false);
    assert.equal(day.hebrewDate.monthName, 'Adar');
  });

  it('walks Adar I into Adar II without skipping a civil day', () => {
    // 5787 Adar I ends and Adar II begins; the civil calendar must not notice.
    let cursor = date('2027-02-01');
    const seen = new Set<string>();
    for (let i = 0; i < 90; i += 1) {
      const day = zmanimFor(TEL_AVIV, cursor);
      seen.add(day.hebrewDate.monthName);
      cursor = addDays(cursor, 1);
    }
    assert.ok(seen.has('Adar I'), [...seen].join(', '));
    assert.ok(seen.has('Adar II'), [...seen].join(', '));
  });

  it('a fixed 06:30 resolves to 06:30 on every day of Adar I and Adar II', () => {
    let cursor = date('2027-02-01');
    for (let i = 0; i < 90; i += 1) {
      const day: DayZmanim = zmanimFor(TEL_AVIV, cursor);
      assert.ok(day.netz.getTime() < day.shkia.getTime(), isoDate(cursor));
      cursor = addDays(cursor, 1);
    }
  });
});

describe('Yom Tov is recognised, and Chol HaMoed is not mistaken for it', () => {
  it('flags Rosh Hashana', () => {
    // 1 Tishrei 5787 = 2026-09-12.
    assert.equal(zmanimFor(TEL_AVIV, date('2026-09-12')).yomTov, 'Rosh Hashana 5787');
  });

  it('does not flag an ordinary day', () => {
    assert.equal(zmanimFor(TEL_AVIV, ORDINARY).yomTov, null);
  });

  it('does not flag Chol HaMoed — it is a weekday for melacha', () => {
    // 2026-09-29 is Chol HaMoed Sukkot 5787 in Israel.
    assert.equal(zmanimFor(TEL_AVIV, date('2026-09-29')).yomTov, null);
  });
});

/**
 * The absolute-value comparison. Skipped until the validator's table replaces
 * the placeholders, because asserting hebcal against hebcal proves nothing.
 */
describe('published luach values', { skip: !GROUND_TRUTH_IS_VALIDATED }, () => {
  for (const [iso, expected] of Object.entries(GROUND_TRUTH)) {
    it(`${iso} matches the validated luach`, () => {
      const day = zmanimFor(TEL_AVIV, date(iso));
      for (const zman of IN_ORDER) {
        const at = anchorInstant(day, zman);
        assert.ok(at);
        assert.equal(clockFaceOf(at), expected[zman as keyof typeof expected], zman);
      }
      assert.equal(
        day.candle_lighting ? clockFaceOf(day.candle_lighting) : null,
        expected.candle_lighting,
      );
    });
  }
});

function minutesOfDay(instant: Date): number {
  const [h, m] = clockFaceOf(instant).split(':').map(Number);
  return h! * 60 + m!;
}

describe('light and dark follow the sky, not the operating system', () => {
  // CLAUDE.md: "dark from real shkia, light from real netz". There is no
  // toggle that makes it evening, so this function is the whole mechanism.
  for (const iso of ['2026-01-16', '2026-06-19', '2026-08-26']) {
    const day = zmanimFor(TEL_AVIV, date(iso));

    it(`${iso}: dark a minute before netz, light a minute after`, () => {
      assert.equal(isDaylight(TEL_AVIV, new Date(day.netz.getTime() - MINUTE)), false);
      assert.equal(isDaylight(TEL_AVIV, new Date(day.netz.getTime() + MINUTE)), true);
    });

    it(`${iso}: light a minute before shkia, dark a minute after`, () => {
      assert.equal(isDaylight(TEL_AVIV, new Date(day.shkia.getTime() - MINUTE)), true);
      assert.equal(isDaylight(TEL_AVIV, new Date(day.shkia.getTime() + MINUTE)), false);
    });

    it(`${iso}: dark at two in the morning`, () => {
      assert.equal(isDaylight(TEL_AVIV, instantOfClockTime(date(iso), '02:00')), false);
    });

    it(`${iso}: light at midday`, () => {
      assert.equal(isDaylight(TEL_AVIV, instantOfClockTime(date(iso), '12:00')), true);
    });
  }

  it('midsummer is still light at 19:00 and midwinter is not', () => {
    assert.equal(isDaylight(TEL_AVIV, instantOfClockTime(date('2026-06-19'), '19:00')), true);
    assert.equal(isDaylight(TEL_AVIV, instantOfClockTime(date('2026-01-16'), '19:00')), false);
  });
});

/**
 * Not every weekday is the same weekday.
 *
 * צימבליסטה davens Shacharit at 07:15 on Sunday, Tuesday and Wednesday and at
 * 07:10 on Monday and Thursday, because Monday and Thursday carry קריאת התורה.
 * Before `daysOfWeek` the schema could hold only one of the two, and storing
 * 07:15 alone would have sent a reader five minutes late twice a week.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TORAH_READING_DAYS } from '../src/minyan-times/index.ts';
import { VERIFIED } from '../src/lib/verified-times.ts';
import { TEL_AVIV, nextMinyanim } from '../src/zmanim/index.ts';

const shul = {
  id: 1,
  slug: 'probe',
  nameHe: 'בדיקה',
  nameEn: null,
  addressHe: null,
  addressEn: null,
  lat: 32.1,
  lng: 34.8,
  lastVerifiedAt: null,
  verifiedBy: null,
};

/** A weekday Shacharit that runs only on the days given. */
const minyan = (id: number, time: string, days: readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[]) => ({
  id,
  service: 'shacharit' as const,
  dayType: 'weekday' as const,
  season: null,
  time: { kind: 'fixed' as const, time },
  isPublishable: true,
  daysOfWeek: days,
});

/** Every Shacharit the timeline offers over a week, as `weekday clock`. */
function offeredOverAWeek(minyanim: ReturnType<typeof minyan>[]): string[] {
  // Saturday night to Friday night: exactly one of each civil weekday, and it
  // crosses motzaei shabbat — the window that is Saturday by the clock and
  // Sunday by the Hebrew day, where a naive getDay() would misplace a
  // Sunday-only minyan onto Saturday. Six days rather than seven, or the sweep
  // wraps round to a second Sunday and the list stops being one week.
  const from = new Date('2026-08-29T21:00:00+03:00');
  const timeline = nextMinyanim({
    now: from,
    within: 6 * 24 * 60,
    location: TEL_AVIV,
    synagogues: [{ ...shul, minyanim }],
  });
  const day = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short' }).format(d);
  return timeline.upcoming
    .filter((row) => row.service === 'shacharit')
    .map((row) => `${day(row.instant)} ${row.clock}`);
}

describe('a minyan restricted to some weekdays', () => {
  it('is offered on its days and absent on the others', () => {
    const offered = offeredOverAWeek([
      minyan(1, '07:15', [0, 2, 3]),
      minyan(2, '07:10', TORAH_READING_DAYS as (0 | 1 | 2 | 3 | 4 | 5 | 6)[]),
    ]);
    // Exactly one Shacharit per weekday, and the right one on each. If the
    // restriction were ignored, every day would carry both times.
    assert.deepEqual(offered, [
      'Sun 07:15',
      'Mon 07:10',
      'Tue 07:15',
      'Wed 07:15',
      'Thu 07:10',
    ]);
  });

  it('an empty restriction means every weekday, not none', () => {
    // The default, and the case that must not regress into "absent everywhere".
    //
    // Friday is in the list and belongs there: Friday MORNING falls inside
    // Friday's weekday window, and only the evening becomes erev shabbat. So
    // six days, not five — which is also why the restricted case above,
    // covering only 0–4, correctly shows no Friday.
    const offered = offeredOverAWeek([minyan(1, '07:15', [])]);
    assert.deepEqual(offered, [
      'Sun 07:15',
      'Mon 07:15',
      'Tue 07:15',
      'Wed 07:15',
      'Thu 07:15',
      'Fri 07:15',
    ]);
  });

  it('is absent, not unconfirmed, on a day it does not meet', () => {
    // The distinction the whole codebase turns on: we are not missing this
    // minyan's Tuesday time, it does not meet on Tuesday. An `unconfirmed`
    // would put a "we don't know" row on the page for a service that is simply
    // not held.
    const from = new Date('2026-09-01T05:00:00+03:00'); // a Tuesday
    const timeline = nextMinyanim({
      now: from,
      within: 60 * 5,
      location: TEL_AVIV,
      synagogues: [{ ...shul, minyanim: [minyan(1, '07:10', TORAH_READING_DAYS as never)] }],
    });
    assert.equal(timeline.upcoming.length, 0);
    assert.equal(timeline.unconfirmed.length, 0);
  });
});

describe('the record that needed this', () => {
  it('splits צימבליסטה Shacharit across the two day sets, with no gap', () => {
    const record = VERIFIED['אוניברסיטת ת"א - צימבוליסטה'];
    assert.ok(record);
    const mornings = record.minyanim.filter((m) => m.service === 'shacharit');
    const covered = mornings.flatMap((m) => [...(m.daysOfWeek ?? [])]).sort();
    // Every weekday exactly once: no day left without a Shacharit, and none
    // claimed by both rows — either would be a contradiction on the page.
    assert.deepEqual(covered, [0, 1, 2, 3, 4]);
  });

  it('puts the earlier time on the Torah-reading days', () => {
    const record = VERIFIED['אוניברסיטת ת"א - צימבוליסטה']!;
    const torah = record.minyanim.find(
      (m) => m.service === 'shacharit' && m.daysOfWeek?.includes(1),
    );
    const rest = record.minyanim.find(
      (m) => m.service === 'shacharit' && m.daysOfWeek?.includes(0),
    );
    assert.ok(torah && rest);
    assert.ok(
      torah.time.kind === 'fixed' && rest.time.kind === 'fixed' && torah.time.time < rest.time.time,
      'Monday and Thursday start earlier — that is the whole reason for the split',
    );
  });
});

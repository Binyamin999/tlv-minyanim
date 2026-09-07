import { HebrewCalendar, flags } from '@hebcal/core';
import { TEL_AVIV } from '../src/zmanim/location.ts';

const events = HebrewCalendar.calendar({
  start: new Date(2026, 8, 5),
  end: new Date(2026, 9, 15),
  il: true,
  location: TEL_AVIV,
  candlelighting: true,
  sedrot: true,
  locale: 'he',
});
const FLAGS = Object.entries(flags).filter(([, v]) => typeof v === 'number' && v !== 0) as Array<[string, number]>;
for (const ev of events) {
  const g = ev.getDate().greg();
  const iso = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
  const f = ev.getFlags();
  console.log(
    iso.padEnd(11),
    ev.render('en').padEnd(36),
    ev.render('he').padEnd(28),
    FLAGS.filter(([, v]) => (f & v) === v).map(([k]) => k).join(','),
  );
}

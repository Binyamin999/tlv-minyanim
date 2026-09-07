import { HebrewCalendar, flags, Locale } from '@hebcal/core';
import { TEL_AVIV } from '../src/zmanim/location.ts';
import { parshaAt } from '../src/zmanim/parsha.ts';

console.log('locales:', Locale.getLocaleNames().filter((l) => l.startsWith('he')));

const ev = HebrewCalendar.calendar({
  start: new Date(2026, 8, 11), end: new Date(2026, 8, 13), il: true,
  location: TEL_AVIV, candlelighting: true, sedrot: true,
})[0]!;
for (const loc of ['he', 'he-x-NoNikud', 'en']) {
  try { console.log(loc.padEnd(14), ev.render(loc)); } catch (e) { console.log(loc, 'ERR', (e as Error).message); }
}
console.log('\nparsha today:', parshaAt(TEL_AVIV, new Date()));
console.log('parsha 2026-09-19:', parshaAt(TEL_AVIV, new Date('2026-09-19T10:00:00+03:00')));

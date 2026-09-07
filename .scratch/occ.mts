import { TEL_AVIV } from '../src/zmanim/location.ts';
import { occasionAt, nextCandleLighting } from '../src/zmanim/occasions.ts';
import { clockFaceOf, jerusalemInstant, isoDate } from '../src/zmanim/jerusalem-date.ts';
import { parshaAt } from '../src/zmanim/parsha.ts';

const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
for (let i = 0; i < 12; i++) {
  const d = new Date(Date.UTC(2026, 8, 6 + i, 9, 0)); // noon Israel
  const iso = `2026-09-${String(6 + i).padStart(2, '0')}`;
  const occ = occasionAt(TEL_AVIV, d);
  const par = parshaAt(TEL_AVIV, d);
  const [y, m, dd] = iso.split('-').map(Number);
  const nc = nextCandleLighting(TEL_AVIV, { year: y!, month: m!, day: dd! });
  console.log(
    iso, days[new Date(iso).getUTCDay()],
    '| occ:', (occ?.he ?? '—').padEnd(16),
    '| parsha:', (par?.he ?? '—').padEnd(22),
    '| candles:', nc ? `${clockFaceOf(nc.instant)} +${nc.daysAhead}d (${nc.occasion?.he ?? 'שבת'})` : '—',
  );
}

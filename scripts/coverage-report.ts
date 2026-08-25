#!/usr/bin/env node
/**
 * Minyan-time parser coverage report.
 *
 * Reads `data/seed-ramat-aviv.json` (gitignored — it holds rabbi and gabbai
 * names and personal phone numbers) and prints, per service, how the free-text
 * times resolved. It prints ONLY the synagogue name and the time strings. No
 * `rabbi_*`, `gabbai_*` or `phone_*` value is ever read, let alone printed.
 *
 * Read the `unknown` column as a product finding, not a defect. `בזמן` is the
 * most common value in the corpus and it means an offset nobody wrote down.
 * The number is high because the source is vague, and the correct response is
 * to go and ask the gabbai — not to make the number look better.
 *
 *   npm run coverage
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseMinyanTimes } from '../src/minyan-times/index.ts';
import type { DayType, ParsedMinyan, Service } from '../src/minyan-times/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = resolve(ROOT, 'data/seed-ramat-aviv.json');

/** The only fields this script is allowed to touch. */
const TIME_FIELDS = [
  ['weekday_times_raw', 'weekday'],
  ['shabbat_times_raw', 'shabbat'],
] as const satisfies ReadonlyArray<readonly [string, DayType]>;

/**
 * Fields that are NOT minyan times. Reported separately so it is visible that
 * they produce no minyanim — a 7:00 daf yomi must never become a 7:00 shacharit.
 */
const NON_MINYAN_FIELDS = ['daf_yomi_raw', 'notes_he'] as const;

interface Tally {
  fixed: number;
  relative: number;
  unknown: number;
  needsReview: number;
}

const empty = (): Tally => ({ fixed: 0, relative: 0, unknown: 0, needsReview: 0 });

function main(): void {
  let json: string;
  try {
    json = readFileSync(SEED, 'utf8');
  } catch {
    console.error(
      `Cannot read ${SEED}.\n` +
        'It is gitignored on purpose (personal data). Fetch it locally from GIS layer 568.',
    );
    process.exitCode = 1;
    return;
  }

  const seed = JSON.parse(json) as { synagogues: Array<Record<string, unknown>> };

  const byService = new Map<string, Tally>([
    ['shacharit', empty()],
    ['mincha', empty()],
    ['arvit', empty()],
    ['(no service label)', empty()],
  ]);

  let fieldsSeen = 0;
  let fieldsFullyParsed = 0;
  const failedFields: Array<{ nameHe: string; field: string; raw: string; fragments: string[] }> = [];
  const statuses: Array<{ nameHe: string; status: string; raw: string }> = [];
  const shiurim: Array<{ nameHe: string; raw: string }> = [];
  const relatives: Array<{ nameHe: string; raw: string; rule: string; basis: string }> = [];
  const unattributed: Array<{ nameHe: string; raw: string; segment: string }> = [];
  const sample: string[] = [];
  const nonMinyan: Array<{ nameHe: string; field: string; raw: string; verdict: string }> = [];

  for (const shul of seed.synagogues) {
    const nameHe = String(shul['name_he'] ?? '(unnamed)');

    for (const [field, dayType] of TIME_FIELDS) {
      const raw = shul[field];
      if (typeof raw !== 'string' || raw.trim() === '') continue;
      fieldsSeen += 1;

      const result = parseMinyanTimes(raw, { dayType });

      if (result.issues.length === 0) fieldsFullyParsed += 1;
      else {
        failedFields.push({
          nameHe,
          field,
          raw,
          fragments: result.issues.map((i) => `${i.code}:${i.fragment}`),
        });
      }

      for (const s of result.statuses) statuses.push({ nameHe, status: s.status, raw: s.rawSegment });
      for (const s of result.shiurim) shiurim.push({ nameHe, raw: s.rawSegment });

      for (const m of result.minyanim) {
        const key: string = m.service ?? '(no service label)';
        const tally = byService.get(key) ?? empty();
        byService.set(key, tally);
        tally[m.time.kind] += 1;
        if (m.needsReview.length > 0) tally.needsReview += 1;

        if (m.time.kind === 'relative') {
          relatives.push({
            nameHe,
            raw: m.rawSegment,
            rule: describe(m),
            basis: m.signBasis ?? 'n/a',
          });
        }
        if (m.service === null && !unattributed.some((u) => u.raw === raw && u.segment === m.rawSegment)) {
          unattributed.push({ nameHe, raw, segment: m.rawSegment });
        }
        sample.push(
          `${pad(nameHe, 28)} ${pad(dayType, 8)} ${pad(m.service ?? '·', 11)} ${pad(describe(m), 22)} ${
            m.needsReview.length > 0 ? 'REVIEW' : ''
          }`,
        );
      }
    }

    for (const field of NON_MINYAN_FIELDS) {
      const raw = shul[field];
      if (typeof raw !== 'string' || raw.trim() === '') continue;
      const result = parseMinyanTimes(raw);
      const verdict =
        result.minyanim.length > 0
          ? `LEAKED ${result.minyanim.length} minyan(im) — investigate`
          : result.statuses.length > 0
            ? `status: ${result.statuses.map((x) => x.status).join(', ')}`
            : result.shiurim.length > 0
              ? `shiur (${result.shiurim.length} segment(s))`
              : 'nothing recognised';
      nonMinyan.push({ nameHe, field, raw, verdict });
      for (const s2 of result.statuses) statuses.push({ nameHe, status: s2.status, raw: s2.rawSegment });
      for (const s2 of result.shiurim) shiurim.push({ nameHe, raw: s2.rawSegment });
    }
  }

  /* --------------------------------------------------------------- */

  console.log('\nTLV Minyanim — minyan-time parser coverage');
  console.log(`Source: data/seed-ramat-aviv.json  (${seed.synagogues.length} synagogues, v0 scope)`);
  console.log('Built for all 484 Tel Aviv-Yafo shuls; this is the Ramat Aviv sample.\n');

  console.log('Per service');
  console.log('─'.repeat(74));
  console.log(
    `${pad('service', 20)}${padL('fixed', 8)}${padL('relative', 10)}${padL('unknown', 9)}${padL(
      'total',
      8,
    )}${padL('unknown %', 12)}${padL('review', 8)}`,
  );
  let totals = empty();
  for (const [service, t] of byService) {
    const total = t.fixed + t.relative + t.unknown;
    if (total === 0) continue;
    totals = {
      fixed: totals.fixed + t.fixed,
      relative: totals.relative + t.relative,
      unknown: totals.unknown + t.unknown,
      needsReview: totals.needsReview + t.needsReview,
    };
    console.log(
      `${pad(service, 20)}${padL(t.fixed, 8)}${padL(t.relative, 10)}${padL(t.unknown, 9)}${padL(
        total,
        8,
      )}${padL(pct(t.unknown, total), 12)}${padL(t.needsReview, 8)}`,
    );
  }
  const grand = totals.fixed + totals.relative + totals.unknown;
  console.log('─'.repeat(74));
  console.log(
    `${pad('ALL', 20)}${padL(totals.fixed, 8)}${padL(totals.relative, 10)}${padL(
      totals.unknown,
      9,
    )}${padL(grand, 8)}${padL(pct(totals.unknown, grand), 12)}${padL(totals.needsReview, 8)}`,
  );

  console.log('\nRaw fields');
  console.log('─'.repeat(74));
  console.log(`  time fields seen            ${fieldsSeen}`);
  console.log(`  parsed with no leftovers    ${fieldsFullyParsed}`);
  console.log(`  with unparsed text          ${failedFields.length}`);
  console.log(`  statuses (not times)        ${statuses.length}`);
  console.log(`  shiurim (not minyanim)      ${shiurim.length}`);

  console.log('\nNon-minyan fields — must yield no minyanim');
  console.log('─'.repeat(74));
  for (const n of nonMinyan) {
    console.log(`  ${pad(n.nameHe, 28)} ${pad(n.field, 15)} ${pad(n.verdict, 26)} ${n.raw}`);
  }

  if (failedFields.length > 0) {
    console.log('\nFields the parser could not fully account for');
    console.log('─'.repeat(74));
    for (const f of failedFields) {
      console.log(`  ${f.nameHe} / ${f.field}`);
      console.log(`    raw: ${f.raw}`);
      console.log(`    unparsed: ${f.fragments.join(', ')}`);
    }
  } else {
    console.log('\nNo unparsed fragments in this sample. Expect that to change at 484.');
  }

  if (statuses.length > 0) {
    console.log('\nStatus values found in time fields');
    console.log('─'.repeat(74));
    for (const s of statuses) console.log(`  ${pad(s.nameHe, 28)} ${pad(s.status, 16)} ${s.raw}`);
  }

  if (relatives.length > 0) {
    console.log('\nRelative times — the rows that show the shape the rest should take');
    console.log('─'.repeat(74));
    for (const r of relatives) {
      console.log(
        `  ${pad(r.nameHe, 28)} ${pad(r.rule, 24)} sign:${pad(r.basis, 12)} ${r.raw}`,
      );
    }
  }

  if (unattributed.length > 0) {
    console.log('\nTimes with no service label — for a human to attribute, never a parser');
    console.log('─'.repeat(74));
    for (const u of unattributed) {
      console.log(`  ${pad(u.nameHe, 28)} segment: ${pad(u.segment, 22)} in: ${u.raw}`);
    }
  }

  console.log(`\nFull sample — ${sample.length} parsed minyanim, for spot-checking by hand`);
  console.log('─'.repeat(74));
  for (const line of sample) console.log('  ' + line);
  console.log();
}

function describe(m: ParsedMinyan): string {
  const season = m.season ? ` (${m.season})` : '';
  switch (m.time.kind) {
    case 'fixed':
      return m.time.time + season;
    case 'relative':
      return `${m.time.anchor}${m.time.offsetMinutes >= 0 ? '+' : ''}${m.time.offsetMinutes}m${season}`;
    case 'unknown':
      return `unknown "${m.time.rawText}"${season}`;
  }
}

function pct(part: number, whole: number): string {
  if (whole === 0) return '—';
  return `${((part / whole) * 100).toFixed(0)}%`;
}

/**
 * Hebrew is RTL and the terminal is not, so column padding by code-unit count
 * is approximate. Good enough for a hand spot-check; do not build a UI on it.
 */
function pad(v: string | number, width: number): string {
  const s = String(v);
  return s + ' '.repeat(Math.max(1, width - s.length));
}

function padL(v: string | number, width: number): string {
  const s = String(v);
  return ' '.repeat(Math.max(1, width - s.length)) + s;
}

main();

import type { ParsedMinyan, ParseResult } from '../src/minyan-times/index.ts';

/**
 * A one-line, human-readable signature for a parsed minyan.
 *
 * The point of this notation is that a person can read an expectation table and
 * recognise the source string in it. "Every parsed record round-trips to
 * something a human would recognise" is the definition of done; if you cannot
 * eyeball these strings against the Hebrew, the parser is not verified.
 *
 *   `shacharit 06:30`            fixed
 *   `mincha shkia-20`            relative, 20 minutes before sunset
 *   `shacharit netz+0`           relative, at sunrise
 *   `mincha ?בזמן`               unknown, raw text preserved
 *   `· 21:00 !`                  no service label; `!` = needs human review
 *   `· 12:30 [winter] !`         winter variant (ח)
 */
export function sig(m: ParsedMinyan): string {
  const service = m.service ?? '·';
  let time: string;
  switch (m.time.kind) {
    case 'fixed':
      time = m.time.time;
      break;
    case 'relative':
      time = `${m.time.anchor}${m.time.offsetMinutes >= 0 ? '+' : ''}${m.time.offsetMinutes}`;
      break;
    case 'unknown':
      time = `?${m.time.rawText}`;
      break;
  }
  const season = m.season ? ` [${m.season}]` : '';
  const review = m.needsReview.length > 0 ? ' !' : '';
  return `${service} ${time}${season}${review}`;
}

export function sigs(result: ParseResult): string[] {
  return result.minyanim.map(sig);
}

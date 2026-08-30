/**
 * Signed numbers inside Hebrew text.
 *
 * `קומה -1` rendered as `1-`, with the minus on the wrong side of the digit,
 * and that is correct Unicode rather than a browser bug. A hyphen-minus is
 * bidi class ES; here it has a space before it and a digit after, so rule W4
 * (an ES between two numbers joins them) does not apply, W6 makes it a plain
 * neutral, and N2 then gives a neutral the paragraph's direction. In an RTL
 * paragraph that puts the sign to the right of the number it belongs to, and
 * a reader sees `1-` — which is not a floor.
 *
 * The number is already an LTR run; the sign simply is not part of it. So the
 * fix is to isolate the two together and state the direction — see BidiText.
 *
 * Done at the display layer rather than by putting U+2066/U+2069 in the data.
 * Invisible control characters in an address survive into search indexes,
 * `<title>`, JSON-LD and anything anyone ever copies out of the page, and they
 * are unreadable in a diff. The stored string stays what the sign says.
 *
 * The splitting lives here, apart from the markup, because this is the part
 * with an argument in it and therefore the part worth testing — and because
 * Node's type stripping cannot load a `.tsx` file at all, so a test could not
 * otherwise reach it.
 */

/**
 * A sign attached to digits, at a word boundary.
 *
 * Anchored on a preceding space or start of string so that `אור גבריאל - משמעות`
 * (a dash between words) and a range like `5-7` are both left alone — only a
 * sign bound to the number that follows it is a signed number. A range needs
 * no help: rule W4 already joins it correctly.
 */
const SIGNED_NUMBER = /(^|\s)([-−+]\d+(?:[.,]\d+)?)/g;

export interface BidiSegment {
  text: string;
  /** True when this run must be isolated LTR to read correctly. */
  isolate: boolean;
}

/**
 * `text` split into runs, marking the ones that need isolating.
 *
 * Returns a single un-isolated segment when there is nothing to fix, which is
 * the overwhelmingly common case — 16 of the 17 addresses in the database.
 */
export function splitSignedNumbers(text: string): BidiSegment[] {
  SIGNED_NUMBER.lastIndex = 0;
  const segments: BidiSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = SIGNED_NUMBER.exec(text)) !== null) {
    const lead = match[1] ?? '';
    const number = match[2]!;
    const start = match.index + lead.length;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), isolate: false });
    segments.push({ text: number, isolate: true });
    cursor = start + number.length;
  }
  if (cursor < text.length || segments.length === 0) {
    segments.push({ text: text.slice(cursor), isolate: false });
  }
  return segments;
}

/**
 * Mixed Hebrew, digits and a sign on one line — the case CLAUDE.md names as
 * where RTL breaks, and it did.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { splitSignedNumbers } from '../src/lib/bidi.ts';
import { curatedAddressEn } from '../src/lib/curation.ts';

/**
 * The segments written back out, with any isolated run marked.
 *
 * The component turns exactly this into `<bdi dir="ltr">`; what is asserted
 * here is which run got isolated, which is the whole of the decision.
 */
function render(text: string): string {
  return splitSignedNumbers(text)
    .map((s) => (s.isolate ? `<bdi dir="ltr">${s.text}</bdi>` : s.text))
    .join('');
}

describe('splitSignedNumbers', () => {
  it('isolates a negative floor so it does not render as 1-', () => {
    const html = render('קניון רמת אביב, איינשטיין 40, קומה -1');
    // dir="ltr" and not a bare <bdi>: bare <bdi> is dir="auto", and `-1` has
    // no strong character for auto to detect, so it falls back to the
    // paragraph's RTL and the bug survives the markup.
    assert.match(html, /<bdi dir="ltr">-1<\/bdi>/);
  });

  it('leaves a plain house number alone', () => {
    // `40` is already an LTR run; only the sign was ever the problem, and
    // wrapping every number in markup would be noise on all 484 rows.
    assert.equal(render('אופנהיימר 5'), 'אופנהיימר 5');
  });

  it('leaves a dash between words alone', () => {
    // `אור גבריאל - משמעות` is a real name. A dash is only a sign when it is
    // bound to the digits after it.
    assert.equal(render('אור גבריאל - משמעות'), 'אור גבריאל - משמעות');
  });

  it('does not touch a range, where both sides are numbers', () => {
    // Unicode already joins these correctly (rule W4), so there is nothing to
    // fix and markup would only risk breaking it.
    assert.equal(render('שיעור 5-7'), 'שיעור 5-7');
  });

  it('returns one plain segment when there is nothing to isolate', () => {
    // 16 of the 17 addresses in the database take this path, and the component
    // returns the bare string for it rather than wrapping every line in markup.
    assert.deepEqual(splitSignedNumbers('ברודצקי 19'), [
      { text: 'ברודצקי 19', isolate: false },
    ]);
  });
});

describe('addresses in Latin script', () => {
  it('transliterates rather than translates', () => {
    // Reading is the power station the street is named after. "The reading
    // street" would be a street nobody in this city has heard of.
    assert.equal(curatedAddressEn('רידינג  35'), 'Reading 35');
  });

  it('folds the export artefact of a doubled space', () => {
    assert.equal(curatedAddressEn('נח  20'), 'Noach 20');
  });

  it('is null for a street nobody has curated, never a machine guess', () => {
    // Null makes localisedAddress fall back to the Hebrew, which is true. A
    // transliteration of unpointed Hebrew reads as nonsense, and nonsense in
    // Latin letters is worse than Hebrew a visitor can at least photograph.
    assert.equal(curatedAddressEn('רחוב שאיש לא תעתק 9'), null);
  });

  it('writes the whole address out where there is no street to look up', () => {
    assert.equal(
      curatedAddressEn('קניון רמת אביב, איינשטיין 40, קומה -1'),
      'Ramat Aviv Mall, Einstein 40, level -1',
    );
  });
});

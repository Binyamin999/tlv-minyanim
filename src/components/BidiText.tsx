import { Fragment, type ReactNode } from 'react';

import { splitSignedNumbers } from '@/lib/bidi';

/**
 * Text with any signed numbers isolated, so `קומה -1` does not read `1-`.
 * The reasoning is in `@/lib/bidi`; this is only the markup for it.
 *
 * `dir="ltr"` and not a bare `<bdi>`: bare `<bdi>` is `dir="auto"`, `-1`
 * contains no strong character for auto to detect, and auto then falls back to
 * the paragraph direction — the same bug with more markup.
 */
export function bidiText(text: string): ReactNode {
  const segments = splitSignedNumbers(text);
  if (segments.length === 1) return text;
  return segments.map((segment, i) =>
    segment.isolate ? (
      <bdi dir="ltr" key={i}>
        {segment.text}
      </bdi>
    ) : (
      <Fragment key={i}>{segment.text}</Fragment>
    ),
  );
}

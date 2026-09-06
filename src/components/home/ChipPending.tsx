'use client';

import { useLinkStatus } from 'next/link';

/**
 * The tap acknowledged, immediately.
 *
 * Every filter chip is a real link to a real URL, which is deliberate — each
 * filtered view has to be a page a crawler can follow and a person can send.
 * The cost is that a tap is a server round trip, and until the server answers
 * the page shows no sign that anything happened. On a phone that reads as the
 * button not having worked, so people tap again.
 *
 * Server time is ~300 ms, which is the floor for a page that recomputes how
 * many minutes until the next minyan on every request. This closes the gap the
 * other way: `useLinkStatus` reports the pending state of the enclosing Link,
 * so the chip can say "heard you" in the same frame as the tap.
 *
 * Rendered inside the Link rather than around it, which is what the hook
 * requires — it reads the navigation state of its nearest Link ancestor.
 */
export function ChipPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="chip-pending" aria-hidden="true" />;
}

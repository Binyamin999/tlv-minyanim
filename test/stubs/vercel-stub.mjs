#!/usr/bin/env node
/**
 * A stand-in for the Vercel CLI, so the analytics server's three response
 * shapes can be tested without a login, a network, or a paid plan.
 *
 * `TLV_STUB_MODE` picks the shape. All three are copied from what the real CLI
 * actually did on 2026-09-06, including the one that matters: with `--json` a
 * refusal arrives as an error OBJECT on stdout with exit code 1, which is why
 * it is so easy to mistake for an empty result.
 */
const mode = process.env.TLV_STUB_MODE ?? 'empty';
const query = {
  metric: 'vercel.analytics_pageview.count',
  startTime: '2026-09-05T17:52:00.000Z',
  endTime: '2026-09-06T17:52:00.000Z',
};

if (mode === 'refused') {
  process.stdout.write(
    JSON.stringify({
      error: {
        code: 'payment_required',
        message: 'Observability Plus is required to run this query for team binyamin999.',
      },
    }),
  );
  process.exit(1);
}

if (mode === 'data') {
  process.stdout.write(
    JSON.stringify({
      query,
      summary: [],
      data: [
        { timestamp: '2026-09-06T15:00:00.000Z', value: 5 },
        { timestamp: '2026-09-06T16:00:00.000Z', value: 3 },
      ],
    }),
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({ query, summary: [], data: [] }));
process.exit(0);

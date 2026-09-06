#!/usr/bin/env node
/**
 * An MCP server that can read this site's traffic and do nothing else.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS RATHER THAN VERCEL'S OWN MCP
 * ---------------------------------------------------------------------------
 * Vercel publishes an official server at https://mcp.vercel.com, and it is
 * better than this one at everything except the one property that matters
 * here: authorising it grants an assistant the same access as the Vercel
 * account. Projects, deployments, runtime logs, environment variables — and
 * `DATABASE_URL` is an environment variable on this project. The question
 * asked was "how many people visited", and the answer should not come with
 * the ability to read the database credentials.
 *
 * So this is the narrow version. It is read-only by construction, not by
 * policy:
 *
 *   - The subprocess is always `vercel metrics`. The subcommand is a string
 *     literal in this file; no argument can change it, and `vercel metrics`
 *     has no write mode to reach even if one could.
 *   - Every argv element is either a literal or a value validated here — an
 *     integer in a range, or a member of an allowlist. Nothing is
 *     interpolated into a string.
 *   - `execFile`, never `exec`. There is no shell, so there is no shell to
 *     inject into.
 *   - There is no code in this file that writes anything, anywhere.
 *
 * ---------------------------------------------------------------------------
 * ZERO DEPENDENCIES
 * ---------------------------------------------------------------------------
 * MCP over stdio is newline-delimited JSON-RPC 2.0 and the surface needed for
 * a tools-only server is four methods. Pulling in an SDK to write those forty
 * lines would put a dependency in a repository that has six, to save less code
 * than this comment.
 *
 * ---------------------------------------------------------------------------
 * AUTHENTICATION IS THE ONE THING THIS CANNOT DO FOR YOU
 * ---------------------------------------------------------------------------
 * Reading private analytics means proving you are the account holder. That is
 * `npx vercel login`, once, in a terminal — it opens a browser, and the
 * session is stored globally so it survives reinstalls of this project. Until
 * then every tool here returns that instruction instead of a number. No token
 * is stored in this repository and none should be.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERCEL = path.join(ROOT, 'node_modules', '.bin', 'vercel');

/** The Vercel project. A literal, so no tool call can point this elsewhere. */
const PROJECT = 'tlv-minyanim';

/** The only metric this server knows how to ask for. */
const PAGEVIEWS = 'vercel.analytics_pageview.count';

/** Unique people rather than page loads: one visitor id counted once. */
const UNIQUE_VISITORS = 'unique/visitor_id';

/**
 * The dimensions a breakdown may group by.
 *
 * An allowlist rather than a pattern. Not for safety — there is no shell, so a
 * bad value is a failed request and nothing worse — but because a closed list
 * is the honest description of what this server does. `analytics_schema` asks
 * Vercel for the authoritative set when this one turns out to be short.
 */
const DIMENSIONS = new Set([
  'country',
  'request_path',
  'route',
  'device_type',
  'browser_name',
  'operating_system',
  'referrer_hostname',
]);

const MAX_DAYS = 90;
const TIMEOUT_MS = 45_000;

/** Run `vercel metrics` with a fully literal-or-validated argv. */
function metrics(args) {
  return new Promise((resolve) => {
    execFile(
      VERCEL,
      ['metrics', ...args, '--project', PROJECT, '--prod', '--json', '--non-interactive'],
      { cwd: ROOT, timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = `${stdout ?? ''}\n${stderr ?? ''}`;
        if (/not authenticated|log in|logged out|credentials/i.test(output)) {
          resolve({
            ok: false,
            text:
              'Not signed in to Vercel. This is the one step that cannot be automated — ' +
              'reading private analytics means proving account ownership.\n\n' +
              'Run once, in a terminal:\n\n    npx vercel login\n\n' +
              'It opens a browser and stores the session globally, so it is not needed again.',
          });
          return;
        }
        if (error) {
          resolve({ ok: false, text: `vercel metrics failed:\n${output.trim()}` });
          return;
        }
        try {
          resolve({ ok: true, data: JSON.parse(stdout) });
        } catch {
          // The CLI's JSON shape is not contractual. Handing back what it
          // actually said beats guessing at a field name and reporting a
          // confident zero.
          resolve({ ok: true, raw: stdout.trim() });
        }
      },
    );
  });
}

/** Whole days, clamped — the only numeric input this server accepts. */
function days(value, fallback) {
  const n = Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(MAX_DAYS, Math.max(1, n));
}

function limit(value, fallback) {
  const n = Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(50, Math.max(1, n));
}

function render(result) {
  if (!result.ok) return result.text;
  if (result.raw !== undefined) return result.raw;
  return JSON.stringify(result.data, null, 2);
}

const TOOLS = [
  {
    name: 'traffic_summary',
    description:
      'Total page views and unique visitors for tlv-minyanim over the last N days. ' +
      'Bots are excluded by Vercel; these are browsers that actually loaded the page.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: MAX_DAYS, default: 7 },
      },
    },
    async run(args) {
      const window = days(args.days, 7);
      const [views, people] = await Promise.all([
        metrics([PAGEVIEWS, '--since', `${window}d`]),
        metrics([PAGEVIEWS, '--since', `${window}d`, '--aggregation', UNIQUE_VISITORS]),
      ]);
      if (!views.ok) return views.text;
      return `Last ${window} day(s).\n\nPAGE VIEWS\n${render(views)}\n\nUNIQUE VISITORS\n${render(people)}`;
    },
  },
  {
    name: 'traffic_by_day',
    description: 'Page views per day for tlv-minyanim, one row per calendar day.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: MAX_DAYS, default: 14 },
      },
    },
    async run(args) {
      const window = days(args.days, 14);
      return render(await metrics([PAGEVIEWS, '--since', `${window}d`, '--granularity', '1d']));
    },
  },
  {
    name: 'traffic_breakdown',
    description:
      'Page views grouped by one dimension — which pages, which countries, which devices. ' +
      'Use request_path for exact URLs and route for the framework pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        dimension: { type: 'string', enum: [...DIMENSIONS] },
        days: { type: 'integer', minimum: 1, maximum: MAX_DAYS, default: 7 },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
      required: ['dimension'],
    },
    async run(args) {
      if (!DIMENSIONS.has(args.dimension)) {
        return `Unknown dimension. This server groups by: ${[...DIMENSIONS].join(', ')}.`;
      }
      const window = days(args.days, 7);
      return render(
        await metrics([
          PAGEVIEWS,
          '--since',
          `${window}d`,
          '--group-by',
          args.dimension,
          '--limit',
          String(limit(args.limit, 10)),
        ]),
      );
    },
  },
  {
    name: 'analytics_schema',
    description:
      'The metrics, dimensions and aggregations Vercel actually offers for page views. ' +
      'Authoritative, unlike this server\'s own dimension list, which was written from docs.',
    inputSchema: { type: 'object', properties: {} },
    async run() {
      return render(await metrics(['schema', 'vercel.analytics_pageview']));
    },
  },
];

/* -------------------------------------------------------------------------
   MCP: newline-delimited JSON-RPC 2.0 on stdin/stdout.

   Note that a notification — a message with no `id` — gets no reply at all,
   not a reply with a null id. `notifications/initialized` arrives right after
   the handshake and answering it is a protocol error.
   ------------------------------------------------------------------------- */

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(message) {
  const { id, method, params } = message;
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case 'initialize':
      reply(id, {
        // Echo the client's version when it names one: this server's surface
        // is stable across every revision that has existed.
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'tlv-minyanim-analytics', version: '1.0.0' },
      });
      return;

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return;

    case 'ping':
      if (isRequest) reply(id, {});
      return;

    case 'tools/list':
      reply(
        id,
        { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
      );
      return;

    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) {
        fail(id, -32602, `Unknown tool: ${params?.name}`);
        return;
      }
      try {
        const text = await tool.run(params?.arguments ?? {});
        reply(id, { content: [{ type: 'text', text }] });
      } catch (error) {
        reply(id, {
          content: [{ type: 'text', text: `Failed: ${error?.message ?? String(error)}` }],
          isError: true,
        });
      }
      return;
    }

    default:
      if (isRequest) fail(id, -32601, `Method not found: ${method}`);
  }
}

createInterface({ input: process.stdin }).on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return; // Not addressed to anything; there is no id to answer.
  }
  void handle(message);
});

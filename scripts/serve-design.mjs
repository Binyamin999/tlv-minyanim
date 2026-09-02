#!/usr/bin/env node
/**
 * Serve the design artboards, and nothing else.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * `python3 -m http.server` serves the directory it is started in, which for
 * this repo means everything: `.env.local`, `.git/`, and `data/seed-*.json` —
 * 442 gabbai and rabbi phone numbers, gitignored precisely because Israeli
 * privacy law makes them personal data we may not publish.
 *
 * That happened twice. Once bound to every interface, so any device on the
 * wifi could have fetched the seed file; once to localhost. Neither is known
 * to have leaked, and both were one typo away from the same outcome. A static
 * server pointed at a repo root cannot be made safe by remembering to be
 * careful, so this one cannot be pointed anywhere else.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT GUARANTEES
 * ---------------------------------------------------------------------------
 *   - The served root is `design/`, resolved once at startup and never taken
 *     from a request, a flag or an environment variable.
 *   - Every resolved path is checked to still be inside that root, so `..`,
 *     an encoded `%2e%2e`, and a symlink pointing out all fail the same way.
 *   - It binds 127.0.0.1 and takes no host argument. The artboards are for
 *     the person at this machine; nothing here needs to be on the network.
 *
 * Usage:  node scripts/serve-design.mjs [port]
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
/** The only directory this process will ever read from. */
const ROOT = await realpath(join(REPO, 'design'));
const PORT = Number(process.argv[2] ?? 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

/**
 * The requested path, or null if it escapes the root.
 *
 * `realpath` is what makes this a containment check rather than a string
 * comparison: it resolves `..` and follows symlinks first, so the answer is
 * about where the file actually IS, not about how it was spelled.
 */
async function resolveInsideRoot(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(ROOT, '.' + (decoded === '/' ? '/_preview.html' : decoded));
  try {
    const real = await realpath(candidate);
    if (real !== ROOT && !real.startsWith(ROOT + sep)) return null;
    const info = await stat(real);
    return info.isFile() ? real : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const file = await resolveInsideRoot(req.url ?? '/');
  if (!file) {
    // One answer for missing and for refused. A different message for a
    // rejected traversal would confirm that the path exists outside the root.
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

// 127.0.0.1, hard-coded. No flag, no env var, no argument.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`design artboards on http://127.0.0.1:${PORT}/  (serving ${ROOT} only)`);
});

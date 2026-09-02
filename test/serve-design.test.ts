/**
 * A static server must not be able to reach the repo root.
 *
 * `data/seed-*.json` holds 442 gabbai and rabbi phone numbers. It is
 * gitignored because Israeli privacy law makes them personal data, and a
 * static file server does not read .gitignore. Twice a `python3 -m
 * http.server` was started in this repo's root — once bound to every
 * interface — and both times that file was one URL away.
 *
 * These tests are the guard. The first stops the pattern coming back in
 * configuration; the rest prove the replacement actually contains.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

describe('no launch config can serve the repo root', () => {
  it('uses the contained server, never python -m http.server', () => {
    const launch = JSON.parse(readFileSync('.claude/launch.json', 'utf8'));
    for (const config of launch.configurations) {
      const command = [config.runtimeExecutable, ...(config.runtimeArgs ?? [])].join(' ');
      assert.ok(
        !/http\.server/.test(command),
        `"${config.name}" starts a python static server, which serves the directory ` +
          'it is run from — here, the repo root including data/seed-*.json. Use ' +
          'scripts/serve-design.mjs, which can only read design/.',
      );
    }
  });

  it('every static server is the design one, on localhost', () => {
    const launch = JSON.parse(readFileSync('.claude/launch.json', 'utf8'));
    for (const config of launch.configurations) {
      const command = [config.runtimeExecutable, ...(config.runtimeArgs ?? [])].join(' ');
      if (!/serve|http|server/.test(command)) continue;
      if (/npm run dev/.test(command)) continue; // the app itself, not a file server
      assert.match(command, /serve-design\.mjs/, `"${config.name}" serves files another way`);
    }
  });
});

describe('the design server contains itself', () => {
  /** Start it on a spare port, run the checks, always kill it. */
  async function withServer(port: number, fn: (base: string) => Promise<void>) {
    const child = spawn('node', ['scripts/serve-design.mjs', String(port)], { stdio: 'ignore' });
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 40; i++) {
        try {
          await fetch(base + '/');
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      await fn(base);
    } finally {
      child.kill('SIGKILL');
    }
  }

  it('serves an artboard and refuses everything outside design/', async () => {
    await withServer(4399, async (base) => {
      const preview = await fetch(`${base}/_preview.html`);
      assert.equal(preview.status, 200, 'the artboards themselves must still be served');

      // The file this whole guard exists for, by every spelling worth trying.
      const escapes = [
        '/../data/seed-ramat-aviv.json',
        '/../../data/seed-ramat-aviv.json',
        '/%2e%2e/data/seed-ramat-aviv.json',
        '/..%2fdata%2fseed-ramat-aviv.json',
        '/../.env.local',
        '/../package.json',
        '/../.git/config',
      ];
      for (const path of escapes) {
        const res = await fetch(base + path, { redirect: 'manual' });
        assert.equal(res.status, 404, `${path} was not refused`);
        const body = await res.text();
        assert.ok(!body.includes('gabbai'), `${path} returned repo content`);
        assert.ok(!/05\d-|\+972/.test(body), `${path} returned something phone-shaped`);
      }
    });
  });

  it('is not reachable from anywhere but this machine', async () => {
    // It binds 127.0.0.1 with no host argument, so there is nothing to
    // misconfigure. Asserted on the source, because binding to a LAN address
    // in a test would be the very thing being prevented.
    const source = readFileSync('scripts/serve-design.mjs', 'utf8');
    assert.match(source, /server\.listen\(PORT, '127\.0\.0\.1'/);
    assert.ok(!/0\.0\.0\.0/.test(source), 'no path to binding every interface');
  });
});

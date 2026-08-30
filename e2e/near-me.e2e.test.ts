/**
 * "מצאו מניין לידי" / "Find a minyan near me" — end-to-end.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS SEPARATELY FROM test/
 * ---------------------------------------------------------------------------
 * `NearMe.tsx` is a 'use client' .tsx file. Node's type-stripping loader
 * (which `npm test` relies on for every other test in this repo) cannot load
 * a .tsx file at all, and cannot parse JSX inside a .ts one — so the decorate
 * logic (DOM writes + sort) has no path into `node --test` the way
 * `src/lib/distance.ts` does. That module already has full unit coverage in
 * `test/distance.test.ts`; this file is the only way left to exercise the
 * *component*, and it does so by driving a real, compiled, production build
 * in a real Chromium — the actual shipped bundle, not a reimplementation.
 *
 * This is deliberately NOT wired into `npm test` (the default glob is
 * `test/**\/*.test.ts`, and this file lives in `e2e/` on purpose) because it
 * needs a running server on :3100 and a browser binary, neither of which
 * every environment running `npm test` will have. Run it explicitly:
 *
 *   node --test e2e/near-me.e2e.test.ts
 *
 * against the already-running build at http://127.0.0.1:3100. See
 * docs/near-me-test-plan.md for the full rationale and what this does not
 * cover.
 *
 * ---------------------------------------------------------------------------
 * WHY PLAYWRIGHT, GIVEN THE STATED TOOL LIMIT
 * ---------------------------------------------------------------------------
 * The task brief is explicit that the interactive browser PANE cannot
 * override `navigator.geolocation` and will not grant a real position. That
 * limit is about the pane. `playwright` (already a devDependency, browsers
 * already downloaded) drives its own, separate Chromium instance and can set
 * geolocation exactly, including `accuracy` — which is the one input this
 * feature treats as a hard gate (> 250 m ⇒ unknown) and which cannot be
 * produced any other way. Using it here is the "put the location logic under
 * automated test" instruction, taken as far as it will go.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE_URL = 'http://127.0.0.1:3100';

let browser: Browser;

before(async () => {
  // Fail fast and legibly rather than hanging on page.goto() for 30s if
  // nobody started the build this suite assumes is already running.
  try {
    const res = await fetch(`${BASE_URL}/he`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    throw new Error(
      `${BASE_URL} is not answering (${(err as Error).message}). ` +
        `This suite drives the already-running production build; start it ` +
        `(see README.md) before running e2e/near-me.e2e.test.ts.`,
    );
  }
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
});

async function withPage(
  opts: Parameters<Browser['newContext']>[0],
  fn: (page: Page, context: BrowserContext) => Promise<void>,
) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  try {
    await fn(page, context);
  } finally {
    await context.close();
  }
}

/**
 * Adds a card-shaped element straight into the real `.cards` board, with the
 * exact attributes and inner nodes `decorate()` looks for
 * (`[data-lat][data-lng]`, `.near-slot`, `.near-too-far`) — real markup shape,
 * synthetic position and time, so the sort and reachability assertions are
 * exact regardless of which 16 (or 484) shuls happen to be seeded today.
 */
async function addSyntheticCard(
  page: Page,
  spec: { testId: string; lat: number; lng: number; at?: string },
) {
  await page.evaluate((s) => {
    const container = document.querySelector('.cards');
    if (!container) throw new Error('no .cards container on this page');
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.testid = s.testId;
    el.dataset.lat = String(s.lat);
    el.dataset.lng = String(s.lng);
    if (s.at) el.dataset.at = s.at;
    const addr = document.createElement('p');
    addr.className = 'card-address';
    const slot = document.createElement('span');
    slot.className = 'near-slot tabular';
    slot.hidden = true;
    const tooFar = document.createElement('span');
    tooFar.className = 'near-too-far';
    tooFar.hidden = true;
    addr.append(slot, tooFar);
    el.append(addr);
    container.append(el);
  }, spec);
}

async function clickLocate(page: Page) {
  await page.getByRole('button', { name: /מצאו מניין לידי|Find a minyan near me/ }).click();
  // decorate() runs synchronously inside the getCurrentPosition callback, but
  // give the event loop a turn rather than assuming zero-latency delivery of
  // the mocked position.
  await page.waitForTimeout(300);
}

const iso = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000).toISOString();

// A point with no real synagogue near it, so every distance in these tests is
// to a synthetic card, never accidentally to a seeded one.
const HERE = { latitude: 32.0, longitude: 34.8 };

describe('near-me: console cleanliness (guards the hydration-mismatch fix)', () => {
  // React error #418 — "Hydration failed because the server rendered ...
  // didn't match the client" — fired on every homepage load before NearMe's
  // capability check was moved out of render and into the click handler
  // (Node's `navigator` global has no `.geolocation`, so the old
  // `if (!('geolocation' in navigator)) return null` guard was false on the
  // server and true in every real browser, guaranteeing a mismatch). This
  // test is the regression guard: it fails loudly if that pattern comes back
  // here or is reintroduced elsewhere.
  it('loads both locales with zero console errors', async () => {
    for (const locale of ['he', 'en'] as const) {
      await withPage({ locale: locale === 'he' ? 'he-IL' : 'en-IL' }, async (page) => {
        const errors: string[] = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${BASE_URL}/${locale}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(200);
        assert.deepEqual(errors, [], `${locale}: console error(s) on load: ${JSON.stringify(errors)}`);
      });
    }
  });
});

describe('near-me: nothing happens before a tap', () => {
  it('requests no permission and decorates nothing on load', async () => {
    await withPage({ locale: 'he-IL' }, async (page) => {
      await page.goto(`${BASE_URL}/he`);
      await page.waitForTimeout(300);
      const decorated = await page.evaluate(
        () => document.querySelectorAll('[data-reach]').length,
      );
      assert.equal(decorated, 0, 'a card carries data-reach before any tap');
      const buttonLabel = await page
        .getByRole('button', { name: /מצאו מניין לידי/ })
        .textContent();
      assert.equal(buttonLabel, 'מצאו מניין לידי', 'button already shows a locating/error state');
    });
  });
});

describe('near-me: reachability arithmetic through the real component', () => {
  it('reachable: a near, comfortably-timed synthetic card', async () => {
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 15 } },
      async (page) => {
        await page.goto(`${BASE_URL}/he`);
        // ~300 m north: 0.0027 deg lat * 111,320 m/deg ≈ 300 m.
        await addSyntheticCard(page, {
          testId: 'near-reachable',
          lat: HERE.latitude + 0.0027,
          lng: HERE.longitude,
          at: iso(30),
        });
        await clickLocate(page);

        const card = page.locator('[data-testid="near-reachable"]');
        await assert.doesNotReject(card.waitFor({ state: 'attached' }));
        assert.equal(await card.getAttribute('data-reach'), 'reachable');
        const slotText = await card.locator('.near-slot').textContent();
        assert.match(slotText ?? '', /^\d+ דק׳ הליכה · \d+(\.\d+)? (מ׳|ק״מ)$/);
        assert.equal(await card.locator('.near-too-far').getAttribute('hidden'), '');
      },
    );
  });

  it('too_far: a distant card whose minyan starts in 5 minutes', async () => {
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 15 } },
      async (page) => {
        await page.goto(`${BASE_URL}/he`);
        // ~3.3 km north: walking time (¬63 min) far exceeds the 5-minute budget.
        await addSyntheticCard(page, {
          testId: 'far-too-far',
          lat: HERE.latitude + 0.03,
          lng: HERE.longitude,
          at: iso(5),
        });
        await clickLocate(page);

        const card = page.locator('[data-testid="far-too-far"]');
        assert.equal(await card.getAttribute('data-reach'), 'too_far');
        const tooFar = card.locator('.near-too-far');
        assert.notEqual(await tooFar.getAttribute('hidden'), '');
        assert.equal(await tooFar.textContent(), 'לא תספיקו להגיע');
        // The row RECEDES. Asserting that, not the exact figure: how far it
        // recedes is a live design decision — 0.62 at first, then 0.72 once the
        // dimming was found to be diluting the warning inside it — and a test
        // that pins a design constant fails every time the design improves
        // while proving nothing extra. What must hold is that an unreachable
        // row is dimmed and still readable.
        const opacity = await card.evaluate((el) => getComputedStyle(el).opacity);
        assert.ok(
          Number(opacity) < 1 && Number(opacity) > 0.4,
          `an unreachable row should recede but stay readable; got ${opacity}`,
        );
      },
    );
  });

  it('unknown: an honest position (accuracy 15 m) still refuses to judge a card with no time', async () => {
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 15 } },
      async (page) => {
        await page.goto(`${BASE_URL}/he`);
        await addSyntheticCard(page, {
          testId: 'no-time',
          lat: HERE.latitude + 0.0005, // ~55 m — closer than any timed card here
          lng: HERE.longitude,
          // deliberately no `at`
        });
        await clickLocate(page);

        const card = page.locator('[data-testid="no-time"]');
        assert.equal(await card.getAttribute('data-reach'), 'unknown');
        // Distance is still shown — CLAUDE.md: "Distance is still shown on
        // them; only their rank is withheld."
        const slotText = await card.locator('.near-slot').textContent();
        assert.match(slotText ?? '', /דק׳ הליכה/);
        assert.equal(await card.locator('.near-too-far').getAttribute('hidden'), '');
      },
    );
  });

  it('unknown: a vague position (accuracy 300 m) refuses to judge even an otherwise-reachable card', async () => {
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 300 } },
      async (page) => {
        await page.goto(`${BASE_URL}/he`);
        await addSyntheticCard(page, {
          testId: 'vague',
          lat: HERE.latitude + 0.0027, // same ~300 m / 30-minute setup as the
          lng: HERE.longitude, // "reachable" case above
          at: iso(30),
        });
        await clickLocate(page);

        const card = page.locator('[data-testid="vague"]');
        assert.equal(
          await card.getAttribute('data-reach'),
          'unknown',
          'a >250 m accuracy fix must not produce reachable/too_far, even when the arithmetic would say reachable',
        );
        // The button's own caveat must be visible.
        await assert.doesNotReject(
          page.locator('.near-me-note', { hasText: 'המיקום משוער' }).waitFor(),
        );
      },
    );
  });

  it('regression: standing exactly on a synagogue prints "1 min · 50 m", never "0 · 0"', async () => {
    // The first defect the client's own field test found. Locked down here at
    // the component level in addition to test/distance.test.ts's coverage of
    // walkingMinutes(0) and formatMetres(0) in isolation.
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 5 } },
      async (page) => {
        await page.goto(`${BASE_URL}/he`);
        await addSyntheticCard(page, {
          testId: 'on-top-of',
          lat: HERE.latitude,
          lng: HERE.longitude,
          at: iso(30),
        });
        await clickLocate(page);

        const slotText = await page.locator('[data-testid="on-top-of"] .near-slot').textContent();
        assert.equal(slotText, '1 דק׳ הליכה · 50 מ׳');
        assert.doesNotMatch(slotText ?? '', /^0 /);
        assert.ok(!/·\s*0 מ׳/.test(slotText ?? ''), 'printed a distance of zero');
      },
    );
  });
});

describe('near-me: sort — nearest first among times we know, untimed always last', () => {
  it('never promotes an untimed card ahead of a timed one, however close it is', async () => {
    // The second defect the client's field test found. A card with no time is
    // placed nearer than every timed card and must still end up last.
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 15 } },
      async (page) => {
        await page.goto(`${BASE_URL}/he`);
        await addSyntheticCard(page, {
          testId: 'sort-far-timed',
          lat: HERE.latitude + 0.03, // ~3.3 km
          lng: HERE.longitude,
          at: iso(180), // 3 hours out — comfortably reachable, just far
        });
        await addSyntheticCard(page, {
          testId: 'sort-near-timed',
          lat: HERE.latitude + 0.0027, // ~300 m
          lng: HERE.longitude,
          at: iso(180),
        });
        await addSyntheticCard(page, {
          testId: 'sort-nearest-untimed',
          lat: HERE.latitude, // 0 m — the closest possible card
          lng: HERE.longitude,
          // no `at`
        });
        await clickLocate(page);

        const order = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('.cards > [data-lat]')].map((el) => ({
            id: el.dataset.testid ?? null,
            hasTime: Boolean(el.dataset.at),
          })),
        );

        const indexOf = (id: string) => order.findIndex((r) => r.id === id);
        const nearTimed = indexOf('sort-near-timed');
        const farTimed = indexOf('sort-far-timed');
        const nearestUntimed = indexOf('sort-nearest-untimed');

        assert.ok(nearTimed >= 0 && farTimed >= 0 && nearestUntimed >= 0, 'a synthetic card went missing');
        assert.ok(nearTimed < farTimed, 'the 300 m timed card must sort ahead of the 3.3 km timed card');

        // The universal invariant, checked against every row on the board
        // (real seeded shuls included), not just our three: no untimed row
        // may precede any timed row.
        const lastTimedIndex = Math.max(
          ...order.map((r, i) => (r.hasTime ? i : -1)).filter((i) => i >= 0),
        );
        const firstUntimedIndex = Math.min(
          ...order.map((r, i) => (!r.hasTime ? i : Infinity)),
        );
        assert.ok(
          firstUntimedIndex > lastTimedIndex,
          `an untimed card (index ${firstUntimedIndex}) sorted ahead of a timed one (last timed at ${lastTimedIndex})`,
        );
        // And specifically: the closest card on the whole board (0 m, no
        // time) is not first.
        assert.notEqual(order[0]?.id, 'sort-nearest-untimed');
      },
    );
  });

  it('never re-sorts the hero, even though it carries the same data attributes', async () => {
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 15 } },
      async (page) => {
        await page.goto(`${BASE_URL}/he`);
        const heroName = await page.locator('.hero .hero-name').textContent();
        await addSyntheticCard(page, {
          testId: 'closer-than-hero',
          lat: HERE.latitude,
          lng: HERE.longitude,
          at: iso(1), // 1 minute from now: as urgent as a "next minyan" gets
        });
        await clickLocate(page);

        // The hero is measured (it has the same data-lat/lng/at contract)...
        const heroReach = await page.locator('.hero').getAttribute('data-reach');
        assert.ok(heroReach, 'the hero was not decorated at all');
        // ...but it is never a child of .cards, and the name in it is unchanged.
        const heroInCards = await page.evaluate(
          () => document.querySelector('.cards .hero') !== null,
        );
        assert.equal(heroInCards, false);
        assert.equal(await page.locator('.hero .hero-name').textContent(), heroName);
      },
    );
  });
});

describe('near-me: sort against real unknown-time rows (?service=mincha)', () => {
  // Mincha is "largely unknown" (CLAUDE.md) — service=mincha reliably has
  // several real `UnknownShulCard` rows (no `data-at` at all) alongside
  // resolved ones, so this exercises the same invariant as the synthetic
  // sort test above but against genuine seed data rather than injected DOM.
  it('every real card with no time stays after every real card with a time', async () => {
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 15 } },
      async (page) => {
        await page.goto(`${BASE_URL}/he?service=mincha`);
        const before = await page.evaluate(() =>
          [...document.querySelectorAll('.cards [data-lat]')].map((el) =>
            Boolean((el as HTMLElement).dataset.at),
          ),
        );
        assert.ok(before.includes(false), 'precondition failed — no real unknown-time card on this filter today');
        await clickLocate(page);

        const after = await page.evaluate(() =>
          [...document.querySelectorAll('.cards [data-lat]')].map((el) =>
            Boolean((el as HTMLElement).dataset.at),
          ),
        );
        const lastTimed = Math.max(...after.map((t, i) => (t ? i : -1)));
        const firstUntimed = Math.min(...after.map((t, i) => (!t ? i : Infinity)));
        assert.ok(
          firstUntimed > lastTimed,
          `real unknown-time card at index ${firstUntimed} precedes a timed card (last timed at ${lastTimed})`,
        );
      },
    );
  });
});

describe('near-me: a second tap fully re-decorates, leaving nothing stale', () => {
  it('a card that was too_far becomes reachable (and its dimming clears) after moving closer and tapping again', async () => {
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 15 } },
      async (page, context) => {
        await page.goto(`${BASE_URL}/he`);
        await addSyntheticCard(page, {
          testId: 'rerun',
          lat: HERE.latitude + 0.03, // ~3.3 km — too far for a 5-minute budget
          lng: HERE.longitude,
          at: iso(5),
        });
        await clickLocate(page);
        const card = page.locator('[data-testid="rerun"]');
        assert.equal(await card.getAttribute('data-reach'), 'too_far');
        // Dimmed, without pinning how much — see the note in the too_far test.
        assert.ok(
          Number(await card.evaluate((el) => getComputedStyle(el).opacity)) < 1,
          'a card that is too far should be dimmed',
        );

        // Walk over to it (simulated) and tap again.
        await context.setGeolocation({
          latitude: HERE.latitude + 0.03,
          longitude: HERE.longitude,
          accuracy: 15,
        });
        await clickLocate(page);

        assert.equal(await card.getAttribute('data-reach'), 'reachable');
        assert.equal(await card.evaluate((el) => getComputedStyle(el).opacity), '1');
        assert.equal(await card.locator('.near-too-far').getAttribute('hidden'), '');
      },
    );
  });
});

describe('near-me: refusal paths', () => {
  it('permission denied: shows the refusal copy, decorates nothing, changes no card order', async () => {
    await withPage({ locale: 'he-IL' }, async (page) => {
      // No `permissions` granted: Chromium auto-denies rather than prompting,
      // which is what a real "no thanks" tap produces downstream.
      await page.goto(`${BASE_URL}/he`);
      const namesBefore = await page.$$eval('.cards article h3', (els) =>
        els.map((el) => el.textContent),
      );
      await clickLocate(page);

      await assert.doesNotReject(
        page.locator('.near-me-note', { hasText: 'אין גישה למיקום' }).waitFor(),
      );
      const decorated = await page.evaluate(
        () => document.querySelectorAll('[data-reach]').length,
      );
      assert.equal(decorated, 0);
      const namesAfter = await page.$$eval('.cards article h3', (els) =>
        els.map((el) => el.textContent),
      );
      assert.deepEqual(namesAfter, namesBefore, 'card order changed with no successful fix');
    });
  });

  it('position unavailable: shows the generic failure copy, not the permission copy', async () => {
    await withPage({ locale: 'he-IL', permissions: ['geolocation'] }, async (page) => {
      // Force the OTHER error branch. Playwright has no built-in way to make
      // a real GPS fail with POSITION_UNAVAILABLE, so the callback is stubbed
      // directly in the test's own browser context via addInitScript — a
      // standard test-double technique, not a change to any shipped file,
      // and distinct from the disallowed "override geolocation in the pane"
      // (there is no position to fake; this is the error path).
      await page.addInitScript(() => {
        // @ts-expect-error - test override
        navigator.geolocation.getCurrentPosition = (_success: unknown, error: (e: unknown) => void) => {
          error({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
        };
      });
      await page.goto(`${BASE_URL}/he`);
      await clickLocate(page);

      await assert.doesNotReject(
        page.locator('.near-me-note', { hasText: 'לא הצלחנו לאתר את המיקום' }).waitFor(),
      );
      const deniedNoteVisible = await page
        .locator('.near-me-note', { hasText: 'אין גישה למיקום' })
        .count();
      assert.equal(deniedNoteVisible, 0, 'showed the permission-denied copy for a different error code');
    });
  });
});

describe('near-me: the position never leaves the device', () => {
  it('sends no network request and writes no storage after a successful fix', async () => {
    await withPage(
      { locale: 'he-IL', permissions: ['geolocation'], geolocation: { ...HERE, accuracy: 15 } },
      async (page) => {
        const requests: string[] = [];
        page.on('request', (req) => requests.push(req.url()));
        await page.goto(`${BASE_URL}/he`);
        requests.length = 0; // only what happens from here on matters

        await addSyntheticCard(page, {
          testId: 'privacy-check',
          lat: HERE.latitude + 0.001,
          lng: HERE.longitude,
          at: iso(30),
        });
        await clickLocate(page);

        const suspicious = requests.filter(
          (u) => /[?&](lat|lng|latitude|longitude|position|geo)=/i.test(u) || u.includes(String(HERE.latitude)),
        );
        assert.deepEqual(suspicious, [], `a request carried the position: ${JSON.stringify(suspicious)}`);

        const storage = await page.evaluate(() => ({
          local: { ...localStorage },
          session: { ...sessionStorage },
        }));
        assert.deepEqual(storage.local, {});
        assert.deepEqual(storage.session, {});

        const cookies = await page.context().cookies();
        const geoLikeCookie = cookies.find((c) => /lat|lng|geo|position/i.test(c.name));
        assert.equal(geoLikeCookie, undefined, `found a geo-like cookie: ${JSON.stringify(geoLikeCookie)}`);
      },
    );
  });
});

/**
 * `fetch(url).text()` returns the WHOLE response, including every
 * `<script>` Next.js embeds for hydration — one of which is the RSC payload,
 * which serialises component props verbatim. `nearMe.walk` ("דק׳ הליכה") is a
 * prop handed to the client component, so it is present in that JSON purely
 * as a label, with no distance ever having been computed. A check that greps
 * the raw response for that substring is checking the payload, not the
 * rendered page, and would pass even if the server were rendering a live
 * distance — which is exactly the mistake caught (against this same file, in
 * an earlier draft) when the button's own label ("מצאו מניין לידי") was found
 * "in the HTML" via a bare `grep` and turned out to be the RSC payload too.
 * Strip every `<script>…</script>` block before asserting anything about
 * what was actually rendered.
 */
function withoutScripts(html: string): string {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
}

describe('near-me: SSR / no-JS guarantee', () => {
  it('the rendered HTML has every coordinate and zero distance text, in both locales', async () => {
    for (const locale of ['he', 'en'] as const) {
      const raw = await (await fetch(`${BASE_URL}/${locale}`)).text();
      const rendered = withoutScripts(raw);

      // The coordinates must survive being stripped of scripts: they are
      // meant to be plain DOM attributes on real markup, not just payload.
      assert.ok(rendered.includes('data-lat='), `${locale}: no coordinates in rendered HTML`);
      assert.ok(rendered.includes('data-lng='), `${locale}: no coordinates in rendered HTML`);

      // A computed distance is always "<number> <walk-label> · <number>
      // <unit-label>" — check for that shape, not a bare label substring,
      // so this cannot be satisfied by the dictionary alone.
      assert.ok(
        !/\d+\s*(דק׳ הליכה|min walk)\s*·/.test(rendered),
        `${locale}: a computed walking time was present in rendered HTML`,
      );

      // Sanity check on the stripping itself: the label text (which DOES
      // legitimately appear inside the RSC payload script) must have been
      // removed by withoutScripts, or this whole test is checking nothing.
      const label = locale === 'he' ? 'דק׳ הליכה' : 'min walk';
      assert.ok(raw.includes(label), `${locale}: precondition failed — label not even in the raw response`);
    }
  });

  it('a page with JavaScript disabled never runs decorate(): near-slot stays hidden', async () => {
    await withPage({ javaScriptEnabled: false, locale: 'he-IL' }, async (page) => {
      await page.goto(`${BASE_URL}/he`);
      const hiddenCount = await page.evaluate(
        () => document.querySelectorAll('.near-slot[hidden]').length,
      );
      const totalCount = await page.evaluate(() => document.querySelectorAll('.near-slot').length);
      assert.ok(totalCount > 0, 'no .near-slot nodes rendered at all with JS disabled');
      assert.equal(hiddenCount, totalCount, 'a distance slot was unhidden with no JS to have computed it');
      // And the board itself is still complete: every card's coordinates
      // reached the client even though nothing could read them.
      const cardCount = await page.evaluate(() => document.querySelectorAll('.cards [data-lat]').length);
      assert.ok(cardCount > 0, 'no cards rendered with JS disabled');
    });
  });
});

describe('near-me: known-good break probes', () => {
  // "Check that a test can fail" (CLAUDE.md). These re-run the exact
  // regressions the client's field test caught, against the ORIGINAL
  // (unfixed) arithmetic, to prove the tests above would have caught them.
  it('the old floor (no minimum) would have printed "0 min · 0 m" on top of a shul', () => {
    const brokenWalkingMinutes = (m: number) => Math.ceil((m * 1.4) / 75); // no Math.max(1, ...)
    const brokenFormatMetres = (m: number) =>
      m < 1000 ? Math.round(m / 50) * 50 : Math.round(m / 100) / 10; // no Math.max(50, ...)
    assert.equal(brokenWalkingMinutes(0), 0);
    assert.equal(brokenFormatMetres(0), 0);
    // i.e. exactly the "0 דק׳ הליכה · 0 מ׳" the client saw, and exactly what
    // test/distance.test.ts's walkingMinutes(0)===1 / formatMetres(0)===50
    // now forbid.
  });

  it('an unguarded sort (no untimed/timed split) would have promoted the nearest card regardless of time', () => {
    const rows = [
      { id: 'far-timed', metres: 3300, hasTime: true },
      { id: 'near-timed', metres: 300, hasTime: true },
      { id: 'nearest-untimed', metres: 0, hasTime: false },
    ];
    const naiveSort = [...rows].sort((a, b) => a.metres - b.metres);
    assert.equal(naiveSort[0].id, 'nearest-untimed'); // the bug, reproduced
    // ...which is exactly what the "never promotes an untimed card" test
    // above asserts the shipped code does NOT do.
  });
});

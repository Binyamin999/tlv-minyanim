#!/usr/bin/env node
/**
 * A real browser, standing in a real place.
 *
 * Everything on the homepage can be checked by reading HTML — except the one
 * thing that needs a location, and a location cannot be faked from the page.
 * Overriding `navigator.geolocation.getCurrentPosition` is a stub: it replaces
 * the API rather than exercising it, so it proves the handler runs and proves
 * nothing about permission state, about `coords.accuracy` arriving as a real
 * number, or about what a browser does when a person taps "allow".
 *
 * Playwright grants the permission at the browser-context level and sets a
 * position behind it, so the page's own `navigator.geolocation` resolves for
 * real, through the real code path, with the real permission already decided.
 * That is as close to a person standing on Eliyahu Hakim with a phone as
 * automation gets.
 *
 * Usage:
 *   node scripts/browse.mjs --at klal --shot /tmp/a.png
 *   node scripts/browse.mjs --lat 32.075 --lng 34.775 --width 375 --mode dark
 *   node scripts/browse.mjs --at heichal --deny          # refuse permission
 *   node scripts/browse.mjs --at klal --accuracy 600     # a vague fix
 *   node scripts/browse.mjs --at klal --soon 5           # next minyan in 5 min
 *
 * Prints a JSON report of what the page actually says. Writes a PNG with
 * --shot. Never modifies the site.
 */
import { chromium } from 'playwright';

/** Places worth standing in, so a caller does not have to look up coordinates. */
const PLACES = {
  klal: { lat: 32.12615434145014, lng: 34.80098522868166, what: 'כלל ישראל, Eliyahu Hakim 5' },
  heichal: { lat: 32.1213, lng: 34.8032, what: 'היכל חיים, Oppenheimer 5' },
  mall: { lat: 32.11222, lng: 34.79583, what: 'Ramat Aviv Mall' },
  university: { lat: 32.1133, lng: 34.8044, what: 'Tel Aviv University' },
  // Deliberately outside coverage: everything is 4 km away and the feature is
  // correct and useless, which is a state worth being able to look at.
  dizengoff: { lat: 32.0753, lng: 34.7749, what: 'Dizengoff Center — outside coverage' },
};

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const place = arg('at', 'klal');
const known = PLACES[place];
const lat = Number(arg('lat', known?.lat));
const lng = Number(arg('lng', known?.lng));
const accuracy = Number(arg('accuracy', 15));
const width = Number(arg('width', 375));
const height = Number(arg('height', 900));
/**
 * Light or dark.
 *
 * NOT `prefers-color-scheme`: this site follows the sky, taking dark from real
 * shkia and light from real netz, so the OS setting changes nothing and a
 * `colorScheme` context option silently produced identical screenshots. The
 * only genuine control is the reader's own override, which lives in a cookie —
 * so that is what this sets, exactly as the in-page toggle does.
 */
const mode = arg('mode', null); // 'light' | 'dark' | null = follow the sky
const locale = arg('locale', 'he');
const base = arg('base', 'http://127.0.0.1:3100');
const deny = Boolean(arg('deny', false));
const soon = arg('soon', null);
const shot = arg('shot', null);
const noTap = Boolean(arg('no-tap', false));

if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
  console.error(`Unknown place "${place}". Known: ${Object.keys(PLACES).join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
  locale: locale === 'he' ? 'he-IL' : 'en-IL',
  timezoneId: 'Asia/Jerusalem',
  // The real grant. `permissions: []` leaves geolocation denied, which is what
  // a visitor who taps "block" gets — not an error we invented.
  permissions: deny ? [] : ['geolocation'],
  geolocation: { latitude: lat, longitude: lng, accuracy },
});

if (mode) {
  await context.addCookies([
    { name: 'tlv-mode', value: mode, url: base },
  ]);
}

const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(`${base}/${locale}`, { waitUntil: 'networkidle' });

// What the server sent, before any of this ran. The whole SEO argument.
const beforeTap = await page.evaluate(() => ({
  cards: document.querySelectorAll('.cards .card').length,
  hero: !!document.querySelector('.hero-clock'),
  distancesShown: [...document.querySelectorAll('.near-slot')].filter((s) => !s.hidden).length,
}));

// Optionally pretend the next minyan is minutes away, to reach the state where
// a real board is not far enough ahead to be walkable. The clock cannot be
// wound forward, so the row's own instant is moved instead.
if (soon) {
  await page.evaluate((mins) => {
    const hero = document.querySelector('.hero');
    if (hero) hero.dataset.at = new Date(Date.now() + Number(mins) * 60000).toISOString();
  }, soon);
}

let tapped = false;
if (!noTap) {
  const button = page.locator('.near-me-button');
  if (await button.count()) {
    await button.click();
    // The board is decorated synchronously once the position resolves; a real
    // fix still takes a moment to arrive.
    await page.waitForTimeout(1500);
    tapped = true;
  }
}

const report = await page.evaluate(() => {
  const read = (el) => ({
    shul: el.querySelector('.card-name, .hero-name')?.textContent?.trim(),
    clock: el.querySelector('.card-clock, .hero-clock')?.textContent?.trim(),
    near: el.querySelector('.near-slot')?.hidden ? null : el.querySelector('.near-slot')?.textContent,
    reach: el.dataset.reach ?? null,
    warn:
      el.querySelector('.near-too-far') && !el.querySelector('.near-too-far').hidden
        ? el.querySelector('.near-too-far').textContent
        : null,
    opacity: getComputedStyle(el).opacity,
    timed: !!el.dataset.at,
  });
  const hero = document.querySelector('.hero');
  return {
    note: document.querySelector('.near-me-note')?.textContent ?? null,
    button: document.querySelector('.near-me-button')?.textContent ?? null,
    hero: hero ? read(hero) : null,
    cards: [...document.querySelectorAll('.cards .card')].map(read),
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    // Nothing about the position may be persisted anywhere.
    storage: {
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    },
  };
});

if (shot) {
  await page.screenshot({ path: shot, fullPage: true });
}

console.log(
  JSON.stringify(
    {
      standing: known?.what ?? `${lat}, ${lng}`,
      viewport: `${width}x${height}`,
      mode: mode ?? 'auto (follows shkia)',
      locale,
      permission: deny ? 'denied' : 'granted',
      accuracyMetres: accuracy,
      tapped,
      beforeTap,
      report,
      consoleErrors,
      shot: shot || null,
    },
    null,
    1,
  ),
);

await browser.close();

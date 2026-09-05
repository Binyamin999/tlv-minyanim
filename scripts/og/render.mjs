#!/usr/bin/env node
/**
 * Render the link-preview cards.
 *
 * WHY A REAL BROWSER, AND NOT next/og. Satori — what `ImageResponse` uses —
 * does its own text layout, and its bidi handling is not Chromium's. This card
 * is mostly Hebrew, and a preview image is the first thing anyone sees of the
 * site; getting the RTL subtly wrong there would be a poor advertisement for a
 * project whose whole claim is that it handles Hebrew properly. Chromium lays
 * it out exactly as the site does, because it is the same engine.
 *
 * The photographs cannot be used: tlv-day.jpg is 679px wide against the
 * 1200x630 a card needs, and CLAUDE.md forbids upscaling one past 1x.
 *
 * NO TIME APPEARS ON THE CARD. A shared image is cached for weeks by every
 * chat app that touches it, so any clock face on it would be wrong within the
 * hour and unfixable. The services are named; none is given a time.
 *
 *   node scripts/og/render.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const COPY = {
  he: {
    dir: 'rtl',
    brand: 'מניינים תל אביב',
    tagline: 'איפה אפשר להתפלל עכשיו',
    sub: 'זמני תפילה מדויקים, לפי השקיעה — לא ניחוש',
    services: ['שחרית', 'מנחה', 'ערבית'],
    where: 'רמת אביב · תל אביב-יפו',
  },
  en: {
    dir: 'ltr',
    brand: 'TLV Minyanim',
    tagline: 'Where you can daven right now',
    sub: 'Prayer times computed from sunset — never guessed',
    services: ['Shacharit', 'Mincha', 'Arvit'],
    where: 'Ramat Aviv · Tel Aviv-Yafo',
  },
};

const browser = await chromium.launch();
for (const [locale, copy] of Object.entries(COPY)) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto('file://' + HERE + 'card.html', { waitUntil: 'networkidle' });
  await page.evaluate((c) => {
    document.body.setAttribute('dir', c.dir);
    document.documentElement.lang = c.dir === 'rtl' ? 'he' : 'en';
    document.getElementById('brand').textContent = c.brand;
    document.getElementById('tagline').textContent = c.tagline;
    document.getElementById('sub').textContent = c.sub;
    document.getElementById('where').textContent = c.where;
    document.getElementById('host').textContent = 'tlv-minyanim.vercel.app';
    document.getElementById('services').innerHTML = c.services
      .map((s) => `<span class="pill">${s}</span>`)
      .join('');
  }, copy);
  await page.waitForTimeout(400); // let the woff2 faces settle
  /*
   * JPEG, not PNG, and the reason is WhatsApp rather than taste.
   *
   * WhatsApp skips a preview image it considers too heavy — in practice
   * somewhere around 300 KB — and shows the link bare instead, which looks
   * exactly like having no Open Graph tags at all. The PNG of this card was
   * 387 KB. The card is a gradient behind text, which is the case JPEG was
   * built for: at quality 90 it is 85 KB, four times under the ceiling, with
   * no visible softening of the type at the size a preview is ever shown.
   */
  const out = `${HERE}../../public/og-${locale}.jpg`;
  await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
  console.log(`  wrote public/og-${locale}.jpg`);
  await page.close();
}
await browser.close();

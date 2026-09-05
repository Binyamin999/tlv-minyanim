#!/usr/bin/env node
/**
 * Render the link-preview cards.
 *
 * The card is a photograph of the city beside the headline. Five design
 * directions were built on Bauhaus theory and all five were told "doesn't
 * remind me of Tel Aviv"; the palette that replaced them was sampled from
 * photographs. A card needing an argument for why its geometry evokes a
 * balcony is making that bet a sixth time. A photograph does not need one.
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
import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getDictionary } from '../../src/i18n/dictionaries.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/**
 * The words come from the dictionary, not from here.
 *
 * They were duplicated in this file, in the middleware and in the dictionary —
 * three copies of one headline, which is three chances for the card to promise
 * something the site does not say. Only the layout facts live here.
 */
const COPY = Object.fromEntries(
  (['he', 'en']).map((locale) => {
    const t = getDictionary(locale);
    return [
      locale,
      {
        dir: locale === 'he' ? 'rtl' : 'ltr',
        brand: t.siteName,
        tagline: t.tagline,
        sub: t.ogCardSubhead,
        where: t.ogCardWhere,
      },
    ];
  }),
);

/** Locale to the public path of the card written for it. */
const written = {};

// Old cards are deleted rather than left behind: they are 100 KB each, nothing
// references them once the manifest is rewritten, and a stale one lying around
// is an invitation to point at it by accident.
for await (const stale of glob('public/og-*.jpg')) {
  await rm(stale);
}

const browser = await chromium.launch();
for (const [locale, copy] of Object.entries(COPY)) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
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
    // The photograph sits on the outer edge whichever way the text runs.
    if (c.dir === 'rtl') document.body.style.flexDirection = 'row-reverse';
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
  /*
   * The filename carries a hash of the image, and that is not tidiness.
   *
   * Chat apps cache a preview image BY URL and hold it for weeks. When this
   * card was redesigned the bytes changed completely while the name stayed
   * `og-he.jpg`, so every client that had already fetched it kept showing the
   * old one — or, worse, kept showing a cached failure from before the tags
   * worked at all. A fresh page URL does not help, because the image URL
   * inside it was unchanged.
   *
   * Hashing the content means any future change to this card is a new URL to
   * every cache in the world, automatically, with nothing to remember.
   */
  const bytes = await page.screenshot({ type: 'jpeg', quality: 90 });
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const name = `og-${locale}.${hash}.jpg`;
  await writeFile(`${HERE}../../public/${name}`, bytes);
  written[locale] = `/${name}`;
  console.log(`  wrote public/${name}  (${(bytes.length / 1024).toFixed(1)} KB)`);
  await page.close();
}
await browser.close();

/*
 * The manifest the app reads. Generated rather than hand-maintained, so the
 * hash in the metadata cannot drift from the file on disk — which is the exact
 * failure this whole mechanism exists to prevent, one level up.
 */
await writeFile(
  `${HERE}../../src/lib/og-image.ts`,
  `/**
 * Where each locale's link-preview card lives — GENERATED, do not edit.
 *
 * Written by scripts/og/render.mjs. The filename carries a hash of the image
 * so that redrawing the card is a new URL to every chat app's cache; they hold
 * a preview image by URL for weeks, and a redesign under the old name is
 * invisible to anyone who has already seen it.
 *
 * Run \`node scripts/og/render.mjs\` after changing the card or its copy.
 */
export const OG_IMAGE: Record<'he' | 'en', string> = ${JSON.stringify(written, null, 2)
    .replace(/"([a-z]{2})":/g, "$1:")
    .replace(/"/g, "'")} as const;
`,
);
console.log('  wrote src/lib/og-image.ts');

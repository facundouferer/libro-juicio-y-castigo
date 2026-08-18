/**
 * Screenshots the running preview for visual review.
 *
 * Not part of the build — a development aid for checking the split reader,
 * the modals and the phone layout without clicking through them by hand.
 *
 *   node scripts/shoot.mjs [baseUrl]
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'build', 'shots');
const BASE = process.argv[2] ?? 'http://localhost:4321';

const SHOTS = [
  { name: '01-landing', url: '/', width: 1440, height: 900, scrollTo: 0 },
  { name: '02-contratapa', url: '/', width: 1440, height: 900, scrollTo: 1.0 },
  { name: '03-split-reader', url: '/', width: 1440, height: 900, anchor: '.reader .prose h2' },
  { name: '04-cronica-con-imagen', url: '/', width: 1440, height: 900, anchor: '#la-degradación-total-del-ser' },
  { name: '05-apertura-capitulo', url: '/', width: 1440, height: 900, anchor: '#en-el-lugar-sin-limites' },
  { name: '06-interludio', url: '/', width: 1440, height: 900, anchor: '#chachi' },
  { name: '07-contenido-modal', url: '/', width: 1440, height: 900, click: '#btn-contents' },
  { name: '08-descargar-modal', url: '/', width: 1440, height: 900, click: '#btn-download' },
  { name: '09-colofon', url: '/', width: 1440, height: 900, anchor: '.colophon' },
  { name: '10-edificio', url: '/edificio', width: 1440, height: 900, scrollTo: 0 },
  { name: '11-edificio-grid', url: '/edificio', width: 1440, height: 900, anchor: '#los-planos' },
  { name: '12-movil-lectura', url: '/', width: 390, height: 844, anchor: '#la-degradación-total-del-ser' },
  { name: '13-movil-landing', url: '/', width: 390, height: 844, scrollTo: 0 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    locale: 'es-AR',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${shot.name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${shot.name}: ${message.text().slice(0, 160)}`);
  });

  await page.goto(`${BASE}${shot.url}`, { waitUntil: 'load', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready.then(() => true));

  if (shot.anchor) {
    const found = await page
      .locator(shot.anchor)
      .first()
      .scrollIntoViewIfNeeded({ timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!found) errors.push(`${shot.name}: no encontré ${shot.anchor}`);
    // Settle past the reading line so the plate has switched.
    await page.mouse.wheel(0, 340);
  } else if (shot.scrollTo !== undefined) {
    await page.evaluate((ratio) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * ratio, behavior: 'instant' });
    }, shot.scrollTo);
  }

  if (shot.click) await page.click(shot.click);

  await page.waitForTimeout(900);
  // Only the images actually on screen: the other hundred are lazy and below
  // the fold, so waiting on them would never resolve.
  await page.evaluate(async () => {
    const onScreen = [...document.images].filter((img) => {
      if (img.complete) return false;
      const box = img.getBoundingClientRect();
      return box.bottom > -200 && box.top < window.innerHeight + 200 && box.width > 0;
    });
    await Promise.race([
      Promise.all(onScreen.map((img) => new Promise((done) => (img.onload = img.onerror = done)))),
      new Promise((done) => setTimeout(done, 4000)),
    ]);
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
  await context.close();
  console.log(`  ${shot.name}`);
}

await browser.close();

if (errors.length) {
  console.log(`\nErrores en consola (${errors.length}):`);
  for (const error of [...new Set(errors)].slice(0, 20)) console.log(`  ${error}`);
} else {
  console.log('\nSin errores de consola.');
}
console.log(`\nCapturas → ${path.relative(ROOT, OUT)}`);

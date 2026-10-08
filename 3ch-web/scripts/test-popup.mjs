import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const html = await (await fetch('https://woorileague.com')).text();
const source = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const start = source.indexOf("document.querySelectorAll('body > .MuiModal-root')");
const end = source.indexOf('ReactDOM.createRoot', start);
assert.ok(start >= 0 && end > start);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''), { waitUntil: 'domcontentloaded' });
  assert.ok(await page.locator('body > .MuiModal-root').count() > 0, 'production snapshot reproduces inert popup');
  await page.evaluate(source.slice(start, end));
  assert.equal(await page.locator('body > .MuiModal-root').count(), 0);
  assert.equal(await page.locator('#root').getAttribute('aria-hidden'), null);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  assert.ok((await page.locator('#root').innerText()).length > 80);
  console.log('PASS: production static popup removed; home content preserved and scroll unlocked');
} finally { await browser.close(); }

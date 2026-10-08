import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';

const dist = resolve('dist');
const origin = process.env.PUBLIC_CONTENT_ORIGIN || 'https://woorileague.com';
const template = await readFile(join(dist, 'index.html'), 'utf8');
const routes = ['/', '/demo', '/demo/league', '/demo/club', '/demo/draw', '/mypage/guide', '/mypage/faq', '/mypage/terms', '/mypage/privacy'];
const guideResponse = await fetch(`${origin}/api/guides`, { signal: AbortSignal.timeout(30000) });
if (!guideResponse.ok) throw new Error(`Public guide API returned ${guideResponse.status}`);
const { guides } = await guideResponse.json();
if (!Array.isArray(guides) || !guides.length) throw new Error('Public guides could not be loaded; refusing to publish an empty snapshot.');
for (const guide of guides) routes.push(`/mypage/guide/${Number(guide.id)}`);

const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
let verifySnapshots = false;
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {
      const response = await fetch(`${origin}${req.url}`, { signal: AbortSignal.timeout(30000) });
      res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json' });
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if (!extname(pathname)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (verifySnapshots) {
        return res.end(await readFile(join(dist, pathname === '/' ? 'index.html' : `${pathname.slice(1)}/index.html`), 'utf8').catch(() => readFile(join(dist, 'app.html'), 'utf8')));
      }
      return res.end(template);
    }
    const file = resolve(dist, `.${pathname}`);
    if (!file.startsWith(dist + sep)) {
      res.writeHead(403); return res.end();
    }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const address = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' });
  // The production API permits the production origin; read the same public data
  // through Node during local rendering so localhost does not trigger CORS.
  const apiCache = new Map();
  await context.route('**/api/**', async (route) => {
    if (route.request().method() !== 'GET') return route.abort();
    const url = new URL(route.request().url());
    // Popups are visitor-specific interactive portals, never public HTML content.
    if (url.pathname === '/api/popups') return route.fulfill({ json: { popups: [] } });
    const key = `${url.pathname}${url.search}`;
    if (!apiCache.has(key)) apiCache.set(key, (async () => {
      const response = await fetch(`${origin}${key}`, { signal: AbortSignal.timeout(30000) });
      return { status: response.status, contentType: response.headers.get('content-type') || 'application/json', body: Buffer.from(await response.arrayBuffer()) };
    })());
    await route.fulfill(await apiCache.get(key));
  });
  // Do not request ad inventory while generating the same public UI for all visitors.
  await context.route(/kakaocdn\.net\/kas|googlesyndication\.com|doubleclick\.net/, (route) => route.abort());
  for (const route of routes) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(address + route, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.innerText.trim().length > 80 && !document.querySelector('.MuiCircularProgress-root'), undefined, { timeout: 30000 });
    if (errors.length) throw new Error(`${route}: ${errors.join('; ')}`);
    if (/^\/mypage\/guide\/\d+$/.test(route)) {
      const guide = guides.find((item) => route.endsWith(`/${item.id}`));
      await page.waitForSelector(`[data-guide-id="${guide.id}"]`, { timeout: 30000 });
    }
    await page.evaluate(() => {
      for (const style of document.querySelectorAll('style[data-emotion]')) {
        if (style.sheet) style.textContent = Array.from(style.sheet.cssRules, (rule) => rule.cssText).join('\n');
      }
      document.querySelectorAll('ins.kakao_ad_area, iframe[src*="doubleclick"], iframe[src*="googlesyndication"]').forEach((node) => node.remove());
      document.querySelectorAll('body > .MuiModal-root').forEach((node) => node.remove());
      document.getElementById('root')?.removeAttribute('aria-hidden');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    });
    const html = await page.content();
    if (html.includes('MuiDialog-root') || html.includes('league-popup-dialog')) throw new Error(`Interactive popup leaked into public HTML: ${route}`);
    if (!html.includes('rel="canonical"') || !html.includes('index,follow,max-image-preview:large')) throw new Error(`Missing public metadata: ${route}`);
    const target = route === '/' ? dist : join(dist, route.slice(1));
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'index.html'), html);
    console.log(`Prerendered ${route} (${Buffer.byteLength(html)} bytes)`);
    await page.close();
  }
  const app = template.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,nofollow" />');
  await writeFile(join(dist, 'app.html'), app);
  await writeFile(join(dist, '404.html'), app);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${origin}${route}</loc></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(join(dist, 'sitemap.xml'), sitemap);
  verifySnapshots = true;
  const noJs = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
  for (const route of routes) {
    const page = await noJs.newPage();
    await page.goto(address + route);
    if ((await page.locator('#root').innerText()).trim().length < 80) throw new Error(`Empty HTML without JavaScript: ${route}`);
    if (/^\/mypage\/guide\/\d+$/.test(route)) await page.locator(`[data-guide-id="${route.split('/').at(-1)}"]`).waitFor();
    await page.close();
  }
  const privatePage = await noJs.newPage();
  await privatePage.goto(address + '/login');
  if (await privatePage.locator('meta[name="robots"]').getAttribute('content') !== 'noindex,nofollow') throw new Error('Functional shell is not noindex');
  await privatePage.close();
  console.log(`Verified ${routes.length} public pages without JavaScript and the noindex functional shell.`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

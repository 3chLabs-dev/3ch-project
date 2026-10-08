# Public-page HTML deployment

The web workflow builds the SPA, then renders the existing public UI into HTML.
It reads `/api/guides` without authentication and creates a page for every guide ID.
It makes no database writes. The deployment fails if public guide data or rendering fails.

Apply `public-pages.nginx.conf` to the existing `location /` in the site's Nginx server
block once. Retain the site's existing API, uploads and unrelated-service locations.
Run `sudo nginx -t`, then reload Nginx. Without this change, dynamic routes may still
fall back to the public home HTML rather than `app.html`.

After deployment, check the HTML source of `/`, `/demo`, `/mypage/guide`, and one
`/mypage/guide/<id>`: they must contain the visible page body and its canonical URL.
`/login` and an unknown route must use the noindex app shell.

Guide and FAQ snapshots are refreshed on web deployment. After editing public content,
rerun the web workflow to update the HTML snapshot. Browsers continue fetching current
API content after startup. Use `PUBLIC_CONTENT_ORIGIN` to render against a staging API;
the default is `https://woorileague.com`.

Local commands: `npm run build`, `npx playwright install chromium`, `npm run prerender`.

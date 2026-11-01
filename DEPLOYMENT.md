# Deploying BookEase

BookEase is a static single-page app. Production hosting needs only static files: no server,
no database, no environment variables and no API keys. These steps use GitHub and Vercel;
any static host with an SPA fallback works the same way.

## 1. Build locally first

```bash
npm ci
npm run check     # typecheck, lint, unit/integration/component tests, production build
npm run preview   # serves dist/ on http://localhost:4173
```

Open <http://localhost:4173/admin/calendar> directly and refresh: `vite preview` falls back
to `index.html` for unknown paths, like Vercel does with `vercel.json`.

## 2. Create a GitHub repository

1. On GitHub, create a new empty repository (don't add a README; the project has one).
2. Push the project:

   ```bash
   git remote add origin git@github.com:<you>/bookease.git
   git push -u origin main
   ```

## 3. Import into Vercel

1. Sign in at <https://vercel.com> (a free Hobby account is enough for a portfolio project).
2. **Add New… → Project**, then import the GitHub repository.
3. Framework preset: **Vite** (detected automatically; pick it by hand if not).
4. Build command: `npm run build`. Output directory: `dist`. Install command: default
   (`npm install`). These are also declared in `vercel.json`.
5. Environment variables: none.
6. **Deploy**.

Every push to `main` then redeploys production, and pull requests get preview URLs.

### Deploying from the CLI instead

```bash
npm i -g vercel
vercel          # first run links the folder to a project and makes a preview deployment
vercel --prod   # production deployment
```

## 4. What `vercel.json` does

| Setting | Purpose |
| --- | --- |
| `rewrites` | Every path that isn't a static file is served `index.html`, so `/admin/reports` or `/book/date-time` work on refresh and when opened directly. |
| `/assets/*` cache header | Vite fingerprints asset file names, so they are cached for a year as `immutable`. `index.html` is not cached long, so new deploys show up immediately. |
| `Content-Security-Policy` | `default-src 'self'` and `connect-src 'self'`: the app loads nothing from other origins and makes no network requests. Inline styles are allowed for the UI libraries; inline scripts are not. |
| Other headers | `nosniff`, `DENY` framing, strict referrer and permissions policies, HSTS. |

## 5. Test the deployment

- `/`, `/admin`, `/book` load.
- Refresh on a nested route (`/admin/appointments`, `/book/date-time`, `/booking-lookup`).
- Browser back and forward between admin pages.
- DevTools → Network: only same-origin requests; DevTools → Console: no CSP violations.
- Complete a booking in the portal and find it in the admin (same browser).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| 404 on refresh of a nested route | `vercel.json` missing from the deployed commit, or the output directory isn't `dist`. |
| Blank page, console shows "Refused to load the script" | A third-party script was added. Bundle it with Vite instead, or extend the CSP in `vercel.json`. |
| "BookEase was updated" message after a deploy | An open tab requested a chunk from the previous build. Reloading fixes it; data is unaffected. |
| Data missing on another device | Expected: data lives in each browser. Export a backup in Settings → Data and import it on the other device. |
| "Local storage is unavailable" | The browser blocks IndexedDB (some private modes). Use a normal window. |
| Build fails on Vercel with a TypeScript error | Run `npm run check` locally; Vercel runs the same `npm run build` (`tsc -b && vite build`). |

## Docker (local development only)

Docker is not needed for Vercel. See the README for `docker compose up --build`.

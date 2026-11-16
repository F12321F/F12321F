# Repository Guidelines

## Project Structure

This repository holds 旅行分帳本, a travel expense sharing app.

- `index.html` (repo root): redirects the GitHub Pages root URL to `travel-expense/`.
- `travel-expense/index.html`: the whole app (HTML, CSS, JS in one file), shared by the web, PWA, and Android builds.
- `travel-expense/manifest.webmanifest`, `sw.js`, `icons/`: PWA install and offline cache.
- `travel-expense/app/`: Capacitor Android project. `scripts/copy-web.mjs` copies the web files into `www/`; `assets/` holds icon and splash sources.
- `.github/workflows/travel-expense-android.yml`: builds a debug APK on push and updates the `travel-split-latest` pre-release.

Document any new deliverable's location and usage in `travel-expense/README.md`.

## Development

- Web: open `travel-expense/index.html` directly, or serve the folder (`python3 -m http.server`) to test the service worker.
- Android (Node 22, JDK 21, Android SDK): `cd travel-expense/app && npm ci && npm run android:apk`. After editing `index.html`, run `npm run android:sync`.
- Keep Traditional Chinese UI labels. TWD stays the default currency; each expense stores its own exchange rate.
- Data lives in browser `localStorage` (key `travel-split-ledger-v1`). If the stored shape changes, keep `normalize()` able to read older backups.

## Testing

No test framework yet. Before committing, verify in a browser: add members, add TWD and foreign-currency expenses (equal and custom split), confirm totals and settlement transfers, reload to confirm persistence, and check a 390px-wide viewport in light and dark mode. Use fictional names in sample data.

## Commits and Reviews

Use short, descriptive commit subjects, such as `Add expense category filter`. In review requests, summarize the change, explain how you verified it, and include screenshots for visible UI changes.

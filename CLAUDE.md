# Golf GPS

Personal golf GPS progressive web app. Single-page app with no build step, no backend.

## Stack

- **MapLibre GL JS** — map rendering with MapTiler satellite tiles
- **Turf.js** — geospatial distance/bearing calculations
- **Open-Meteo API** — wind data (free, no key)
- **MapTiler API** — satellite tiles + elevation data (key required)
- **Vanilla JS/CSS** — no frameworks

## Project Structure

```
index.html           — app shell with PWA meta tags
css/style.css        — all styles
js/app.js            — all application logic
manifest.json        — PWA manifest (installable on mobile)
service-worker.js    — caches app shell for fast loading
icons/               — SVG and PNG app icons
```

## API Key

The MapTiler API key is stored in the user's browser localStorage (key: `golfgps_maptiler_key`). It is never committed to the repo. On first visit, the app prompts for the key. The settings gear button allows changing it.

## Running Locally

Open `index.html` in a browser, or serve with any static file server:

```sh
python3 -m http.server 8000
```

Service worker requires HTTPS or localhost.

## Hosting

Designed for GitHub Pages. Enable Pages on the repo's main branch and the app is accessible at `https://<user>.github.io/GolfGPS/`.

## Features

- GPS player tracking with accuracy display
- Tap to place target markers (up to 5) with yardage lines
- Draggable markers with real-time distance updates
- Wind speed/direction/gust display
- Elevation difference between player and target
- "Plays like" adjusted yardage (wind + elevation)
- Compass/north reset button
- Installable as PWA (add to home screen)

---

## Skills

Use `~/.claude/skills/frontend-design` for any UI work — follow its design token system and mobile-first principles.
Use `~/.claude/skills/webapp-testing` when writing or running tests.
Use `~/.claude/skills/planning-with-files` for any task with more than 3 steps — write findings to `task_plan.md` and track progress.
Use `~/.claude/skills/web-quality-skills` when auditing performance, accessibility, or Core Web Vitals.

---

## Code Review Instructions

When reviewing code, always:
- Read ALL relevant files before explaining or suggesting changes
- Use planning-with-files to log findings to `task_plan.md`
- Explain data flow end-to-end, not just isolated functions
- Flag performance issues (especially GPS/geolocation battery drain)
- Flag accessibility issues (touch targets ≥44px, screen reader support)
- Flag any security concerns (API key exposure, XSS vectors)

---

## Development Standards

- **Mobile-first** — this app is primarily used on a phone while on a golf course
- **Offline-first** — service worker must cache everything critical; GPS works without network
- **Touch targets** — all interactive elements must be ≥44x44px (user has gloves on)
- **Performance** — minimize JS execution during GPS updates; target <16ms per frame
- **No build step** — keep it vanilla JS/CSS, no bundler, no npm dependencies
- **Battery conscious** — avoid unnecessary geolocation polling; use watchPosition efficiently

---

## Key Technical Constraints

- No localStorage for sensitive data (API key exception already handled)
- MapTiler key must never be logged or exposed in error messages
- Turf.js distance calculations must use `rhumbDistance` for short golf distances, not great-circle
- Service worker cache must be versioned — bump version on any asset change
- PWA manifest icons must include both 192px and 512px for full installability

---

## When Adding Features

1. Check if it works fully offline first
2. Verify touch target sizes on mobile
3. Test GPS accuracy impact (does it increase polling frequency?)
4. Confirm service worker cache includes any new assets
5. Run web-quality-skills audit before committing

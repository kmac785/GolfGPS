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

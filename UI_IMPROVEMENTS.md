# GolfGPS — UI Improvements Guide

A comprehensive step-by-step guide covering all recommended UX improvements, organized by file and priority. Each step includes the problem, the exact change, and the UX benefit.

---

## Priority Legend

- 🔴 **High** — Directly impacts usability on-course
- 🟡 **Medium** — Improves polish and reliability

---

## Part 1 — Button & Layout Fixes

### Step 1 — Fix Button Tap Targets 🔴

**File:** `css/style.css`

**Problem:** `.settings-btn` is 36×36px while `.recenter-btn` is 48×48px. Inconsistent and too small for a gloved hand. Apple HIG minimum is 44px.

**Change:**
```css
.settings-btn {
    width: 44px;
    height: 44px;
}
.settings-btn svg {
    width: 20px;
    height: 20px;
}
.north-btn {
    width: 44px;
    height: 44px;
}
```

**UX Benefit:** Consistent 44px minimum tap targets prevent mis-taps mid-round, especially with golf gloves.

---

### Step 2 — Fix North Button Positioning 🔴

**File:** `css/style.css`

**Problem:** `.north-btn` is hardcoded at `bottom: 200px` — will collide with other elements on shorter screens like iPhone SE.

**Change:**
```css
.north-btn {
    bottom: calc(32px + 48px + 16px + 44px + 12px);
}
```

**UX Benefit:** Buttons never stack or overlap regardless of screen height, keeping the map canvas clear.

---

## Part 2 — Wind Box Improvements

### Step 3 — Convert Wind Arrows to Rotating SVG 🟡

**Files:** `index.html`, `css/style.css`, `js/app.js`

**Problem:** Wind direction uses raw Unicode `↑` arrows. Imprecise rendering and visually inconsistent across devices.

**Change in `index.html`** — replace the three `<span>` arrow elements inside `.wind-box-arrows`:
```html
<div class="wind-box-arrows">
    <svg class="wind-arrow-svg" id="windArrowSvg" viewBox="0 0 24 24"
         fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3l5 9H7l5-9z" fill="rgba(255,255,255,0.88)"/>
        <line x1="12" y1="12" x2="12" y2="21"
              stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    </svg>
</div>
```

**Change in `css/style.css`:**
```css
.wind-arrow-svg {
    width: 28px;
    height: 28px;
    transition: transform 0.5s ease;
    display: block;
}
```

**Change in `js/app.js`** — update `updateWindArrow()`:
```js
function updateWindArrow() {
    if (windDeg === null) return;
    const windTravelDeg = (windDeg + 180) % 360;
    const bearing = map.getBearing();
    const rotation = windTravelDeg - bearing;
    const arrowEl = document.getElementById('windArrowSvg');
    if (arrowEl) arrowEl.style.transform = `rotate(${rotation}deg)`;
}
```

**UX Benefit:** A smooth rotating SVG arrow gives an at-a-glance wind direction that's accurate and readable in bright sunlight.

---

### Step 4 — Add Gust vs. Sustained Label 🟡

**Files:** `index.html`, `css/style.css`, `js/app.js`

**Problem:** The wind box shows a speed number with no context — user can't tell if it's sustained wind or a gust.

**Change in `index.html`** — add below `.wind-box-speed-row`:
```html
<div class="wind-box-gust" id="windBoxGust" style="display:none;">G: --mph</div>
```

**Change in `css/style.css`:**
```css
.wind-box-gust {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1;
    margin-top: 2px;
}
```

**Change in `js/app.js`** — inside `fetchWeather()`, after setting `windGust`:
```js
const gustEl = document.getElementById('windBoxGust');
if (gustEl) {
    if (windGust && windGust > windSpeed) {
        gustEl.textContent = `G: ${windGust}mph`;
        gustEl.style.display = '';
    } else {
        gustEl.style.display = 'none';
    }
}
```

**UX Benefit:** Golfers make different club decisions for 12mph sustained vs. 12mph gust. This single line adds real shot-planning value.

---

## Part 3 — Yardage Card Improvements

### Step 5 — Fix Yardage Card Typography Hierarchy 🔴

**File:** `css/style.css`

**Problem:** `.card-yards` at `26px` and `.card-pl-main` at `22px` are too similar in visual weight — both compete for attention equally.

**Change:**
```css
.card-yards {
    font-size: 32px;
}
.card-pl-main {
    font-size: 18px;
}
.card-pl-club {
    font-size: 14px;
}
```

**UX Benefit:** Eyes go immediately to raw yardage (most critical info), then to the club suggestion. Reduces cognitive load mid-shot.

---

### Step 6 — Fix Yardage Card Position Offset 🔴

**File:** `css/style.css`

**Problem:** `.combined-card` uses `transform: translate(-50%, -50%)` which centers the card directly over the marker dot, hiding it and making it undroppable.

**Change:**
```css
.combined-card {
    transform: translate(-50%, calc(-100% - 18px));
}
```

**UX Benefit:** Card floats above the marker like a tooltip. The marker dot stays visible and draggable without the card blocking it.

---

## Part 4 — GPS Status Banner

### Step 7 — Shrink GPS Banner After Lock 🟡

**Files:** `css/style.css`, `js/app.js`

**Problem:** Full-width GPS banner persists across the top even after GPS is locked, blocking the settings button area.

**Change in `js/app.js`** — inside the `watchPosition` success callback, when GPS locks:
```js
statusEl.classList.add('locked-pill');
```

**Change in `css/style.css`:**
```css
.gps-status.locked-pill {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: auto;
    padding: 6px 14px;
    border-radius: 20px;
    top: max(env(safe-area-inset-top), 10px);
    margin-top: 6px;
    font-size: 12px;
}
```

**UX Benefit:** After GPS locks, a compact pill replaces the full-width banner — the top of the map stays clear and looks polished, similar to Apple Maps.

---

## Part 5 — Auto-Orient Map to Phone Heading

Automatically rotates the map to match the direction the phone is pointed, eliminating the need to manually pan and orient before placing a target.

### Step 8 — Add Heading State Variables 🔴

**File:** `js/app.js` — add to the State block inside `initApp()`:

```js
let compassHeading = null;
let headingLocked = false;
```

---

### Step 9 — Read GPS Heading While Moving 🔴

**File:** `js/app.js` — inside the `watchPosition` success callback, after `playerLocation` is set:

```js
// GPS heading — only valid when moving (speed guard prevents standing-still jitter)
if (pos.coords.heading !== null &&
    !isNaN(pos.coords.heading) &&
    pos.coords.speed > 0.5) {
    compassHeading = pos.coords.heading;
    if (headingLocked) applyHeading();
}
```

**Why:** `coords.heading` is only reliable when the device is moving. The `speed > 0.5` guard prevents erratic jitter while standing still.

---

### Step 10 — Add DeviceOrientation Compass (Works at Rest) 🔴

**File:** `js/app.js` — add these functions inside `initApp()`:

```js
function startCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires explicit permission prompt
        DeviceOrientationEvent.requestPermission()
            .then(state => {
                if (state === 'granted') listenOrientation();
            })
            .catch(console.warn);
    } else {
        listenOrientation();
    }
}

function listenOrientation() {
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
}

function handleOrientation(e) {
    let heading = null;
    if (e.absolute && e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
    } else if (e.webkitCompassHeading !== undefined) {
        heading = e.webkitCompassHeading; // Safari / iOS fallback
    }
    if (heading === null) return;
    compassHeading = heading;
    if (headingLocked) applyHeading();
}
```

**Why:** `deviceorientationabsolute` gives compass-relative heading even while standing still. The `webkitCompassHeading` fallback covers iOS Safari. Without this, heading only works while walking.

---

### Step 11 — Apply Heading to Map 🔴

**File:** `js/app.js`:

```js
function applyHeading() {
    if (compassHeading === null || !playerLocation) return;
    map.easeTo({
        bearing: compassHeading,
        duration: 300,
        easing: t => t
    });
    const arrowEl = document.getElementById('playerArrow');
    if (arrowEl) arrowEl.classList.add('visible');
}
```

**Why:** `map.easeTo({ bearing })` rotates the map so the top of the screen matches the direction you're facing. 300ms keeps it smooth without lag.

---

### Step 12 — Add Heading Toggle Button 🔴

**File:** `index.html` — add after the recenter button:

```html
<button class="heading-btn" id="headingBtn"
        aria-label="Toggle auto-orient to phone direction">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
</button>
```

**File:** `css/style.css`:

```css
.heading-btn {
    position: fixed;
    bottom: calc(32px + 48px + 12px);
    right: 16px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1000;
    transition: background 0.2s, color 0.2s;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}
.heading-btn.active {
    background: rgba(0, 122, 255, 0.8);
    color: #fff;
    border-color: rgba(0, 122, 255, 0.6);
}
.heading-btn svg {
    width: 20px;
    height: 20px;
}
```

---

### Step 13 — Wire Up Toggle + Update Recenter 🔴

**File:** `js/app.js` — add inside `initApp()`:

```js
const headingBtnEl = document.getElementById('headingBtn');

headingBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    headingLocked = !headingLocked;
    headingBtnEl.classList.toggle('active', headingLocked);

    if (headingLocked) {
        startCompass();
        applyHeading();
    } else {
        map.easeTo({ bearing: 0, duration: 400 });
    }
});
```

Also update the existing recenter button listener to respect heading mode:

```js
document.getElementById('recenterBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (playerLocation) {
        isFollowing = true;
        map.flyTo({
            center: [playerLocation.lng, playerLocation.lat],
            zoom: 17.5,
            bearing: headingLocked ? (compassHeading || 0) : 0,
            duration: 1000
        });
    } else {
        document.getElementById('gpsStatus').classList.remove('hidden');
    }
});
```

**UX Benefit:** North-up for hole overview, heading-up when walking toward the ball. Recenter respects the active mode so it never snaps back to north unexpectedly.

---

### Step 14 — Add Directional Arrow to Player Dot 🟡

**File:** `js/app.js` — update player marker element creation inside `startGPS()`:

```js
const el = document.createElement('div');
el.className = 'player-dot-outer';
el.innerHTML = `
    <div class="player-heading-arrow" id="playerArrow"></div>
    <div class="player-dot-inner"></div>
`;
```

**File:** `css/style.css`:

```css
.player-dot-outer {
    position: relative;
}
.player-heading-arrow {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 11px solid #007AFF;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
}
.player-heading-arrow.visible {
    opacity: 1;
}
```

**UX Benefit:** Visual confirmation that heading mode is active. The arrow on your dot shows which way you're facing — same UX pattern as Google Maps navigation mode.

---

## Implementation Checklist

### css/style.css
- [ ] Step 1 — Settings & north button tap targets (44px)
- [ ] Step 2 — North button position relative to recenter
- [ ] Step 3 — Wind arrow SVG styles
- [ ] Step 4 — Wind gust label styles
- [ ] Step 5 — Yardage card font size hierarchy
- [ ] Step 6 — Yardage card position offset fix
- [ ] Step 7 — GPS status locked-pill styles
- [ ] Step 12 — Heading toggle button styles
- [ ] Step 14 — Player heading arrow styles

### index.html
- [ ] Step 3 — Replace Unicode arrows with SVG arrow element
- [ ] Step 4 — Add gust label element
- [ ] Step 12 — Add heading toggle button

### js/app.js
- [ ] Step 3 — Update `updateWindArrow()` to use SVG rotation
- [ ] Step 4 — Update `fetchWeather()` to populate gust label
- [ ] Step 7 — Add `locked-pill` class on GPS lock
- [ ] Step 8 — Add `compassHeading` and `headingLocked` state vars
- [ ] Step 9 — Read `coords.heading` in watchPosition callback
- [ ] Step 10 — Add `startCompass()`, `listenOrientation()`, `handleOrientation()`
- [ ] Step 11 — Add `applyHeading()` function
- [ ] Step 13 — Wire heading toggle button + update recenter listener
- [ ] Step 14 — Add heading arrow to player dot + show in `applyHeading()`

---

## Service Worker Note

After making any changes to `css/style.css`, `index.html`, or `js/app.js`, **bump the cache version** in `service-worker.js` so returning users get the updated files. Look for the `CACHE_NAME` constant and increment the version number.

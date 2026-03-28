// ============================================================
// Settings & Storage
// ============================================================
const STORAGE_KEY = 'golfgps_maptiler_key';
const CLUBS_KEY = 'golfgps_clubs';

const DEFAULT_CLUBS = [
    { club: '56°', carry: 80 },
    { club: '50°', carry: 100 },
    { club: 'PW',  carry: 115 },
    { club: '9i',  carry: 130 },
    { club: '8i',  carry: 150 },
    { club: '7i',  carry: 160 },
    { club: '6i',  carry: 170 },
    { club: '5i',  carry: 180 },
    { club: '4i',  carry: 190 },
    { club: '3H',  carry: 210 },
    { club: '3W',  carry: 230 },
    { club: 'D',   carry: 270 }
];

function getApiKey() {
    return localStorage.getItem(STORAGE_KEY);
}

function saveApiKey(key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
}

function getClubs() {
    try {
        const stored = localStorage.getItem(CLUBS_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) { /* use defaults */ }
    return DEFAULT_CLUBS;
}

function saveClubs(clubs) {
    localStorage.setItem(CLUBS_KEY, JSON.stringify(clubs));
}

// Build club editor rows in the settings panel
function renderClubEditor() {
    const editor = document.getElementById('clubEditor');
    const clubs = getClubs();
    editor.innerHTML = '';
    clubs.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'club-row';
        row.innerHTML = `<span class="club-name">${c.club}</span><input type="number" data-idx="${i}" value="${c.carry}" inputmode="numeric" min="0" max="400">`;
        editor.appendChild(row);
    });
}

function readClubEditorValues() {
    const clubs = getClubs();
    const inputs = document.querySelectorAll('#clubEditor input[type="number"]');
    inputs.forEach((inp) => {
        const idx = parseInt(inp.dataset.idx, 10);
        const val = parseInt(inp.value, 10);
        if (!isNaN(val) && clubs[idx]) {
            clubs[idx].carry = val;
        }
    });
    return clubs;
}

function hideSetup() {
    const overlay = document.getElementById('setupOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => { overlay.style.display = 'none'; }, 400);
}

function showSetup() {
    const overlay = document.getElementById('setupOverlay');
    overlay.style.display = '';
    overlay.classList.remove('hidden');
    document.getElementById('apiKeyInput').value = getApiKey() || '';
    renderClubEditor();
}

// Setup overlay — Save button
document.getElementById('saveKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) return;
    saveApiKey(key);
    saveClubs(readClubEditorValues());
    hideSetup();
    if (!window._appInitialized) {
        initApp(key);
    }
});

document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('saveKeyBtn').click();
});

// Settings gear button
document.getElementById('settingsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    showSetup();
});

// ============================================================
// Boot
// ============================================================
renderClubEditor();
const existingKey = getApiKey();
if (existingKey) {
    hideSetup();
    initApp(existingKey);
}

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
}

// ============================================================
// Main app
// ============================================================
function initApp(MAPTILER_KEY) {
    window._appInitialized = true;

    // State
    let playerLocation = null;
    let playerElevation = null;
    let playerMarker = null;
    let isFollowing = true;

    const targets = [];
    let activeTarget = null; // currently selected marker
    const MAX_TARGETS = 5;
    const DOT_CLASSES = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const LINE_COLORS = ['#FF453A', '#30D158', '#FFD60A', '#BF5AF2', '#64D2FF'];

    // Wind state
    let windSpeed = null;
    let windDeg = null;
    let windGust = null;
    let temperature = null;
    let weatherFetchInterval = null;

    // ============================================================
    // Initialize MapLibre with MapTiler Satellite tiles
    // ============================================================
    const map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'maptiler-satellite': {
                    type: 'raster',
                    tiles: [
                        `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`
                    ],
                    tileSize: 512,
                    maxzoom: 20,
                    attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a>'
                }
            },
            layers: [{
                id: 'satellite',
                type: 'raster',
                source: 'maptiler-satellite',
                minzoom: 0,
                maxzoom: 20,
                paint: {
                    'raster-saturation': 0.4,
                    'raster-brightness-min': 0.08,
                    'raster-contrast': 0.15
                }
            }]
        },
        center: [-95.2, 38.9],
        zoom: 17.5,
        pitch: 0,
        bearing: 0,
        attributionControl: true
    });

    // ============================================================
    // Compass / North button
    // ============================================================
    // Compass / North button + wind arrow sync
    // ============================================================
    function updateWindArrow() {
        if (windDeg === null) return;
        const windTravelDeg = (windDeg + 180) % 360;
        const bearing = map.getBearing();
        const rotation = `rotate(${windTravelDeg - bearing}deg)`;
        document.getElementById('windBoxArrow').style.transform = rotation;
        document.querySelectorAll('.wind-gust-arrow').forEach(el => {
            el.style.transform = rotation;
        });
    }

    const northBtn = document.getElementById('northBtn');
    map.on('rotate', () => {
        const bearing = map.getBearing();
        if (Math.abs(bearing) > 2) {
            northBtn.classList.add('visible');
            northBtn.querySelector('.north-arrow').style.transform = `rotate(${-bearing}deg)`;
        } else {
            northBtn.classList.remove('visible');
        }
        updateWindArrow();
    });
    northBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        map.easeTo({ bearing: 0, duration: 400 });
    });

    // ============================================================
    // GPS Tracking
    // ============================================================
    function startGPS() {
        if (!navigator.geolocation) {
            document.getElementById('gpsText').textContent = 'GPS not available';
            return;
        }

        navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                playerLocation = { lat: latitude, lng: longitude };

                // Update GPS status
                const statusEl = document.getElementById('gpsStatus');
                const dotEl = document.getElementById('gpsDot');
                const textEl = document.getElementById('gpsText');
                const accYards = Math.round(accuracy * 1.09361);
                dotEl.className = 'dot locked';
                textEl.textContent = `GPS Locked — ±${accYards}yd`;

                // Auto-hide GPS status after 3 seconds
                clearTimeout(window._gpsHideTimer);
                window._gpsHideTimer = setTimeout(() => {
                    statusEl.classList.add('hidden');
                }, 3000);

                // Create or update player marker
                if (!playerMarker) {
                    const el = document.createElement('div');
                    el.className = 'player-dot-outer';
                    el.innerHTML = '<div class="player-dot-inner"></div>';
                    playerMarker = new maplibregl.Marker({ element: el })
                        .setLngLat([longitude, latitude])
                        .addTo(map);

                    // Initial center
                    map.flyTo({ center: [longitude, latitude], zoom: 17.5, duration: 1500 });

                    // Fetch weather on first GPS lock
                    fetchWeather(latitude, longitude);
                    fetchPlayerElevation(latitude, longitude);

                    // Refresh weather every 5 minutes
                    weatherFetchInterval = setInterval(() => {
                        if (playerLocation) {
                            fetchWeather(playerLocation.lat, playerLocation.lng);
                            fetchPlayerElevation(playerLocation.lat, playerLocation.lng);
                        }
                    }, 300000);
                } else {
                    playerMarker.setLngLat([longitude, latitude]);
                }

                if (isFollowing) {
                    map.easeTo({ center: [longitude, latitude], duration: 500 });
                }

                // Update all target distances
                targets.forEach(t => updateTargetDistance(t));
            },
            (err) => {
                const textEl = document.getElementById('gpsText');
                textEl.textContent = 'GPS Error: ' + err.message;
            },
            {
                enableHighAccuracy: true,
                maximumAge: 2000,
                timeout: 10000
            }
        );
    }

    // ============================================================
    // Weather (Open-Meteo — free, no key)
    // ============================================================
    async function fetchWeather(lat, lng) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m&wind_speed_unit=mph&temperature_unit=fahrenheit`;
            const resp = await fetch(url);
            const data = await resp.json();

            if (data.current) {
                windSpeed = Math.round(data.current.wind_speed_10m);
                windDeg = data.current.wind_direction_10m;
                windGust = data.current.wind_gusts_10m ? Math.round(data.current.wind_gusts_10m) : null;
                temperature = data.current.temperature_2m != null ? Math.round(data.current.temperature_2m) : null;

                document.getElementById('windBoxSpeed').textContent = windSpeed;
                document.getElementById('windBoxTemp').textContent = temperature != null ? temperature + '°F' : '--°F';
                document.getElementById('windBox').classList.add('visible');
                // Show/hide gust arrows
                const gustArrows = document.querySelectorAll('.wind-gust-arrow');
                gustArrows.forEach(el => {
                    el.style.display = (windGust && windGust > windSpeed) ? '' : 'none';
                });
                updateWindArrow();
            }
        } catch (e) {
            console.warn('Weather fetch failed:', e);
        }
    }

    function degToCardinal(deg) {
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return dirs[Math.round(deg / 22.5) % 16];
    }

    // ============================================================
    // Elevation (MapTiler)
    // ============================================================
    async function fetchPlayerElevation(lat, lng) {
        try {
            const url = `https://api.maptiler.com/elevation/${lng},${lat}.json?key=${MAPTILER_KEY}`;
            const resp = await fetch(url);
            const data = await resp.json();
            // Response is [[lng, lat, elevation]]
            if (Array.isArray(data) && data.length > 0 && data[0].length >= 3) {
                playerElevation = data[0][2]; // meters
            }
        } catch (e) {
            console.warn('Player elevation fetch failed:', e);
        }
    }

    async function fetchElevation(lat, lng) {
        try {
            const url = `https://api.maptiler.com/elevation/${lng},${lat}.json?key=${MAPTILER_KEY}`;
            const resp = await fetch(url);
            const data = await resp.json();
            // Response is [[lng, lat, elevation]]
            if (Array.isArray(data) && data.length > 0 && data[0].length >= 3) {
                return data[0][2]; // meters
            }
        } catch (e) {
            console.warn('Elevation fetch failed:', e);
        }
        return null;
    }

    // ============================================================
    // Club selection (reads from localStorage)
    // ============================================================
    function suggestClub(playsLikeYards) {
        const clubs = getClubs();
        // Find the shortest club whose carry covers the distance
        for (const c of clubs) {
            if (c.carry >= playsLikeYards) return c;
        }
        // Beyond longest club
        return clubs[clubs.length - 1];
    }

    // ============================================================
    // Crosshair SVG factory
    // ============================================================
    function createCrosshairSVG() {
        const size = 48;
        const c = 'rgba(255, 255, 255, 0.9)';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.style.display = 'block';
        svg.innerHTML = `
            <circle cx="24" cy="24" r="17" fill="none" stroke="${c}" stroke-width="2" opacity="0.85"/>
            <line x1="24" y1="1" x2="24" y2="12" stroke="${c}" stroke-width="2" opacity="0.85"/>
            <line x1="24" y1="36" x2="24" y2="47" stroke="${c}" stroke-width="2" opacity="0.85"/>
            <line x1="1" y1="24" x2="12" y2="24" stroke="${c}" stroke-width="2" opacity="0.85"/>
            <line x1="36" y1="24" x2="47" y2="24" stroke="${c}" stroke-width="2" opacity="0.85"/>
            <circle cx="24" cy="24" r="2.5" fill="${c}" opacity="0.9"/>
        `;
        return svg;
    }

    // ============================================================
    // "Plays Like" Calculation (returns data, no DOM writes)
    // ============================================================
    function calcPlaysLike(distYards, playerElev, targetElev, targetLng, targetLat) {
        let adjustedYards = distYards;
        let elevAdjust = 0;
        let windAdjust = 0;

        // --- Elevation adjustment ---
        let elevDiffFeet;
        if (playerElev !== null && targetElev !== null) {
            const elevDiffMeters = targetElev - playerElev;
            elevDiffFeet = elevDiffMeters * 3.28084;
            elevAdjust = elevDiffFeet / 3;
        }

        // --- Wind adjustment ---
        if (windSpeed !== null && windDeg !== null && playerLocation) {
            const bearingToTarget = turf.bearing(
                turf.point([playerLocation.lng, playerLocation.lat]),
                turf.point([targetLng, targetLat])
            );

            const windTravelDeg = (windDeg + 180) % 360;

            let angleDiff = windTravelDeg - bearingToTarget;
            while (angleDiff > 180) angleDiff -= 360;
            while (angleDiff < -180) angleDiff += 360;

            const cosAngle = Math.cos(angleDiff * Math.PI / 180);

            if (cosAngle < 0) {
                windAdjust = distYards * Math.abs(cosAngle) * windSpeed * 0.01;
            } else {
                windAdjust = -distYards * cosAngle * windSpeed * 0.005;
            }
        }

        adjustedYards = distYards + elevAdjust + windAdjust;

        const playsLike = Math.round(adjustedYards);
        const diff = playsLike - Math.round(distYards);
        const suggestion = suggestClub(playsLike);

        return { playsLike, diff, club: suggestion.club, elevDiffFeet };
    }

    // ============================================================
    // Target markers
    // ============================================================
    function addLine(id, color) {
        map.addSource(`line-${id}`, {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
        });
        map.addLayer({
            id: `line-${id}`,
            type: 'line',
            source: `line-${id}`,
            paint: {
                'line-color': color,
                'line-width': 2,
                'line-dasharray': [4, 4],
                'line-opacity': 0.7
            }
        });
    }

    function updateLine(id, from, to) {
        const src = map.getSource(`line-${id}`);
        if (src) {
            src.setData({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [from, to]
                }
            });
        }
    }

    function removeLine(id) {
        if (map.getLayer(`line-${id}`)) map.removeLayer(`line-${id}`);
        if (map.getSource(`line-${id}`)) map.removeSource(`line-${id}`);
    }

    function calcDistance(from, to) {
        return turf.distance(
            turf.point([from.lng, from.lat]),
            turf.point(to),
            { units: 'yards' }
        );
    }

    // ============================================================
    // Combined yardage + plays-like card overlay
    // ============================================================
    const CARD_OFFSET_X = -115;
    const CARD_OFFSET_Y = -70;

    function createCombinedCard(t) {
        const container = map.getContainer();

        const overlay = document.createElement('div');
        overlay.className = 'card-overlay';
        container.appendChild(overlay);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', 'rgba(255,255,255,0.35)');
        line.setAttribute('stroke-width', '1.5');
        svg.appendChild(line);
        overlay.appendChild(svg);

        const card = document.createElement('div');
        card.className = 'combined-card';
        card.innerHTML = `
            <div class="card-left">
                <span class="card-yards">--y</span>
                <span class="card-elev"></span>
            </div>
            <div class="card-right">
                <div class="card-pl-label">Plays Like</div>
                <div class="card-pl-main">--</div>
            </div>`;
        overlay.appendChild(card);

        t.cardOverlay = overlay;
        t.cardLine = line;
        t.cardEl = card;

        positionCombinedCard(t);
    }

    function positionCombinedCard(t) {
        if (!t.cardEl) return;
        const lngLat = t.marker.getLngLat();
        const pt = map.project(lngLat);
        const cx = pt.x + CARD_OFFSET_X;
        const cy = pt.y + CARD_OFFSET_Y;

        t.cardEl.style.left = cx + 'px';
        t.cardEl.style.top = cy + 'px';

        t.cardLine.setAttribute('x1', pt.x);
        t.cardLine.setAttribute('y1', pt.y);
        t.cardLine.setAttribute('x2', cx);
        t.cardLine.setAttribute('y2', cy);
    }

    async function updateCombinedCard(yards, targetLng, targetLat) {
        if (!activeTarget || !activeTarget.cardEl) return;
        const cardEl = activeTarget.cardEl; // capture before any await

        // Update yardage immediately
        const yardsEl = cardEl.querySelector('.card-yards');
        if (yardsEl) yardsEl.textContent = yards + 'y';

        // Show plays-like immediately using wind only (no elevation wait)
        const quickResult = calcPlaysLike(yards, null, null, targetLng, targetLat);
        const plMain = cardEl.querySelector('.card-pl-main');
        if (plMain) {
            const qColor = quickResult.diff > 0 ? ' longer' : quickResult.diff < 0 ? ' shorter' : '';
            plMain.className = 'card-pl-main' + qColor;
            plMain.innerHTML = `${quickResult.playsLike}y<span class="card-pl-club">${quickResult.club}</span>`;
        }

        // Fetch elevation then refine
        const targetElev = await fetchElevation(targetLat, targetLng);
        if (!cardEl.isConnected) return; // card was removed while fetching

        const result = calcPlaysLike(yards, playerElevation, targetElev, targetLng, targetLat);

        if (plMain && plMain.isConnected) {
            const colorClass = result.diff > 0 ? ' longer' : result.diff < 0 ? ' shorter' : '';
            plMain.className = 'card-pl-main' + colorClass;
            plMain.innerHTML = `${result.playsLike}y<span class="card-pl-club">${result.club}</span>`;
        }

        const elevEl = cardEl.querySelector('.card-elev');
        if (elevEl && elevEl.isConnected) {
            if (result.elevDiffFeet !== undefined && Math.abs(result.elevDiffFeet) >= 1) {
                const ft = Math.round(Math.abs(result.elevDiffFeet));
                const uphill = result.elevDiffFeet > 0;
                elevEl.textContent = uphill ? `↑ ${ft}ft` : `↓ ${ft}ft`;
                elevEl.className = 'card-elev ' + (uphill ? 'card-elev-up' : 'card-elev-down');
            } else {
                elevEl.textContent = '';
                elevEl.className = 'card-elev';
            }
        }
    }

    function selectTarget(t) {
        // Deselect previous: show dot, hide crosshair, remove combined card
        if (activeTarget) {
            activeTarget.dotEl.classList.remove('active');
            activeTarget.dotEl.style.display = '';
            if (activeTarget.crosshairEl) activeTarget.crosshairEl.style.display = 'none';
            if (activeTarget.cardOverlay) {
                activeTarget.cardOverlay.remove();
                activeTarget.cardOverlay = null;
                activeTarget.cardEl = null;
                activeTarget.cardLine = null;
            }
            activeTarget.popup.getElement().style.display = '';
        }
        activeTarget = t;
        // Select new: hide dot, show crosshair, create combined card
        if (t) {
            t.dotEl.style.display = 'none';
            if (t.crosshairEl) t.crosshairEl.style.display = 'block';
            t.popup.getElement().style.display = 'none';

            createCombinedCard(t);

            if (playerLocation) {
                const lngLat = t.marker.getLngLat();
                const dist = calcDistance(playerLocation, [lngLat.lng, lngLat.lat]);
                updateCombinedCard(Math.round(dist), lngLat.lng, lngLat.lat);
            }
        }
    }

    function updateTargetDistance(t) {
        if (!playerLocation) return;
        const lngLat = t.marker.getLngLat();
        const dist = calcDistance(playerLocation, [lngLat.lng, lngLat.lat]);
        const yards = Math.round(dist);
        t.popup.setHTML(`<div class="yard-popup">${yards}y</div>`);
        updateLine(t.lineIdx, [playerLocation.lng, playerLocation.lat], [lngLat.lng, lngLat.lat]);

        if (t === activeTarget) {
            updateCombinedCard(yards, lngLat.lng, lngLat.lat);
        }
    }

    async function addTarget(lngLat) {
        if (!playerLocation) return;

        if (targets.length >= MAX_TARGETS) {
            const oldest = targets.shift();
            if (activeTarget === oldest) activeTarget = null;
            oldest.marker.remove();
            oldest.popup.remove();
            if (oldest.cardOverlay) oldest.cardOverlay.remove();
            removeLine(oldest.lineIdx);
        }

        const idx = targets.length;
        const lineIdx = Date.now();

        const dotEl = document.createElement('div');
        dotEl.className = `marker-dot ${DOT_CLASSES[idx % 5]}`;

        const crosshairEl = createCrosshairSVG();
        crosshairEl.style.display = 'none';

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:52px;height:52px;display:flex;align-items:center;justify-content:center;';
        wrapper.appendChild(dotEl);
        wrapper.appendChild(crosshairEl);

        const marker = new maplibregl.Marker({ element: wrapper, draggable: true })
            .setLngLat(lngLat)
            .addTo(map);

        const dist = calcDistance(playerLocation, [lngLat.lng, lngLat.lat]);
        const yards = Math.round(dist);
        const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 18,
            className: ''
        })
            .setLngLat(lngLat)
            .setHTML(`<div class="yard-popup">${yards}y</div>`)
            .addTo(map);

        addLine(lineIdx, LINE_COLORS[idx % 5]);
        updateLine(lineIdx, [playerLocation.lng, playerLocation.lat], [lngLat.lng, lngLat.lat]);

        const target = { marker, popup, lineIdx, dotEl, crosshairEl, cardOverlay: null, cardEl: null, cardLine: null };
        targets.push(target);

        // Tap marker to select it
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTarget(target);
        });

        marker.on('dragstart', () => {
            dotEl.classList.add('dragging');
            selectTarget(target);
        });
        marker.on('drag', () => {
            const pos = marker.getLngLat();
            popup.setLngLat(pos);
            const d = calcDistance(playerLocation, [pos.lng, pos.lat]);
            const y = Math.round(d);
            popup.setHTML(`<div class="yard-popup">${y}y</div>`);
            updateLine(lineIdx, [playerLocation.lng, playerLocation.lat], [pos.lng, pos.lat]);
            positionCombinedCard(target);
            const yardsEl = target.cardEl && target.cardEl.querySelector('.card-yards');
            if (yardsEl) yardsEl.textContent = y + 'y';
        });
        marker.on('dragend', () => {
            dotEl.classList.remove('dragging');
            const pos = marker.getLngLat();
            const d = calcDistance(playerLocation, [pos.lng, pos.lat]);
            const y = Math.round(d);
            popup.setHTML(`<div class="yard-popup">${y}y</div>`);
            updateCombinedCard(y, pos.lng, pos.lat);
        });

        updateClearButton();

        // Auto-select the newly placed marker
        selectTarget(target);

        if (navigator.vibrate) navigator.vibrate(15);
    }

    // ============================================================
    // Long-press to place marker (500ms hold)
    // ============================================================
    const LONG_PRESS_MS = 500;
    const MOVE_THRESHOLD = 10; // px — cancel if finger moves too far
    let lpTimer = null;
    let lpStart = null;

    map.getCanvas().addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        lpStart = { x: touch.clientX, y: touch.clientY };
        lpTimer = setTimeout(() => {
            // Convert screen point to map lngLat
            const point = map.unproject([lpStart.x, lpStart.y]);
            // Ripple feedback
            const ripple = document.createElement('div');
            ripple.className = 'tap-ripple';
            ripple.style.left = lpStart.x + 'px';
            ripple.style.top = lpStart.y + 'px';
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
            addTarget(point);
            lpTimer = null;
        }, LONG_PRESS_MS);
    }, { passive: true });

    map.getCanvas().addEventListener('touchmove', (e) => {
        if (!lpTimer || !lpStart) return;
        const touch = e.touches[0];
        const dx = touch.clientX - lpStart.x;
        const dy = touch.clientY - lpStart.y;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
            clearTimeout(lpTimer);
            lpTimer = null;
        }
    }, { passive: true });

    map.getCanvas().addEventListener('touchend', () => {
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    }, { passive: true });

    map.getCanvas().addEventListener('touchcancel', () => {
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    }, { passive: true });

    // ============================================================
    // Clear all
    // ============================================================
    function clearAllTargets() {
        while (targets.length > 0) {
            const t = targets.pop();
            t.marker.remove();
            t.popup.remove();
            if (t.cardOverlay) t.cardOverlay.remove();
            removeLine(t.lineIdx);
        }
        activeTarget = null;
        updateClearButton();
    }

    function updateClearButton() {
        const clearBtn = document.getElementById('clearBtn');
        const countEl = document.getElementById('markerCount');
        if (targets.length > 0) {
            clearBtn.classList.add('visible');
            if (targets.length > 1) {
                countEl.textContent = `${targets.length} markers`;
                countEl.classList.add('visible');
            } else {
                countEl.classList.remove('visible');
            }
        } else {
            clearBtn.classList.remove('visible');
            countEl.classList.remove('visible');
        }
    }

    document.getElementById('clearBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        clearAllTargets();
    });

    // ============================================================
    // Re-center
    // ============================================================
    document.getElementById('recenterBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (playerLocation) {
            isFollowing = true;
            map.flyTo({ center: [playerLocation.lng, playerLocation.lat], zoom: 17.5, duration: 1000 });
        } else {
            document.getElementById('gpsStatus').classList.remove('hidden');
        }
    });

    map.on('move', () => { if (activeTarget) positionCombinedCard(activeTarget); });

    map.on('dragstart', () => { isFollowing = false; });

    // ============================================================
    // Init
    // ============================================================
    map.on('load', () => { startGPS(); });
}

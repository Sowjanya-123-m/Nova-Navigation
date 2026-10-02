/* ============================================================
   Antigravity Navigator — app.js
   Full feature implementation, error-safe
   ============================================================ */

'use strict';

// ── Map initialisation ──────────────────────────────────────
const map = L.map('map', {
  zoomControl: true,
  attributionControl: true
}).setView([12.9716, 77.5946], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);

// ── State ───────────────────────────────────────────────────
let routingControl  = null;
let truckMarker     = null;
let moveInterval    = null;
let analyticsInterval = null;
let navCoords       = [];
let navIndex        = 0;
let navPlaying      = false;
let allInstructions = [];
let analyticsChart  = null;
let showAllDirs     = false;
let wpSeq           = 5;   // next waypoint number

// ── Truck icon ──────────────────────────────────────────────
const truckIcon = L.divIcon({
  html: `<div style="
    background:#2563eb;border-radius:50%;width:36px;height:36px;
    display:flex;align-items:center;justify-content:center;
    border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
    font-size:18px;line-height:1;">🚛</div>`,
  iconSize:   [36, 36],
  iconAnchor: [18, 18],
  className:  ''
});

// ── Live clock ───────────────────────────────────────────────
function updateClock() {
  const now  = new Date();
  const time = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const date = now.toLocaleDateString('en-IN',  { day:'numeric', month:'short', year:'numeric' });
  safeSetText('currentTime', time);
  safeSetText('currentDate', date);
  safeSetText('sbUpdated',   time);
}
setInterval(updateClock, 1000);
updateClock();

// ── Traffic legend ───────────────────────────────────────────
const trafficLegend = L.control({ position: 'bottomleft' });
trafficLegend.onAdd = function () {
  const div = L.DomUtil.create('div');
  div.style.cssText = [
    'background:#fff', 'border-radius:10px', 'padding:10px 14px',
    'font-size:11px', 'box-shadow:0 2px 8px rgba(0,0,0,.15)',
    'border:1px solid #e2e8f0', 'line-height:2', 'min-width:120px'
  ].join(';');
  div.innerHTML = `
    <b style="display:block;margin-bottom:4px;color:#1e293b;">Traffic Level</b>
    ${bar('#22c55e','Low')}
    ${bar('#f59e0b','Medium')}
    ${bar('#ef4444','High')}
    ${bar('#7c3aed','Very High')}`;
  return div;
};
function bar(color, label) {
  return `<div style="display:flex;align-items:center;gap:7px;">
    <span style="width:18px;height:4px;background:${color};border-radius:2px;display:inline-block;"></span>
    ${label}</div>`;
}
trafficLegend.addTo(map);

// ── Utility ──────────────────────────────────────────────────
function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function safeSetHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
function fmtDist(m) {
  if (m == null) return '';
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
}

// ── Analytics chart ──────────────────────────────────────────
let chartLabels   = [];
let chartDistance = [];
let chartFuel     = [];
let chartTraffic  = [];

function initChart() {
  const canvas = document.getElementById('analyticsChart');
  if (!canvas) return;
  if (analyticsChart) { analyticsChart.destroy(); analyticsChart = null; }

  analyticsChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        { label:'Distance (km)', data: chartDistance, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.08)', tension:.4, fill:true, pointRadius:2, borderWidth:2 },
        { label:'Fuel (₹)',      data: chartFuel,     borderColor:'#f97316', backgroundColor:'rgba(249,115,22,.06)', tension:.4, fill:true, pointRadius:2, borderWidth:2 },
        { label:'Traffic (min)', data: chartTraffic,  borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,.06)',  tension:.4, fill:true, pointRadius:2, borderWidth:2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font:{ size:9 }, color:'#94a3b8' }, grid:{ color:'#f1f5f9' } },
        y: { ticks: { font:{ size:9 }, color:'#94a3b8' }, grid:{ color:'#f1f5f9' } }
      }
    }
  });
}

function seedChart(distance, fuel, traffic) {
  chartLabels   = [];
  chartDistance = [];
  chartFuel     = [];
  chartTraffic  = [];

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const t = new Date(now - i * 60000);
    chartLabels.push(t.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }));
    const f = 1 - i * 0.14;
    chartDistance.push(+(distance * f).toFixed(1));
    chartFuel.push(+(fuel * f).toFixed(0));
    chartTraffic.push(+(traffic * f).toFixed(1));
  }
  if (analyticsChart) {
    analyticsChart.data.labels            = chartLabels;
    analyticsChart.data.datasets[0].data  = chartDistance;
    analyticsChart.data.datasets[1].data  = chartFuel;
    analyticsChart.data.datasets[2].data  = chartTraffic;
    analyticsChart.update();
  }
}

function startLiveChart(distance, fuel, traffic) {
  if (analyticsInterval) clearInterval(analyticsInterval);
  analyticsInterval = setInterval(function () {
    if (!analyticsChart) return;
    const now = new Date();
    const jitter = function(v, pct) { return +(v * (1 + (Math.random() - .5) * pct)).toFixed(1); };
    if (chartLabels.length >= 12) {
      chartLabels.shift();  chartDistance.shift();
      chartFuel.shift();    chartTraffic.shift();
    }
    chartLabels.push(now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }));
    chartDistance.push(jitter(distance, .06));
    chartFuel.push(jitter(fuel, .08));
    chartTraffic.push(jitter(traffic, .12));
    analyticsChart.data.labels            = chartLabels;
    analyticsChart.data.datasets[0].data  = chartDistance;
    analyticsChart.data.datasets[1].data  = chartFuel;
    analyticsChart.data.datasets[2].data  = chartTraffic;
    analyticsChart.update();
  }, 5000);
}

// ── Update all stats panels ───────────────────────────────────
function updateStats(distance, eta, fuel, trafficDelay, stops) {
  // Top bar
  safeSetText('topDistance', distance.toFixed(2) + ' km');
  safeSetText('topEta',      eta + ' min');
  safeSetText('topFuel',     '₹' + fuel);
  safeSetText('topTraffic',  trafficDelay + ' min');
  // Right panel cards
  safeSetText('aDistance', distance.toFixed(2) + ' km');
  safeSetText('aEta',      eta + ' min');
  safeSetText('aFuel',     '₹' + fuel);
  safeSetText('aTraffic',  trafficDelay + ' min');
  safeSetText('aStops',    stops.toString());
}

// ── Status bar ───────────────────────────────────────────────
function updateStatusBar() {
  const algo    = document.getElementById('algo');
  const mode    = document.getElementById('mode');
  const vehicle = document.getElementById('vehicle');
  if (algo)    safeSetText('sbAlgo',    algo.options[algo.selectedIndex].text.replace(/^[\S]+\s/,''));
  if (mode)    safeSetText('sbMode',    mode.options[mode.selectedIndex].text.replace(/^[\S]+\s/,''));
  if (vehicle) safeSetText('sbVehicle', vehicle.options[vehicle.selectedIndex].text.replace(/^[\S]+\s/,'').split('(')[0].trim());
}

// ── Generate / Optimise Route ────────────────────────────────
function generateRoute() {
  // Tear down previous
  if (routingControl) { try { map.removeControl(routingControl); } catch(e) {} routingControl = null; }
  if (truckMarker)    { try { map.removeLayer(truckMarker); }      catch(e) {} truckMarker    = null; }
  clearInterval(moveInterval);
  clearInterval(analyticsInterval);
  navCoords = []; navIndex = 0; navPlaying = false;
  updatePlayIcon();

  const fromEl    = document.getElementById('from');
  const toEl      = document.getElementById('to');
  const modeEl    = document.getElementById('mode');

  if (!fromEl || !toEl) return;

  const fromParts = fromEl.value.split(',').map(Number);
  const toParts   = toEl.value.split(',').map(Number);
  if (fromParts.length < 2 || toParts.length < 2) return;

  const modeText  = modeEl ? modeEl.value : '';
  let routeColor  = '#2563eb';
  if (modeText.includes('Fastest'))  routeColor = '#16a34a';
  if (modeText.includes('Fuel'))     routeColor = '#f97316';
  if (modeText.includes('Traffic'))  routeColor = '#a855f7';

  // Build waypoints list: from → intermediate stops → to
  const waypoints = [L.latLng(fromParts[0], fromParts[1])];
  document.querySelectorAll('#waypointList .waypoint-item').forEach(function (el) {
    const lat = parseFloat(el.dataset.lat);
    const lng = parseFloat(el.dataset.lng);
    if (!isNaN(lat) && !isNaN(lng)) waypoints.push(L.latLng(lat, lng));
  });
  waypoints.push(L.latLng(toParts[0], toParts[1]));

  const totalStops = waypoints.length - 1;

  routingControl = L.Routing.control({
    waypoints:          waypoints,
    routeWhileDragging: false,
    draggableWaypoints: true,
    show:               false,
    addWaypoints:       false,
    createMarker: function (i, wp, n) {
      const isStart = (i === 0);
      const isEnd   = (i === n - 1);
      let html;
      if (isStart) {
        html = `<div style="background:#16a34a;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);">A</div>`;
      } else if (isEnd) {
        html = `<div style="background:#ef4444;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);">📍</div>`;
      } else {
        html = `<div style="background:#2563eb;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);">${i}</div>`;
      }
      const sz = (isStart || isEnd) ? [32, 32] : [26, 26];
      const an = (isStart || isEnd) ? [16, 32] : [13, 26];
      return L.marker(wp.latLng, {
        icon: L.divIcon({ html, iconSize: sz, iconAnchor: an, className: '' }),
        draggable: true
      });
    },
    lineOptions: {
      styles: [{ color: routeColor, weight: 5, opacity: .85 }]
    }
  }).addTo(map);

  routingControl.on('routesfound', function (e) {
    const route   = e.routes[0];
    navCoords     = route.coordinates || [];
    allInstructions = route.instructions || [];

    const distKm  = route.summary.totalDistance / 1000;
    const etaMin  = Math.round(route.summary.totalTime / 60);
    const fuel    = Math.round(distKm * 4.5);
    const delay   = Math.round(etaMin * 0.17);

    updateStats(distKm, etaMin, fuel, delay, totalStops);
    updateStatusBar();
    renderDirections();

    // Playback slider
    const slider = document.getElementById('playbackSlider');
    if (slider) { slider.max = Math.max(navCoords.length - 1, 1); slider.value = 0; }

    // Chart
    seedChart(distKm, fuel, delay);
    startLiveChart(distKm, fuel, delay);
  });

  routingControl.on('routingerror', function (e) {
    console.warn('Routing error:', e);
    showToast('Could not find a route. Try different locations.', 'error');
  });
}

// ── Turn-by-turn directions ───────────────────────────────────
const dirIconMap = {
  'Turn right':  'fa-turn-right',
  'Turn left':   'fa-turn-left',
  'Slight right':'fa-turn-right',
  'Slight left': 'fa-turn-left',
  'Continue':    'fa-arrow-up',
  'Head':        'fa-arrow-up',
  'Roundabout':  'fa-rotate-right',
  'Destination': 'fa-flag-checkered',
  'Arrive':      'fa-flag-checkered',
  'Start':       'fa-circle-dot',
  'Depart':      'fa-circle-dot'
};

function getDirIcon(text) {
  if (!text) return 'fa-arrow-up';
  for (const [key, icon] of Object.entries(dirIconMap)) {
    if (text.includes(key)) return icon;
  }
  return 'fa-arrow-up';
}

function renderDirections() {
  const ul = document.getElementById('directions');
  if (!ul) return;
  ul.innerHTML = '';

  if (!allInstructions.length) {
    ul.innerHTML = '<li style="color:#94a3b8;font-size:12px;padding:8px;">Generate a route to see directions.</li>';
    return;
  }

  const list = showAllDirs ? allInstructions : allInstructions.slice(0, 6);
  list.forEach(function (step, i) {
    const dist    = fmtDist(step.distance);
    const icon    = getDirIcon(step.text || '');
    const isStart = (i === 0);
    const li      = document.createElement('li');
    li.className  = 'dir-item';
    li.innerHTML  = `
      <div class="dir-icon${isStart ? ' start' : ''}"><i class="fa ${icon}"></i></div>
      <div class="dir-info">
        <div class="dir-text">${step.text || 'Continue'}</div>
        ${dist ? `<div class="dir-sub">Continue for ${dist}</div>` : ''}
      </div>
      <div class="dir-dist">${dist}</div>`;
    ul.appendChild(li);
  });
}

function toggleAllDirections() {
  showAllDirs = !showAllDirs;
  renderDirections();
  const btn = document.querySelector('.view-all-btn');
  if (btn) btn.innerHTML = showAllDirs
    ? 'Show Less <i class="fa fa-chevron-up"></i>'
    : 'View Full Directions <i class="fa fa-chevron-down"></i>';
}

// ── Visual navigation ─────────────────────────────────────────
function startNavigation() {
  if (!navCoords.length) { showToast('Please click "Optimize Route" first.', 'warn'); return; }

  stopNavigation();
  navIndex   = 0;
  navPlaying = true;
  updatePlayIcon();

  if (!truckMarker) {
    truckMarker = L.marker(navCoords[0], { icon: truckIcon }).addTo(map);
  } else {
    truckMarker.setLatLng(navCoords[0]);
  }

  moveInterval = setInterval(function () {
    if (navIndex >= navCoords.length) {
      stopNavigation();
      showToast('Navigation complete!', 'success');
      return;
    }
    truckMarker.setLatLng(navCoords[navIndex]);
    map.panTo(navCoords[navIndex], { animate: true, duration: 0.25 });
    const slider = document.getElementById('playbackSlider');
    if (slider) slider.value = navIndex;
    navIndex++;
  }, 100);
}

function stopNavigation() {
  clearInterval(moveInterval);
  moveInterval = null;
  navPlaying   = false;
  updatePlayIcon();
}

function togglePlayback() {
  if (navPlaying) {
    stopNavigation();
  } else {
    if (!navCoords.length) { showToast('Generate a route first.', 'warn'); return; }
    if (navIndex >= navCoords.length) navIndex = 0;
    navPlaying = true;
    updatePlayIcon();

    if (!truckMarker) {
      truckMarker = L.marker(navCoords[0], { icon: truckIcon }).addTo(map);
    }

    moveInterval = setInterval(function () {
      if (navIndex >= navCoords.length) {
        stopNavigation();
        return;
      }
      truckMarker.setLatLng(navCoords[navIndex]);
      const slider = document.getElementById('playbackSlider');
      if (slider) slider.value = navIndex;
      navIndex++;
    }, 100);
  }
}

function seekPlayback(val) {
  navIndex = parseInt(val, 10);
  if (truckMarker && navCoords[navIndex]) {
    truckMarker.setLatLng(navCoords[navIndex]);
    map.panTo(navCoords[navIndex], { animate: false });
  }
}

function updatePlayIcon() {
  const icon = document.getElementById('playIcon');
  if (icon) icon.className = navPlaying ? 'fa fa-pause' : 'fa fa-play';
}

// ── Voice navigation ──────────────────────────────────────────
function startVoice() {
  const toggle = document.getElementById('voiceToggle');
  if (!toggle) return;
  if (!toggle.checked) toggle.checked = true;   // auto-enable

  if (typeof speechSynthesis === 'undefined') {
    showToast('Speech synthesis not supported in this browser.', 'error');
    return;
  }
  if (!allInstructions.length) {
    speechSynthesis.speak(new SpeechSynthesisUtterance('No route loaded. Please optimise a route first.'));
    return;
  }
  speechSynthesis.cancel();   // clear queue
  allInstructions.slice(0, 6).forEach(function (step, i) {
    setTimeout(function () {
      if (!document.getElementById('voiceToggle').checked) return;
      const utt  = new SpeechSynthesisUtterance(step.text || 'Continue');
      utt.rate   = 0.92;
      utt.pitch  = 1;
      speechSynthesis.speak(utt);
    }, i * 3500);
  });
}

function stopVoice() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

// ── Waypoints ────────────────────────────────────────────────
function removeWaypoint(btn) {
  btn.closest('.waypoint-item').remove();
  renumberWaypoints();
}

function renumberWaypoints() {
  const badges = document.querySelectorAll('#waypointList .wp-badge');
  badges.forEach(function (b, i) { b.textContent = i + 1; });
}

function addStop() {
  const list = document.getElementById('waypointList');
  if (!list) return;
  const n        = list.querySelectorAll('.waypoint-item').length + 1;
  const lat      = (12.950 + Math.random() * 0.030).toFixed(4);
  const lng      = (77.575 + Math.random() * 0.050).toFixed(4);
  const prioList = [['High','high'], ['Medium','medium'], ['Low','low']];
  const prio     = prioList[Math.floor(Math.random() * prioList.length)];
  const div      = document.createElement('div');
  div.className  = 'waypoint-item';
  div.dataset.lat = lat;
  div.dataset.lng = lng;
  div.innerHTML   = `
    <span class="drag-handle"><i class="fa fa-grip-vertical"></i></span>
    <span class="wp-badge blue">${n}</span>
    <span class="wp-label">Stop ${n}</span>
    <span class="wp-priority ${prio[1]}">${prio[0]}</span>
    <button class="wp-remove" onclick="removeWaypoint(this)"><i class="fa fa-xmark"></i></button>`;
  list.appendChild(div);
}

function clearAllWaypoints() {
  const list = document.getElementById('waypointList');
  if (list) list.innerHTML = '';
  safeSetText('aStops', '1');
}

// ── Toast notifications ───────────────────────────────────────
function showToast(msg, type) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.style.cssText = [
      'position:fixed', 'bottom:52px', 'left:50%',
      'transform:translateX(-50%)', 'z-index:9999',
      'padding:9px 20px', 'border-radius:20px',
      'font-size:12px', 'font-weight:600',
      'box-shadow:0 4px 16px rgba(0,0,0,.2)',
      'transition:opacity .3s', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(toast);
  }
  const colors = { success:'#16a34a', error:'#dc2626', warn:'#d97706', info:'#2563eb' };
  toast.style.background = colors[type] || colors.info;
  toast.style.color = '#fff';
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () { toast.style.opacity = '0'; }, 3000);
}

// ── Boot ──────────────────────────────────────────────────────
window.addEventListener('load', function () {
  initChart();
  generateRoute();
});

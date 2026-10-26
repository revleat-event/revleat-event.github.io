const listings = [
  { id: 1, activity: 'ランニング', title: '朝の山下公園、ゆっくり5km', area: '横浜', time: '土 07:30', distance: '5 km', pace: 'ゆっくり', paceValue: '7:00/km', host: 'Mika · Cランク', people: 'あと3人', note: '朝の空気を楽しみながら。会話できるペースです。' },
  { id: 2, activity: '散歩', title: 'みなとみらいの朝さんぽ', area: '横浜', time: '日 09:00', distance: '4 km', pace: 'ゆっくり', paceValue: '会話ペース', host: 'Ken · WALKER', people: 'あと2人', note: 'コーヒー休憩あり。初参加も歓迎です。' },
  { id: 3, activity: 'マラソン', title: '湘南国際に向けて10km', area: '鎌倉', time: '土 16:00', distance: '10 km', pace: '普通', paceValue: '6:00/km', host: 'Yuki · Bランク', people: 'あと4人', note: '大会に向けて、一定ペースで走ります。' },
];

const views = new Set(['home', 'run', 'search', 'create', 'profile', 'settings']);
const state = { view: 'home', activity: 'すべて', pace: 'すべて', area: 'すべて', joined: new Set(), notifications: [], stats: { joined: 24, monthlyKm: 186, crewDays: 12 } };
const mapPoints = { 'ランニング': { x: 286, y: 168, color: '#d9ff4a' }, '散歩': { x: 206, y: 244, color: '#8cdbff' }, 'マラソン': { x: 348, y: 104, color: '#ff745c' } };
let closeTimer;
const tracker = { status: 'ready', startedAt: 0, elapsed: 0, distance: 0, timer: null, watchId: null, lastPosition: null, gpsTimer: null, mode: 'gps' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function listingMarkup(item) {
  const joined = state.joined.has(item.id);
  return `<button class="listing-card" type="button" data-listing-id="${item.id}" aria-label="${item.title}の詳細を見る">
    <div class="listing-top"><span class="activity-label">${item.activity.toUpperCase()}</span><span class="listing-time">${item.time}</span></div>
    <h3 class="listing-title">${item.title}</h3>
    <div class="listing-data"><span class="data-chip"><strong>${item.distance}</strong></span><span class="data-chip"><strong>${item.paceValue}</strong></span><span class="data-chip">${item.area}</span></div>
    <div class="listing-bottom"><span>${joined ? '✓ 参加申請済み' : item.host}</span><span>${item.people}</span></div>
  </button>`;
}

function matches(item) {
  return (state.activity === 'すべて' || item.activity === state.activity) && (state.pace === 'すべて' || item.pace === state.pace) && (state.area === 'すべて' || item.area === state.area);
}

function renderListings() {
  const home = $('#home-listings');
  const results = listings.filter(matches);
  if (home) home.innerHTML = listings.slice(0, 3).map(listingMarkup).join('');
  const search = $('#search-listings');
  if (search) search.innerHTML = results.length ? results.map(listingMarkup).join('') : '<div class="empty-state"><strong>条件に合う募集がありません。</strong><span>フィルターを変えて探してみよう。</span></div>';
  const count = $('#search-count');
  if (count) count.textContent = `${String(results.length).padStart(2, '0')} MATCHES`;
  $$('.listing-card').forEach(card => card.addEventListener('click', () => openDetail(Number(card.dataset.listingId))));
  renderMaps();
}

function renderMaps() {
  $$('[data-map-markers], #map-markers').forEach(layer => {
    layer.innerHTML = listings.filter(matches).map(item => {
      const point = mapPoints[item.activity] || mapPoints['ランニング'];
      return `<g class="map-marker" transform="translate(${point.x} ${point.y})" data-map-listing="${item.id}" tabindex="0" role="button" aria-label="${item.title}"><circle class="marker-halo" r="17"/><circle class="marker-dot" r="8" fill="${point.color}"/><text x="13" y="4">${item.area}</text></g>`;
    }).join('');
    $$('.map-marker', layer).forEach(marker => { marker.addEventListener('click', () => openDetail(Number(marker.dataset.mapListing))); marker.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openDetail(Number(marker.dataset.mapListing)); }); });
  });
}

function locateMe() {
  const update = (x, y, label) => { $$('[data-current-marker], #current-location-marker').forEach(marker => marker.setAttribute('transform', `translate(${x} ${y})`)); $$('#location-label').forEach(node => { node.textContent = label; }); showToast(label); };
  if (!navigator.geolocation) { update(286, 168, '現在地：横浜駅付近（デモ）'); return; }
  navigator.geolocation.getCurrentPosition(position => { const x = Math.max(70, Math.min(520, 286 + (position.coords.longitude - 139.62) * 900)); const y = Math.max(50, Math.min(310, 168 - (position.coords.latitude - 35.45) * 900)); update(x, y, '現在地：位置情報を取得しました'); }, () => update(286, 168, '現在地：横浜駅付近（デモ）'), { enableHighAccuracy: false, timeout: 5000 });
}

function openDetail(id) {
  const item = listings.find(listing => listing.id === id);
  if (!item) return;
  const joined = state.joined.has(id);
  clearTimeout(closeTimer);
  $('#detail-content').innerHTML = `<p class="detail-kicker">${item.activity.toUpperCase()} / ${item.area}</p><h2>${item.title}</h2><p>${item.note}</p><div class="listing-data"><span class="data-chip"><strong>${item.distance}</strong></span><span class="data-chip"><strong>${item.paceValue}</strong></span><span class="data-chip">${item.host}</span></div><div class="detail-meta"><div><span>WHEN</span><strong>${item.time}</strong></div><div><span>SPOTS</span><strong>${item.people}</strong></div><div><span>PACE</span><strong>${item.pace}</strong></div><div><span>AREA</span><strong>${item.area}</strong></div></div><button class="primary-button detail-action" type="button" data-join-id="${id}">${joined ? '参加申請済み' : 'この募集に参加する'} <span>${joined ? '✓' : '↗'}</span></button>`;
  $('#modal-backdrop').hidden = false;
  $('#detail-sheet').classList.add('open');
  $('#detail-sheet').setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  $('[data-join-id]')?.addEventListener('click', () => joinListing(id));
}

function closeDetail() {
  const sheet = $('#detail-sheet');
  if (!sheet.classList.contains('open')) return;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => { $('#modal-backdrop').hidden = true; }, 320);
}

function joinListing(id) {
  if (!state.joined.has(id)) state.stats.joined += 1;
  state.joined.add(id);
  const item = listings.find(listing => listing.id === id);
  addNotification('参加申請を送信しました', `${item?.title || '募集'}への参加申請を確認できます。`);
  renderProfileStats();
  renderListings();
  openDetail(id);
  showToast('参加申請を送信しました');
}

function setView(view, updateHash = true) {
  if (!views.has(view)) view = 'home';
  state.view = view;
  closeDetail();
  $$('[data-view-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  $$('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (button.classList.contains('nav-item')) button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (updateHash && window.location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'search') renderListings();
}

function setFilter(group, value) {
  state[group] = value;
  $$(`[data-filter-group="${group}"] .filter-chip`).forEach(chip => {
    const active = chip.dataset.value === value;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  renderListings();
}

function resetFilters() {
  state.activity = 'すべて';
  state.pace = 'すべて';
  state.area = 'すべて';
  ['activity', 'pace', 'area'].forEach(group => {
    $$(`[data-filter-group="${group}"] .filter-chip`).forEach(chip => {
      const active = chip.dataset.value === 'すべて';
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  });
  renderListings();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function addNotification(title, body) {
  state.notifications.unshift({ id: Date.now(), title, body, time: 'たった今' });
  renderNotifications();
}

function renderNotifications() {
  const list = $('#notification-list');
  const count = $('#notification-count');
  const dot = $('.notification-dot');
  if (!list || !count || !dot) return;
  count.textContent = state.notifications.length;
  dot.hidden = state.notifications.length === 0;
  list.innerHTML = state.notifications.length ? state.notifications.map(item => `<article class="notification-item"><span class="notification-mark">•</span><div><strong>${item.title}</strong><p>${item.body}</p><small>${item.time}</small></div></article>`).join('') : '<div class="notification-empty"><span class="notification-empty-mark">✓</span><strong>通知はありません</strong><p>新しいお知らせが届くと、ここに表示されます。</p></div>';
}

function toggleNotifications(force) {
  const panel = $('#notification-panel');
  const button = $('#notification-button');
  if (!panel || !button) return;
  const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

function renderProfileStats() {
  $('#stat-joined').textContent = state.stats.joined;
  $('#stat-km').textContent = state.stats.monthlyKm.toFixed(1).replace('.0', '');
  $('#stat-days').textContent = state.stats.crewDays;
  if ($('#run-page-km')) $('#run-page-km').textContent = state.stats.monthlyKm.toFixed(1).replace('.0', '');
  if ($('#run-page-days')) $('#run-page-days').textContent = state.stats.crewDays;
}

function formatTrackerTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatPace() {
  if (!tracker.distance || !tracker.elapsed) return '--:--';
  const totalMinutes = tracker.elapsed / 60 / tracker.distance;
  const mins = Math.floor(totalMinutes);
  const secs = Math.round((totalMinutes - mins) * 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function renderTracker() {
  $('#tracker-time').textContent = formatTrackerTime(tracker.elapsed);
  $('#tracker-distance').textContent = tracker.distance.toFixed(2);
  $('#tracker-pace').textContent = formatPace();
  $('#tracker-live').textContent = tracker.status === 'running' ? (tracker.mode === 'gps' ? 'GPS LIVE' : 'SIM LIVE') : tracker.status.toUpperCase();
  const start = $('#tracker-start');
  const pause = $('#tracker-pause');
  const finish = $('#tracker-finish');
  if (!start) return;
  start.innerHTML = tracker.status === 'paused' ? '再開する <span>▶</span>' : tracker.status === 'running' ? '測定中 <span>●</span>' : '測定を開始 <span>▶</span>';
  pause.disabled = tracker.status !== 'running';
  finish.disabled = tracker.status !== 'running' && tracker.status !== 'paused';
}

function stopTrackerSources() {
  clearInterval(tracker.timer); tracker.timer = null;
  clearTimeout(tracker.gpsTimer); tracker.gpsTimer = null;
  if (tracker.watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(tracker.watchId);
  tracker.watchId = null;
}

function useSimulation() {
  tracker.mode = 'simulation';
  $('#tracker-status').textContent = 'GPSを使えないため、6:20/kmのシミュレーションで測定中です。';
}

function startTracker() {
  if (tracker.status === 'finished') { tracker.elapsed = 0; tracker.distance = 0; tracker.lastPosition = null; }
  if (tracker.status === 'running') return;
  tracker.status = 'running';
  tracker.startedAt = Date.now() - tracker.elapsed * 1000;
  tracker.mode = 'gps';
  $('#tracker-status').textContent = 'GPS位置情報を待っています。動かない場合は自動でシミュレーションへ切り替えます。';
  tracker.timer = window.setInterval(() => { tracker.elapsed = Math.floor((Date.now() - tracker.startedAt) / 1000); if (tracker.mode === 'simulation') tracker.distance += 0.00263; renderTracker(); }, 1000);
  tracker.gpsTimer = window.setTimeout(() => { if (!tracker.lastPosition) useSimulation(); }, 5000);
  if (navigator.geolocation) tracker.watchId = navigator.geolocation.watchPosition(position => {
    if (tracker.lastPosition) tracker.distance += haversineKm(tracker.lastPosition, position);
    tracker.lastPosition = position;
    tracker.mode = 'gps';
    $('#tracker-status').textContent = 'GPS位置情報で測定中です。';
  }, () => useSimulation(), { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 });
  else useSimulation();
  renderTracker();
}

function haversineKm(a, b) {
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(b.coords.latitude - a.coords.latitude);
  const dLon = toRad(b.coords.longitude - a.coords.longitude);
  const lat1 = toRad(a.coords.latitude); const lat2 = toRad(b.coords.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pauseTracker() {
  if (tracker.status !== 'running') return;
  tracker.status = 'paused'; stopTrackerSources(); renderTracker(); $('#tracker-status').textContent = '一時停止中。再開するか、終了して保存できます。';
}

function finishTracker() {
  if (tracker.status !== 'running' && tracker.status !== 'paused') return;
  stopTrackerSources(); tracker.status = 'finished';
  if (tracker.distance > 0) { state.stats.monthlyKm += tracker.distance; state.stats.crewDays += 1; renderProfileStats(); addNotification('ランニング記録を保存しました', `${tracker.distance.toFixed(2)}km / ${formatTrackerTime(tracker.elapsed)} を今月の記録に追加しました。`); }
  renderTracker(); $('#tracker-status').textContent = `今回のラン ${tracker.distance.toFixed(2)}km を今月の記録へ保存しました。`;
  showToast('ランニング記録を保存しました');
}

$$('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('.wordmark')?.addEventListener('click', event => { event.preventDefault(); setView('home'); });
$('#notification-button')?.addEventListener('click', () => toggleNotifications());
document.addEventListener('click', event => { if (!event.target.closest('.header-actions')) toggleNotifications(false); });
$$('[data-filter-group]').forEach(group => {
  const key = group.dataset.filterGroup;
  $$('.filter-chip', group).forEach(chip => chip.addEventListener('click', () => setFilter(key, chip.dataset.value)));
});
$$('[data-filter-activity]').forEach(button => button.addEventListener('click', () => { setView('search'); setFilter('activity', button.dataset.filterActivity); }));
$$('[data-create-group]').forEach(group => $$('.segment', group).forEach(segment => segment.addEventListener('click', () => {
  $$('.segment', group).forEach(item => { item.classList.remove('active'); item.setAttribute('aria-pressed', 'false'); });
  segment.classList.add('active');
  segment.setAttribute('aria-pressed', 'true');
})));
$('#reset-filters')?.addEventListener('click', resetFilters);
$('#locate-me')?.addEventListener('click', locateMe);
$('#locate-me-search')?.addEventListener('click', locateMe);
$('#tracker-start')?.addEventListener('click', startTracker);
$('#tracker-pause')?.addEventListener('click', pauseTracker);
$('#tracker-finish')?.addEventListener('click', finishTracker);
$$('[data-start-run]').forEach(button => button.addEventListener('click', () => { setView('profile'); window.setTimeout(startTracker, 180); }));
$$('[data-run-search]').forEach(button => button.addEventListener('click', () => { setView('search'); setFilter('activity', 'ランニング'); }));
$$('[data-setting]').forEach(row => row.addEventListener('click', () => {
  const toggle = $('.toggle', row);
  if (toggle) toggle.classList.toggle('active');
  showToast(`${row.dataset.setting}の設定を更新しました`);
}));
$('#close-sheet')?.addEventListener('click', closeDetail);
$('#modal-backdrop')?.addEventListener('click', closeDetail);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDetail(); });
window.addEventListener('hashchange', () => setView(window.location.hash.slice(1), false));

$('#create-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const selectedActivity = $('.segment.active')?.dataset.value || 'ランニング';
  const newListing = { id: Date.now(), activity: selectedActivity, title: `${form.get('area')}で${selectedActivity}仲間を募集`, area: form.get('area'), time: form.get('date'), distance: form.get('distance'), pace: form.get('pace'), paceValue: form.get('pace') === 'ゆっくり' ? '7:00/km' : form.get('pace') === '速め' ? '5:00/km' : '6:00/km', host: 'あなた · Cランク', people: 'あと3人', note: form.get('note') };
  listings.unshift(newListing);
  renderListings();
  showToast('募集を公開しました');
  setView('search');
});

$$('.filter-chip').forEach(chip => chip.setAttribute('aria-pressed', chip.classList.contains('active') ? 'true' : 'false'));
$$('.segment').forEach(segment => segment.setAttribute('aria-pressed', segment.classList.contains('active') ? 'true' : 'false'));
renderListings();
renderProfileStats();
renderTracker();
renderNotifications();
const initialView = window.location.hash.slice(1);
setView(views.has(initialView) ? initialView : 'home', false);

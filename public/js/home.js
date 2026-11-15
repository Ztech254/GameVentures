import { $, $$, api, esc, money, fmtDate, icon, CATEGORIES, VEHICLES, vehicle, ridePill, cardHTML, heartBtn,
  interestedText, mountLayout, setupReveal, openAuth, state } from './app.js';

await mountLayout();

const params = new URLSearchParams(location.search);
let category = params.get('category') || 'all';
let q = params.get('q') || '';
$('#q').value = q; $('#cat').value = category;

// ------------------------------------------------ category tiles + filter chips
$('#cat-grid').innerHTML = Object.entries(CATEGORIES).map(([k, c]) =>
  `<button class="cat reveal" style="--g:${c.g}" data-cat="${k}"><span class="ico" aria-hidden="true">${c.ico}</span><strong>${esc(c.label)}</strong><span>Explore trips →</span></button>`).join('');
$('#filters').innerHTML = [['all', { label: 'All adventures', ico: '🧭' }], ...Object.entries(CATEGORIES)].map(([k, c]) =>
  `<button class="chip" data-filter="${k}" aria-pressed="${k === category}">${c.ico} ${esc(c.label)}</button>`).join('');

function setCategory(k, scroll) {
  category = k; $('#cat').value = k;
  $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.filter === k));
  loadTrips();
  if (scroll) $('#trips').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
$('#filters').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (b) setCategory(b.dataset.filter); });
$('#cat-grid').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) setCategory(b.dataset.cat, true); });
$('#search').addEventListener('submit', e => {
  e.preventDefault(); q = $('#q').value.trim(); setCategory($('#cat').value, true);
});

// ------------------------------------------------ trip grid
async function loadTrips() {
  const grid = $('#grid');
  const url = new URL('/api/tours', location.origin);
  if (category !== 'all') url.searchParams.set('category', category);
  if (q) url.searchParams.set('q', q);
  const qs = new URLSearchParams({ ...(category !== 'all' && { category }), ...(q && { q }) }).toString();
  history.replaceState(null, '', `${qs ? '?' + qs : location.pathname}${location.hash}`);
  try {
    const trips = await api(url.pathname + url.search);
    grid.innerHTML = trips.length ? trips.map(cardHTML).join('')
      : `<div class="empty" style="grid-column:1/-1"><h3>No trips found 🏕️</h3><p>Try another adventure type or search term. New trips drop every week!</p></div>`;
    $('#trips-sub').textContent = q ? `Showing results for “${q}”` : 'Every trip includes transport from Nairobi, expert guides and memories you\'ll brag about.';
    setupReveal(grid);
  } catch { grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Could not load trips. Please refresh.</div>'; }
}

// ------------------------------------------------ spotlight ad card
async function loadSpotlight() {
  const all = await api('/api/tours');
  const t = all.find(x => x.featured) || all[0];
  if (!t) { $('#spotlight').hidden = true; return; }
  const pct = Math.min(100, Math.round(t.slots_booked / t.slots_total * 100));
  const v = vehicle(t.transport);
  const alt = /(\d[\d,]{2,}\s?m)/.exec(t.tagline || '')?.[1];
  $('#spotlight-card').innerHTML = `<article class="spotlight reveal">
    <div class="spotlight-media">
      <img src="${esc(t.image)}" alt="${esc(t.title)}" loading="lazy">
      <div class="spotlight-badges"><span class="badge badge-hot">🔥 Featured</span><span class="badge badge-glass">${esc(CATEGORIES[t.category]?.label || t.category)}</span>${t.difficulty ? `<span class="badge badge-glass">${esc(t.difficulty)}</span>` : ''}</div>
      ${t.gallery?.length > 1 ? `<div class="thumbs-strip" aria-hidden="true">${t.gallery.slice(1, 3).map(g => `<img src="${esc(g)}" alt="" loading="lazy">`).join('')}<span>${t.gallery.length} 📷</span></div>` : ''}
      ${alt ? `<div class="spotlight-alt"><small>Summit</small>${esc(alt)}</div>` : ''}
    </div>
    <div class="spotlight-body">
      <span class="where">${icon.pin}${esc(t.location)} · ${fmtDate(t.start_date)}</span>
      <h3><a href="/tour?id=${t.id}">${esc(t.title)}</a></h3>
      <p class="tagline">${esc(t.tagline || '')}</p>
      <ul class="activity-chips" aria-label="Activities">${t.activities.slice(0, 6).map(a => `<li>${esc(a.replace(/^\d{1,2}:\d{2}\s?[AP]M\s?-\s?/i, ''))}</li>`).join('')}</ul>
      ${v ? `<div>${ridePill(t)}<p class="small" style="color:rgb(255 255 255/.6);margin:.5em 0 0">${esc(t.transport_note || v.blurb)}</p></div>` : ''}
      <div class="countdown" aria-label="Time until departure"><div><strong data-cd="d">0</strong><span>Days</span></div><div><strong data-cd="h">0</strong><span>Hrs</span></div><div><strong data-cd="m">0</strong><span>Min</span></div><div><strong data-cd="s">0</strong><span>Sec</span></div></div>
      <div class="slots-meter"><div class="row"><span data-interest-count="${t.id}">${interestedText(t.interested_count)}</span><strong>${t.slots_left} of ${t.slots_total} slots left</strong></div>
        <div class="meter"><i style="width:${pct}%"></i></div></div>
      <div class="spotlight-foot">
        <div class="price">${money(t.price)} <small>/ person</small></div>
        <div class="actions">${heartBtn(t)}<a class="btn btn-ghost" href="/tour?id=${t.id}">Full details & photos</a><a class="btn" href="/tour?id=${t.id}#book">Book my slot →</a></div>
      </div>
    </div></article>`;
  setupReveal($('#spotlight'));
  const target = new Date(t.start_date + 'T05:00:00').getTime();
  const tick = () => {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const vals = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
    $$('[data-cd]').forEach(el => el.textContent = String(vals[el.dataset.cd]).padStart(2, '0'));
  };
  tick(); setInterval(tick, 1000);
}

// ------------------------------------------------ fleet
$('#fleet-grid').innerHTML = Object.values(VEHICLES).map(v => `<article class="vehicle reveal">
  <div class="art">${v.svg}</div><h3>${esc(v.name)}</h3><p>${esc(v.blurb)}</p>
  <ul>${v.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul></article>`).join('');

$('#cta-join').addEventListener('click', e => {
  e.preventDefault();
  if (state.me) location.href = '/account'; else openAuth('register');
});
if (state.me) $('#cta-join').textContent = 'Go to my trips';

await Promise.all([loadSpotlight(), loadTrips()]);
setupReveal();

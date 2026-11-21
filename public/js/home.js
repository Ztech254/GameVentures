import { $, $$, api, esc, money, fmtDate, icon, CATEGORIES, VEHICLES, vehicle, ridePill, cardHTML, heartBtn,
  interestedText, mountLayout, setupReveal, openAuth, state, PLACES, NAIROBI, placeFor, driveText } from './app.js';

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
function searchPlace(text) {
  q = text; $('#q').value = text; setCategory('all', true);
}
// "Popular" links in the hero search without a page reload
$('.hero-quick').addEventListener('click', e => {
  const a = e.target.closest('a[href*="q="]');
  if (!a) return;
  e.preventDefault(); searchPlace(new URL(a.href).searchParams.get('q'));
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
  renderExplore(all);
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

// ------------------------------------------------ explore map
// Simple equirectangular projection of Kenya into a 440x510 box.
const px = (lat, lon) => [+((lon - 33.6) * 50).toFixed(1), +((5.3 - lat) * 50).toFixed(1)];
const poly = pts => 'M' + pts.map(([la, lo]) => px(la, lo).join(' ')).join('L') + 'Z';
const KENYA = [[5, 35.3], [4.4, 36.05], [4.45, 37], [3.65, 38.1], [3.55, 39.05], [3.5, 39.6], [3.95, 41.15], [3.95, 41.88],
  [2.8, 41], [-0.85, 41], [-1.68, 41.56], [-2, 41.2], [-2.3, 40.85], [-2.55, 40.3], [-3.2, 40.12], [-3.65, 39.85], [-4.05, 39.68],
  [-4.68, 39.2], [-3.05, 37.7], [-1, 34.07], [-0.35, 34.1], [0.25, 33.95], [0.6, 34.1], [1, 34.5], [1.3, 34.8], [1.9, 35],
  [2.5, 34.9], [3.5, 34.4], [4.62, 34]];
const TURKANA = [[4.6, 36.05], [4.2, 36.3], [3.5, 36.25], [2.9, 36.55], [2.4, 36.65], [2.6, 36.45], [3.3, 36], [4, 35.95]];

function renderExplore(trips) {
  const byPlace = new Map();
  for (const t of trips) {
    const p = placeFor(t);
    if (p) (byPlace.get(p.key) || byPlace.set(p.key, []).get(p.key)).push(t);
  }
  const [nx, ny] = px(NAIROBI.lat, NAIROBI.lon);
  const open = PLACES.filter(p => byPlace.has(p.key));
  const radar = PLACES.filter(p => !byPlace.has(p.key));

  const route = p => {
    const [x, y] = px(p.lat, p.lon);
    const mx = (nx + x) / 2, my = (ny + y) / 2, len = Math.hypot(x - nx, y - ny);
    const bend = Math.min(40, len * .25);   // bow each road a little so they read as roads, not rays
    const cx = mx - (y - ny) / len * bend, cy = my + (x - nx) / len * bend;
    return `<path class="route" data-key="${p.key}" pathLength="100" d="M${nx} ${ny}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x} ${y}"/>`;
  };
  // Nearby pins share one label so the Rift Valley cluster stays readable.
  const groups = [];
  for (const p of open) {
    const [x, y] = px(p.lat, p.lon);
    const g = groups.find(g => Math.hypot(g.x - x, g.y - y) < 22);
    g ? g.items.push(p) : groups.push({ x, y, items: [p] });
  }
  const label = g => {
    const left = g.x < nx || g.x > 330;     // west of Nairobi, or near the coast edge → label on the left
    const area = g.items.find(p => p.area)?.area;
    const text = g.items.length > 1 ? (area ? `${area} area · ${g.items.length}` : `${g.items[0].name} +${g.items.length - 1}`) : g.items[0].name;
    return `<text class="pin-label" x="${g.x + (left ? -12 : 12)}" y="${g.y + 4}" text-anchor="${left ? 'end' : 'start'}">${esc(text)}</text>`;
  };

  $('#kenya-map').insertAdjacentHTML('beforeend', `
    <defs><radialGradient id="land-g" cx="40%" cy="45%" r="70%"><stop offset="0" stop-color="#244a35"/><stop offset="1" stop-color="#152c20"/></radialGradient></defs>
    <path class="land" d="${poly(KENYA)}"/>
    <circle class="water" cx="${px(-1, 32.9)[0]}" cy="${px(-1, 32.9)[1]}" r="58"/>
    <ellipse class="water" cx="${px(-0.32, 34.55)[0]}" cy="${px(-0.32, 34.55)[1]}" rx="16" ry="5"/>
    <path class="water" d="${poly(TURKANA)}"/>
    <text class="water-label" x="${px(-0.2, 33.7)[0]}" y="${px(-1.9, 33.7)[1]}">L. Victoria</text>
    <text class="water-label ocean" x="338" y="430">Indian Ocean</text>
    ${radar.map(p => { const [x, y] = px(p.lat, p.lon); return `<g class="pin pin-radar"><circle cx="${x}" cy="${y}" r="4"/><text x="${x + 9}" y="${y + 4}">${esc(p.name)}</text></g>`; }).join('')}
    <g class="routes">${open.map(route).join('')}</g>
    ${open.map(p => { const [x, y] = px(p.lat, p.lon); return `<a href="#trips" class="pin pin-trip" data-key="${p.key}" aria-label="${esc(p.name)}: ${byPlace.get(p.key).length} trips"><circle class="pulse" cx="${x}" cy="${y}" r="7"/><circle cx="${x}" cy="${y}" r="7"/></a>`; }).join('')}
    ${groups.map(label).join('')}
    <g class="hub"><circle cx="${nx}" cy="${ny}" r="10"/><circle cx="${nx}" cy="${ny}" r="4" fill="#0b1510"/><text x="${nx + 14}" y="${ny + 20}">Nairobi · start</text></g>`);

  $('#dest-list').innerHTML = open.sort((a, b) => a.km - b.km).map(p => {
    const list = byPlace.get(p.key).sort((a, b) => a.start_date.localeCompare(b.start_date));
    const next = list[0], from = Math.min(...list.map(t => t.price));
    return `<li><button type="button" class="dest" data-key="${p.key}" data-q="${esc(p.name)}">
      <span class="dest-dist"><strong>${esc(p.hrs)}${/day/.test(p.hrs) ? '' : 'h'}</strong><small>${p.km} km</small></span>
      <span class="dest-main"><strong>${esc(p.name)}</strong><small>${list.length} trip${list.length > 1 ? 's' : ''} · next ${fmtDate(next.start_date, { day: 'numeric', month: 'short' })}</small></span>
      <span class="dest-price"><small>from</small>${money(from)}</span></button></li>`;
  }).join('') + (radar.length ? `<li class="radar"><span class="small">On our radar next:</span> ${radar.map(p => `<span class="radar-chip">${esc(p.name)}</span>`).join('')}</li>` : '');

  const highlight = key => $$('#explore [data-key]').forEach(el => el.classList.toggle('hl', el.dataset.key === key));
  const pick = key => { const p = PLACES.find(x => x.key === key); if (p) searchPlace(p.name); };
  $('#explore').addEventListener('pointerover', e => highlight(e.target.closest('[data-key]')?.dataset.key));
  $('#explore').addEventListener('focusin', e => highlight(e.target.closest('[data-key]')?.dataset.key));
  $('#explore').addEventListener('pointerleave', () => highlight(null));
  $('#explore').addEventListener('click', e => {
    const el = e.target.closest('.dest, .pin-trip');
    if (el) { e.preventDefault(); pick(el.dataset.key); }
  });
}

// ------------------------------------------------ convoy
$$('[data-icon]').forEach(el => el.innerHTML = icon[el.dataset.icon] || '');
const convoyOrder = [['landcruiser', 'Lead'], ['safarivan'], ['landcruiser'], ['bus'], ['shuttle'], ['landcruiser', 'Sweep']];
const train = convoyOrder.map(([k, tag]) => `<div class="cv">${tag ? `<span class="cv-tag">${tag}</span>` : ''}${VEHICLES[k].svg}</div>`).join('');
$('#convoy-train').innerHTML = `<div class="cv-set">${train}</div><div class="cv-set" aria-hidden="true">${train}</div>`;
$('#crew-wa').href = 'https://wa.me/254700000000?text=' + encodeURIComponent(
  "Hi GameVentures! I'd like to plan a group trip / private convoy.\nGroup size: \nWhere to: \nDates: ");

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
// Content above the target loads late, so re-apply a deep link like /#explore once it's in place.
if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();

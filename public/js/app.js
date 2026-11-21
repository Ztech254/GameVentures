// Shared helpers for every page: API, header/footer, auth dialog, trip cards, vehicles, toasts.
document.documentElement.classList.add('js');

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = n => 'KES ' + Number(n || 0).toLocaleString('en-KE');
export const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-KE', opts);

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
  return data;
}

export function toast(msg, type = '') {
  let host = $('.toast-host');
  if (!host) { host = Object.assign(document.createElement('div'), { className: 'toast-host' }); host.setAttribute('role', 'status'); document.body.append(host); }
  const t = Object.assign(document.createElement('div'), { className: `toast ${type}`, textContent: msg });
  host.append(t);
  setTimeout(() => t.remove(), 4200);
}

// ------------------------------------------------------------ icons + catalogues
export const icon = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="8" width="12" height="14" rx="2"/><path d="M9 8 15 2M10 13h4M10 17h4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8 3.2C20 15.8 12 21 12 21z"/></svg>'
};

export const CATEGORIES = {
  hike: { label: 'Hikes & Climbs', ico: '⛰️', g: 'linear-gradient(135deg,#ff6b2c,#b8410e)' },
  safari: { label: 'Game Parks & Safaris', ico: '🦁', g: 'linear-gradient(135deg,#c98a1a,#7a4a00)' },
  water: { label: 'Rivers & Lakes', ico: '🌊', g: 'linear-gradient(135deg,#1f8a8a,#0d4a52)' },
  roadtrip: { label: 'Road Trips', ico: '🛣️', g: 'linear-gradient(135deg,#2c4a38,#12251b)' },
  games: { label: 'Games & Fun', ico: '🎯', g: 'linear-gradient(135deg,#8b3fd1,#4a1b7a)' }
};

const wheel = (x, y = 72) => `<circle cx="${x}" cy="${y}" r="12" fill="#16201a"/><circle cx="${x}" cy="${y}" r="5" fill="#e9dfcf"/>`;
export const VEHICLES = {
  landcruiser: {
    name: 'Land Cruiser 4x4', short: 'Land Cruiser 4x4',
    blurb: 'Rugged, go-anywhere 4x4s with pop-up roofs - built for rough roads, steep tracks and game drives.',
    perks: ['Pop-up roof for 360° views', 'Max 7 guests - window seat guaranteed', 'Charging ports & cooler box', 'Off-road ready, any terrain'],
    svg: `<svg viewBox="0 0 170 96" aria-hidden="true"><rect x="40" y="12" width="76" height="4" rx="2" fill="#7a8c80"/><path d="M46 16h64v12H46z" fill="#e9dfcf"/><path d="M48 16v12M108 16v12" stroke="#2c4a38" stroke-width="2"/><path d="M22 46 34 28h88l12 18h16a6 6 0 0 1 6 6v18H14V54a8 8 0 0 1 8-8z" fill="#ffc145"/><path d="M39 31h26v14H31z" fill="#12251b"/><rect x="69" y="31" width="25" height="14" fill="#12251b"/><path d="M98 31h21l9 14H98z" fill="#12251b"/><rect x="14" y="56" width="142" height="4" fill="#ff6b2c"/><rect x="136" y="26" width="3" height="22" fill="#2c4a38"/><circle cx="12" cy="58" r="8" fill="#16201a" stroke="#ffc145" stroke-width="2"/><rect x="150" y="62" width="10" height="5" rx="2" fill="#2c4a38"/>${wheel(44)}${wheel(124)}</svg>`
  },
  safarivan: {
    name: 'Pop-up Roof Safari Van', short: 'Safari van',
    blurb: 'Classic Kenyan safari vans with a lifting roof so you can stand up and photograph wildlife.',
    perks: ['Pop-up roof', 'Window seat for everyone', 'Binoculars on board', 'Experienced driver-guide'],
    svg: `<svg viewBox="0 0 170 96" aria-hidden="true"><path d="M44 12h70l4 12H40z" fill="#e9dfcf"/><path d="M18 30a8 8 0 0 1 8-8h100l22 22a10 10 0 0 1 4 8v18H14V34z" fill="#e9dfcf"/><path d="M22 30h22v14H22zM48 30h22v14H48zM74 30h22v14H74zM100 30h24l14 14h-38z" fill="#12251b"/><rect x="14" y="54" width="138" height="5" fill="#ff6b2c"/><rect x="14" y="60" width="138" height="3" fill="#ffc145"/>${wheel(42)}${wheel(124)}</svg>`
  },
  bus: {
    name: 'Adventure Coach Bus', short: 'Coach bus',
    blurb: 'Comfortable air-conditioned coaches for bigger groups and long road trips - the party starts on the road.',
    perks: ['Reclining seats & AC', 'USB charging', 'Sound system & playlists', 'Big luggage hold'],
    svg: `<svg viewBox="0 0 170 96" aria-hidden="true"><rect x="8" y="20" width="154" height="50" rx="10" fill="#ff6b2c"/><path d="M146 24h8a6 6 0 0 1 6 6v22h-14z" fill="#12251b"/><g fill="#12251b"><rect x="16" y="28" width="20" height="16" rx="3"/><rect x="40" y="28" width="20" height="16" rx="3"/><rect x="64" y="28" width="20" height="16" rx="3"/><rect x="88" y="28" width="20" height="16" rx="3"/><rect x="112" y="28" width="20" height="16" rx="3"/></g><rect x="8" y="50" width="154" height="5" fill="#ffc145"/><rect x="134" y="44" width="10" height="24" fill="#b8410e"/><rect x="24" y="14" width="40" height="6" rx="2" fill="#7a8c80"/>${wheel(38)}${wheel(128)}</svg>`
  },
  shuttle: {
    name: 'Tour Shuttle (14-seater)', short: 'Tour shuttle',
    blurb: 'Nimble 14-seater shuttles for day trips - quick pick-ups and roof racks for bikes and gear.',
    perks: ['14 comfy seats', 'Roof rack for gear', 'Pick-up points in Nairobi', 'Great for day trips'],
    svg: `<svg viewBox="0 0 170 96" aria-hidden="true"><rect x="30" y="14" width="80" height="5" rx="2" fill="#7a8c80"/><path d="M18 28a8 8 0 0 1 8-8h96l26 24a10 10 0 0 1 4 8v18H14V32z" fill="#4fd18b"/><path d="M24 27h24v15H24zM52 27h24v15H52zM80 27h24v15H80zM108 27h12l20 15h-32z" fill="#12251b"/><rect x="14" y="52" width="138" height="5" fill="#12251b"/>${wheel(42)}${wheel(124)}</svg>`
  }
};
export const vehicle = key => VEHICLES[key] || null;

// ------------------------------------------------------------ places (map + route info)
// Matched against a trip's location text. Road distance / drive time are approximate, from Nairobi CBD.
export const NAIROBI = { lat: -1.286, lon: 36.817 };
export const PLACES = [
  { key: 'longonot', name: 'Mt Longonot', match: /longonot/i, area: 'Naivasha', lat: -0.914, lon: 36.446, km: 60, hrs: '1.5' },
  { key: 'hellsgate', name: "Hell's Gate", match: /hell'?s gate/i, area: 'Naivasha', lat: -0.912, lon: 36.31, km: 95, hrs: '2' },
  { key: 'naivasha', name: 'Lake Naivasha', match: /naivasha/i, area: 'Naivasha', lat: -0.77, lon: 36.36, km: 90, hrs: '2' },
  { key: 'kereita', name: 'Kereita Forest', match: /kereita/i, lat: -0.98, lon: 36.62, km: 50, hrs: '1' },
  { key: 'sagana', name: 'Sagana', match: /sagana/i, lat: -0.67, lon: 37.21, km: 100, hrs: '2' },
  { key: 'mara', name: 'Maasai Mara', match: /mara/i, lat: -1.49, lon: 35.14, km: 270, hrs: '5.5' },
  { key: 'amboseli', name: 'Amboseli', match: /amboseli/i, lat: -2.65, lon: 37.26, km: 240, hrs: '4.5' },
  { key: 'diani', name: 'Diani Beach', match: /diani/i, lat: -4.28, lon: 39.59, km: 520, hrs: '9' },
  { key: 'mtkenya', name: 'Mt Kenya', match: /mt\.? kenya|mount kenya/i, lat: -0.15, lon: 37.31, km: 180, hrs: '3.5' },
  { key: 'nakuru', name: 'Lake Nakuru', match: /nakuru/i, lat: -0.36, lon: 36.09, km: 160, hrs: '3' },
  { key: 'samburu', name: 'Samburu', match: /samburu/i, lat: 0.6, lon: 37.53, km: 345, hrs: '6' },
  { key: 'tsavo', name: 'Tsavo', match: /tsavo/i, lat: -2.98, lon: 38.47, km: 330, hrs: '5' },
  { key: 'lamu', name: 'Lamu', match: /lamu/i, lat: -2.27, lon: 40.9, km: 690, hrs: '11' },
  { key: 'turkana', name: 'Lake Turkana', match: /turkana/i, lat: 3.1, lon: 36.1, km: 760, hrs: '2 days' }
];
// First match in list order wins, so specific spots sit above broad areas ("Mt Longonot …, Naivasha" → Longonot).
export const placeFor = t => PLACES.find(p => p.match.test(`${t.location} ${t.title}`)) || null;
export const driveText = p => p ? (/day/.test(p.hrs) ? `${p.hrs} from Nairobi` : `${p.hrs}h from Nairobi`) : '';
export const daysUntil = d => Math.ceil((new Date(d + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000);
export const ridePill = t => {
  const v = vehicle(t.transport);
  return v ? `<span class="ride" title="${esc(t.transport_note || v.name)}">${v.svg.replace('<svg', '<svg width="30" height="18"')}${esc(v.short)}</span>` : '';
};

// ------------------------------------------------------------ session
export const state = { me: undefined, interests: new Set() };
export async function loadMe() {
  if (state.me !== undefined) return state.me;
  state.me = await api('/api/me').catch(() => null);
  if (state.me) {
    const saved = await api('/api/interests/mine').catch(() => []);
    state.interests = new Set(saved.map(t => t.id));
  }
  return state.me;
}

// ------------------------------------------------------------ layout
const logo = `<span class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"><path d="m3 19 6-10 4 6 2-3 6 7z"/><circle cx="17" cy="6" r="2" fill="#fff"/></svg></span><span>Game<em>Ventures</em></span>`;

export async function mountLayout() {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `<nav class="nav wrap" aria-label="Main">
      <a class="logo" href="/">${logo}</a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <div class="nav-links" id="nav-links">
        <a href="/#trips">Trips</a><a href="/#explore">Explore map</a><a href="/#convoy">Convoys</a><a href="/#fleet">Our rides</a><a href="/#how">How it works</a>
        <span id="nav-auth"></span>
      </div></nav>`;
  document.body.prepend(header);
  const toggle = $('.nav-toggle', header);
  toggle.addEventListener('click', () => {
    const open = $('#nav-links').classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  if (document.body.classList.contains('has-hero')) {
    const onScroll = () => header.classList.toggle('solid', scrollY > 40);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="wrap"><div class="footer-grid">
      <div><a class="logo" href="/">${logo}</a><p>Hikes, safaris, river runs, road trips and games across Kenya. Pick your adventure, grab a slot, we handle the rest.</p></div>
      <div><h4>Adventures</h4><ul>${Object.entries(CATEGORIES).map(([k, c]) => `<li><a href="/?category=${k}#trips">${c.label}</a></li>`).join('')}</ul></div>
      <div><h4>Account</h4><ul><li><a href="/account">My trips</a></li><li><a href="/account#interested">Saved trips</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+254700000000">+254 700 000 000</a></li><li><a href="mailto:hello@gameventures.co.ke">hello@gameventures.co.ke</a></li><li>Nairobi, Kenya</li></ul></div>
    </div><div class="copyright"><span>© ${new Date().getFullYear()} GameVentures. Adventure responsibly.</span><span>Secure payments by Paystack · M-Pesa & cards</span></div></div>`;
  document.body.append(footer);

  await loadMe();
  renderNavAuth();
  setupReveal();
  document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.style.visibility = 'hidden'; }, true);
}

export function renderNavAuth() {
  const slot = $('#nav-auth');
  if (!slot) return;
  const me = state.me;
  slot.style.display = 'contents';
  slot.innerHTML = me
    ? `${me.is_admin ? '<a href="/admin">Admin</a>' : ''}<a class="btn btn-sm" href="/account">Hi, ${esc(me.name.split(' ')[0])}</a>`
    : `<a href="#" data-auth="login">Log in</a><a class="btn btn-sm" href="#" data-auth="register">Sign up free</a>`;
  $$('[data-auth]', slot).forEach(a => a.addEventListener('click', e => { e.preventDefault(); openAuth(a.dataset.auth); }));
}

// ------------------------------------------------------------ auth dialog
let authDialog, authDone;
function buildAuthDialog() {
  authDialog = document.createElement('dialog');
  authDialog.setAttribute('closedby', 'any');
  authDialog.setAttribute('aria-labelledby', 'auth-title');
  authDialog.innerHTML = `<div class="dialog-inner">
    <div class="dialog-head"><div><h2 id="auth-title">Join the adventure</h2><p id="auth-sub">Free account. Save trips you love, book slots, pay when ready.</p></div>
      <button class="close-x" type="button" aria-label="Close">×</button></div>
    <div class="tabs" role="tablist">
      <button role="tab" type="button" data-tab="register" aria-selected="true">Create account</button>
      <button role="tab" type="button" data-tab="login" aria-selected="false">Log in</button></div>
    <form class="form" id="register-form">
      <div class="field"><label for="r-name">Full name</label><input id="r-name" name="name" autocomplete="name" required enterkeyhint="next"></div>
      <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" autocomplete="username" spellcheck="false" required enterkeyhint="next"></div>
      <div class="field"><label for="r-phone">Phone (M-Pesa)</label><input id="r-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="0712 345 678" enterkeyhint="next">
        <span class="hint">So our team can reach you with trip updates.</span></div>
      <div class="field"><label for="new-password">Password</label><div class="pw-wrap"><input id="new-password" name="new-password" type="password" autocomplete="new-password" minlength="8" required enterkeyhint="done"><button type="button" class="pw-toggle">Show</button></div><span class="hint">At least 8 characters.</span></div>
      <p class="form-error" aria-live="polite"></p>
      <button class="btn btn-block" type="submit">Create account</button>
    </form>
    <form class="form" id="login-form" hidden>
      <div class="field"><label for="l-email">Email</label><input id="l-email" name="email" type="email" autocomplete="username" spellcheck="false" required enterkeyhint="next"></div>
      <div class="field"><label for="current-password">Password</label><div class="pw-wrap"><input id="current-password" name="current-password" type="password" autocomplete="current-password" required enterkeyhint="done"><button type="button" class="pw-toggle">Show</button></div></div>
      <p class="form-error" aria-live="polite"></p>
      <button class="btn btn-block" type="submit">Log in</button>
    </form></div>`;
  document.body.append(authDialog);
  lightDismissFallback(authDialog);
  $('.close-x', authDialog).addEventListener('click', () => authDialog.close());
  $$('[data-tab]', authDialog).forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('.pw-toggle', authDialog).forEach(b => b.addEventListener('click', () => {
    const input = b.previousElementSibling; const show = input.type === 'password';
    input.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show';
  }));
  const submit = (form, url, payload) => form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('.form-error', form); const btn = $('button[type=submit]', form);
    err.textContent = ''; btn.disabled = true;
    try {
      await api(url, { body: payload(new FormData(form)) });
      state.me = undefined; await loadMe(); renderNavAuth();
      authDialog.close(); toast(`Welcome, ${state.me.name.split(' ')[0]}! 🎒`, 'ok');
      const cb = authDone; authDone = null; cb?.(state.me);
    } catch (ex) { err.textContent = ex.message; }
    finally { btn.disabled = false; }
  });
  submit($('#register-form', authDialog), '/api/auth/register', f => ({ name: f.get('name'), email: f.get('email'), phone: f.get('phone'), password: f.get('new-password') }));
  submit($('#login-form', authDialog), '/api/auth/login', f => ({ email: f.get('email'), password: f.get('current-password') }));
}
function switchTab(tab) {
  $$('[data-tab]', authDialog).forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $('#register-form', authDialog).hidden = tab !== 'register';
  $('#login-form', authDialog).hidden = tab !== 'login';
}
export function openAuth(tab = 'register', { title, sub, onDone } = {}) {
  if (!authDialog) buildAuthDialog();
  $('#auth-title', authDialog).textContent = title || (tab === 'login' ? 'Welcome back' : 'Join the adventure');
  $('#auth-sub', authDialog).textContent = sub || 'Free account. Save trips you love, book slots, pay when ready.';
  authDone = onDone || null;
  switchTab(tab);
  authDialog.showModal();
}
export async function requireLogin(opts) {
  if (await loadMe()) return state.me;
  return new Promise(resolve => openAuth('register', { ...opts, onDone: resolve }));
}

export function lightDismissFallback(dialog) {
  if ('closedBy' in HTMLDialogElement.prototype) return;
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
    if (!inside) dialog.close();
  });
}

// ------------------------------------------------------------ interest ("I'm interested") toggle
export async function toggleInterest(tourId, btn) {
  const me = await requireLogin({
    title: 'Save this trip',
    sub: 'Not ready to pay yet? No problem. Create a free account and we\'ll keep it on your list - plus our team will reach out with updates.'
  });
  if (!me) return;
  const id = Number(tourId);
  const on = !state.interests.has(id);
  try {
    const r = on ? await api('/api/interests', { body: { tour_id: id } }) : await api(`/api/interests/${id}`, { method: 'DELETE' });
    on ? state.interests.add(id) : state.interests.delete(id);
    $$(`[data-interest="${id}"]`).forEach(b => { b.setAttribute('aria-pressed', on); $('.lbl', b).textContent = on ? 'Interested' : "I'm interested"; });
    $$(`[data-interest-count="${id}"]`).forEach(el => el.textContent = interestedText(r.count));
    toast(on ? 'Saved! Find it under Account → Interested. Pay whenever you\'re ready.' : 'Removed from your interested list.', on ? 'ok' : '');
  } catch (e) { toast(e.message, 'err'); }
}
export const interestedText = n => n ? `🔥 ${n} interested` : '✨ Be the first';
export const heartBtn = t => {
  const on = state.interests.has(t.id);
  return `<button type="button" class="heart-btn" data-interest="${t.id}" aria-pressed="${on}">${icon.heart}<span class="lbl">${on ? 'Interested' : "I'm interested"}</span></button>`;
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-interest]');
  if (b) { e.preventDefault(); toggleInterest(b.dataset.interest, b); }
});

// ------------------------------------------------------------ cards
export function cardHTML(t) {
  const d = new Date(t.start_date + 'T00:00:00');
  const pct = Math.min(100, Math.round((t.slots_booked / t.slots_total) * 100));
  const cat = CATEGORIES[t.category] || { label: t.category, ico: '🧭' };
  const p = placeFor(t);
  const days = daysUntil(t.start_date);
  const soon = t.slots_left && days >= 0 && days <= 14
    ? `<span class="leaving">${days === 0 ? 'Leaves today' : days === 1 ? 'Leaves tomorrow' : `Leaves in ${days} days`}</span>` : '';
  const level = t.difficulty ? `<span class="level level-${esc(t.difficulty.toLowerCase())}" title="Difficulty">${esc(t.difficulty)}</span>` : '';
  return `<article class="card reveal">
    <div class="card-media">
      <img src="${esc(t.image)}" alt="" loading="lazy" decoding="async">
      <span class="badge">${cat.ico} ${esc(cat.label)}</span>
      <span class="date-tile"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString('en-KE', { month: 'short' })}</span></span>
      <span class="media-foot"><span class="interested" data-interest-count="${t.id}">${interestedText(t.interested_count)}</span>${soon}</span>
    </div>
    <div class="card-body">
      <h3><a href="/tour?id=${t.id}">${esc(t.title)}</a></h3>
      <div class="meta"><span>${icon.pin}${esc(t.location)}</span><span>${icon.clock}${esc(t.duration || '')}</span>${level}</div>
      <div class="card-tags">${ridePill(t)}${p ? `<span class="drive" title="${esc(driveText(p))}, approx. ${p.km} km by road">${icon.route}${esc(p.hrs)}${/day/.test(p.hrs) ? '' : 'h'} drive</span>` : ''}</div>
      <div class="meter" role="img" aria-label="${pct}% booked"><i style="width:${pct}%"></i></div>
      <div class="slots-text"><span>${t.slots_booked} booked</span>${t.slots_left ? `<b class="${t.slots_left <= 8 ? 'low' : ''}">${t.slots_left} slots left</b>` : '<b class="low">Sold out</b>'}</div>
      <div class="card-foot"><span class="price">${money(t.price)}<span class="per">per person</span></span>${heartBtn(t)}${t.slots_left ? `<a class="btn" href="/tour?id=${t.id}#book">Book</a>` : ''}</div>
    </div></article>`;
}

// ------------------------------------------------------------ scroll reveal
let io;
export function setupReveal(root = document) {
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches || !('IntersectionObserver' in window)) {
    $$('.reveal', root).forEach(el => el.classList.add('in')); return;
  }
  io ||= new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal:not(.in)', root).forEach(el => io.observe(el));
}

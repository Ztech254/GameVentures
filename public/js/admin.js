import { $, $$, api, esc, money, fmtDate, CATEGORIES, mountLayout, openAuth, state, toast } from './app.js';

await mountLayout();

if (!state.me?.is_admin) {
  $('#denied').hidden = false;
  $('#admin-login').addEventListener('click', () => openAuth('login', { title: 'Admin log in', onDone: () => location.reload() }));
} else {
  $('#tabs').hidden = false; $('#stats').hidden = false;
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab('trips');
  loadStats(); loadTrips(); loadBookings(); loadLeads();
}

function showTab(tab) {
  $$('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  ['trips', 'bookings', 'leads'].forEach(t => $(`#panel-${t}`).hidden = t !== tab);
}

async function loadStats() {
  const s = await api('/api/admin/stats');
  $('#stats').innerHTML = [['Revenue', money(s.revenue)], ['Paid slots', s.paid], ['Interested leads', s.leads], ['Travellers', s.users], ['Live trips', s.trips]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('#pay-mode').textContent = { demo: '⚠️ Payments in DEMO mode - add PAYSTACK_SECRET_KEY to .env to collect real money.', test: 'Paystack TEST mode (sk_test key).', live: '✅ Paystack LIVE - collecting real payments.' }[s.payments];
}

// ------------------------------------------------ trips
let trips = [];
async function loadTrips() {
  trips = await api('/api/admin/tours');
  $('#trip-list').innerHTML = trips.map(t => `<article class="row-card" style="grid-template-columns:90px 1fr auto;box-shadow:none;border:1px solid var(--sand-2)">
    <div class="thumb"><img src="${esc(t.image)}" alt="" loading="lazy"></div>
    <div><h3 style="font-size:1rem">${t.featured ? '⭐ ' : ''}${esc(t.title)}</h3>
      <p class="small" style="margin:0">${fmtDate(t.start_date)} · ${esc(CATEGORIES[t.category]?.label || t.category)} · ${money(t.price)}<br>
      ${t.slots_booked}/${t.slots_total} booked · 🔥 ${t.interested_count ?? ''}${t.published ? '' : ' · <b>Hidden</b>'}</p></div>
    <div class="actions" style="min-width:0"><button class="btn btn-sm" data-edit="${t.id}">Edit</button><button class="btn btn-ghost btn-sm" data-del="${t.id}">Delete</button></div>
  </article>`).join('') || '<p class="small">No trips yet.</p>';
}

const form = $('#trip-form');
let gallery = [];
function renderGallery() {
  $('#gallery-current').innerHTML = gallery.map((src, i) => `<span style="position:relative">
    <img src="${esc(src)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:10px">
    <button type="button" data-rm-photo="${i}" aria-label="Remove photo" style="position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;border:0;background:var(--danger);color:#fff;cursor:pointer">×</button></span>`).join('');
}
$('#gallery-current').addEventListener('click', e => {
  const b = e.target.closest('[data-rm-photo]');
  if (b) { gallery.splice(Number(b.dataset.rmPhoto), 1); renderGallery(); }
});
function fillForm(t) {
  form.reset();
  const set = (n, v) => { if (form.elements[n]) form.elements[n].value = v ?? ''; };
  ['id', 'title', 'category', 'location', 'start_date', 'duration', 'price', 'slots_total', 'transport', 'transport_note', 'difficulty', 'meeting_point', 'tagline', 'description', 'image']
    .forEach(n => set(n, t[n]));
  set('activities', t.activities.join('\n')); set('includes', t.includes.join('\n'));
  form.elements.featured.checked = t.featured; form.elements.published.checked = t.published;
  gallery = [...(t.gallery || [])]; renderGallery();
  $('#form-title').textContent = 'Edit trip'; $('#save-btn').textContent = 'Save changes'; $('#reset-btn').hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
}
function resetForm() {
  form.reset(); form.elements.id.value = '';
  gallery = []; renderGallery();
  $('#form-title').textContent = 'Post a new trip'; $('#save-btn').textContent = 'Publish trip'; $('#reset-btn').hidden = true;
}
$('#reset-btn').addEventListener('click', resetForm);

const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('.form-error', form); err.textContent = '';
  const f = new FormData(form);
  const body = Object.fromEntries(f);
  body.featured = form.elements.featured.checked;
  body.published = form.elements.published.checked;
  const file = $('#f-upload').files[0];
  if (file) {
    if (file.size > 5.5e6) { err.textContent = 'Image is too large (max ~5 MB).'; return; }
    body.image_upload = await readFile(file);
  }
  const extra = [...$('#f-gallery').files];
  if (extra.some(f => f.size > 5.5e6)) { err.textContent = 'One of the gallery photos is too large (max ~5 MB each).'; return; }
  if (extra.length > 10) { err.textContent = 'Upload up to 10 photos at a time.'; return; }
  body.gallery = gallery;
  body.gallery_uploads = await Promise.all(extra.map(readFile));
  const btn = $('#save-btn'); btn.disabled = true;
  try {
    if (body.id) await api(`/api/admin/tours/${body.id}`, { method: 'PUT', body });
    else await api('/api/admin/tours', { body });
    toast(body.id ? 'Trip updated' : 'Trip published! 🚀', 'ok');
    resetForm(); loadTrips(); loadStats();
  } catch (ex) { err.textContent = ex.message; }
  finally { btn.disabled = false; }
});

$('#trip-list').addEventListener('click', async e => {
  const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if (edit) fillForm(trips.find(t => t.id == edit.dataset.edit));
  if (del && confirm('Delete this trip? This cannot be undone.')) {
    try { await api(`/api/admin/tours/${del.dataset.del}`, { method: 'DELETE' }); toast('Trip deleted'); loadTrips(); }
    catch (ex) { toast(ex.message, 'err'); }
  }
});

// ------------------------------------------------ bookings
async function loadBookings() {
  const rows = await api('/api/admin/bookings');
  $('#booking-rows').innerHTML = rows.map(b => `<tr>
    <td><b>${esc(b.ref)}</b>${b.receipt ? `<br><span class="small">${esc(b.receipt)}</span>` : ''}</td>
    <td>${esc(b.user_name)}<br><span class="small">${esc(b.user_email)}${b.user_phone ? ' · ' + esc(b.user_phone) : ''}</span></td>
    <td>${esc(b.title)}<br><span class="small">${fmtDate(b.start_date)}</span></td>
    <td>${b.seats}</td><td>${money(b.amount)}</td>
    <td><span class="status ${b.status}">${esc(b.status.replace('_', ' '))}</span></td>
    <td class="small">${esc(b.created_at)}</td></tr>`).join('') || '<tr><td colspan="7" class="small">No bookings yet.</td></tr>';
}

// ------------------------------------------------ leads (interested, not paid)
let leads = [];
async function loadLeads() {
  leads = await api('/api/admin/interests');
  $('#c-leads').textContent = leads.length;
  $('#lead-rows').innerHTML = leads.map(l => {
    const msg = encodeURIComponent(`Hi ${l.user_name.split(' ')[0]}! This is GameVentures 👋 You saved "${l.title}" on ${fmtDate(l.start_date)}. Slots are filling up - want us to hold one for you? Book here: ${location.origin}/tour?id=${l.tour_id}`);
    return `<tr>
      <td><b>${esc(l.user_name)}</b></td>
      <td class="small">${esc(l.user_email)}${l.user_phone ? `<br>${esc(l.user_phone)}` : ''}</td>
      <td>${esc(l.title)}<br><span class="small">${fmtDate(l.start_date)} · ${money(l.price)}</span></td>
      <td class="small">${esc(l.created_at)}</td>
      <td>${l.booking_status ? `<span class="status ${l.booking_status}">${esc(l.booking_status)}</span>` : '<span class="status interested">not booked</span>'}</td>
      <td style="white-space:nowrap">${l.user_phone ? `<a class="btn btn-sm" style="--bg:#25d366" target="_blank" rel="noopener" href="https://wa.me/${esc(l.user_phone)}?text=${msg}">WhatsApp</a> ` : ''}<a class="btn btn-ghost btn-sm" href="mailto:${esc(l.user_email)}?subject=${encodeURIComponent('Your GameVentures trip: ' + l.title)}&body=${msg}">Email</a></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="small">No interested travellers yet.</td></tr>';
}
$('#export').addEventListener('click', () => {
  const cols = ['user_name', 'user_email', 'user_phone', 'title', 'start_date', 'price', 'created_at', 'booking_status'];
  const csv = [cols.join(','), ...leads.map(l => cols.map(c => `"${String(l[c] ?? '').replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'gameventures-leads.csv' });
  a.click(); URL.revokeObjectURL(a.href);
});

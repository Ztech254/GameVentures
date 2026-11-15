import { $, $$, api, esc, money, fmtDate, icon, CATEGORIES, vehicle, heartBtn, interestedText, mountLayout, requireLogin, toast, lightDismissFallback } from './app.js';

await mountLayout();
const id = new URLSearchParams(location.search).get('id');
const root = $('#tour');

let t;
try { t = await api(`/api/tours/${encodeURIComponent(id)}`); }
catch {
  root.innerHTML = `<div class="page-top wrap" style="padding-bottom:96px"><h1>Trip not found 🧭</h1><p>It may have ended or been removed.</p><a class="btn" href="/#trips">See all trips</a></div>`;
  throw new Error('not found');
}

document.title = `${t.title} · GameVentures`;
const cat = CATEGORIES[t.category] || { label: t.category, ico: '🧭' };
const v = vehicle(t.transport);
const soldOut = t.slots_left <= 0;
const past = t.start_date < new Date().toISOString().slice(0, 10);
const pct = Math.min(100, Math.round(t.slots_booked / t.slots_total * 100));
const photos = [...new Set([t.image, ...(t.gallery || [])].filter(Boolean))];
const SHOWN = 5;
const galleryHTML = photos.length ? `<h2>Photos of ${esc(t.location.split(',')[0])}</h2>
  <div class="gallery">${photos.slice(0, SHOWN).map((src, i) => `<button type="button" data-photo="${i}" aria-label="Open photo ${i + 1} of ${photos.length}">
    <img src="${esc(src)}" alt="" loading="${i ? 'lazy' : 'eager'}">${i === SHOWN - 1 && photos.length > SHOWN ? `<span class="more">+${photos.length - SHOWN} more</span>` : ''}</button>`).join('')}</div>` : '';

root.innerHTML = `
<section class="tour-hero" style="padding:0">
  <img src="${esc(t.image)}" alt="" fetchpriority="high">
  <div class="wrap">
    <span class="badge">${cat.ico} ${esc(cat.label)}</span> ${t.featured ? '<span class="badge badge-hot">🔥 Featured</span>' : ''}
    <h1>${esc(t.title)}</h1>
    <div class="meta"><span>${icon.pin}${esc(t.location)}</span><span>${icon.cal}${fmtDate(t.start_date)}</span><span>${icon.clock}${esc(t.duration || '')}</span>${t.difficulty ? `<span>${icon.bolt}${esc(t.difficulty)}</span>` : ''}</div>
  </div>
</section>
<div class="wrap tour-layout">
  <div>
    <dl class="facts">
      <div><dt>Date</dt><dd>${fmtDate(t.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
      <div><dt>Duration</dt><dd>${esc(t.duration || '-')}</dd></div>
      <div><dt>Difficulty</dt><dd>${esc(t.difficulty || '-')}</dd></div>
      <div><dt>Your ride</dt><dd>${esc(v?.short || 'Included')}</dd></div>
    </dl>
    ${galleryHTML}
    <h2>The adventure</h2>
    <p style="font-size:1.08rem">${esc(t.tagline || '')}</p>
    <p>${esc(t.description || '')}</p>

    <h2>What you'll do</h2>
    <ol class="timeline">${t.activities.map(a => `<li>${esc(a)}</li>`).join('')}</ol>

    ${v ? `<h2>Your ride</h2>
    <div class="ride-box">${v.svg}<div><h3>${esc(v.name)}</h3><p>${esc(t.transport_note || v.blurb)}</p>
      <ul>${v.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div></div>` : ''}

    <h2>What's included</h2>
    <ul class="includes">${t.includes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>

    ${t.meeting_point ? `<h2>Meeting point</h2><p class="meta" style="font-size:1rem;color:var(--ink)"><span>${icon.pin}${esc(t.meeting_point)}</span></p>` : ''}
  </div>

  <aside class="book-box" id="book" aria-labelledby="book-title">
    <div><span class="small" id="book-title">Price per person</span><div class="price">${money(t.price)}</div></div>
    <div class="slots-meter">
      <div class="slots-text"><span data-interest-count="${t.id}">${interestedText(t.interested_count)}</span><b class="${t.slots_left <= 8 ? 'low' : ''}">${soldOut ? 'Sold out' : `${t.slots_left} slots left`}</b></div>
      <div class="meter" style="background:var(--sand-2)"><i style="width:${pct}%"></i></div>
    </div>
    <div>
      <span class="small" id="seats-label">How many slots?</span>
      <div class="stepper" role="group" aria-labelledby="seats-label">
        <button type="button" data-step="-1" aria-label="One less">−</button><output id="seats" aria-live="polite">1</output><button type="button" data-step="1" aria-label="One more">+</button>
      </div>
    </div>
    <div class="total-row"><span>Total</span><span id="total">${money(t.price)}</span></div>
    <button class="btn btn-block" id="book-btn" ${soldOut || past ? 'disabled' : ''}>${past ? 'Trip has ended' : soldOut ? 'Sold out' : 'Book & pay now'}</button>
    <div class="or-divider">not ready to pay?</div>
    ${heartBtn(t).replace('class="heart-btn"', 'class="heart-btn" style="justify-content:center;padding:.85em"')}
    <p class="secure-note">🔒 Secure checkout by Paystack · M-Pesa, Visa & Mastercard<br>Your slot is confirmed the moment payment goes through.</p>
  </aside>
</div>`;

root.insertAdjacentHTML('beforeend', soldOut || past ? '' : `<div class="book-bar"><span class="price">${money(t.price)}<span class="per">per person · ${t.slots_left} left</span></span><a class="btn" href="#book">Book my slot</a></div>`);

let seats = 1;
const maxSeats = Math.max(1, Math.min(20, t.slots_left));
root.addEventListener('click', e => {
  const b = e.target.closest('[data-step]');
  if (!b) return;
  seats = Math.min(maxSeats, Math.max(1, seats + Number(b.dataset.step)));
  $('#seats').textContent = seats;
  $('#total').textContent = money(seats * t.price);
});

$('#book-btn').addEventListener('click', async () => {
  const me = await requireLogin({ title: 'Almost there!', sub: 'Create a free account to lock in your slot. Takes 20 seconds.' });
  if (!me) return;
  const btn = $('#book-btn');
  btn.disabled = true; btn.textContent = 'Reserving your slot…';
  try {
    const booking = await api('/api/bookings', { body: { tour_id: t.id, seats } });
    btn.textContent = 'Opening secure checkout…';
    try {
      const pay = await api(`/api/bookings/${booking.id}/pay`, { body: {} });
      if (pay.authorization_url) { location.href = pay.authorization_url; return; }
      location.href = `/account?paid=${booking.id}`;
    } catch (e) {
      toast(`${e.message} Your booking is saved - you can pay from your account.`, 'err');
      setTimeout(() => location.href = '/account', 1800);
    }
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false; btn.textContent = 'Book & pay now';
  }
});

// ------------------------------------------------ lightbox
const lb = document.createElement('dialog');
lb.className = 'lightbox'; lb.setAttribute('closedby', 'any'); lb.setAttribute('aria-label', 'Photo viewer');
lb.innerHTML = `<button class="close-x" type="button" aria-label="Close">×</button><figure><img alt="">
  <button class="nav-btn prev" type="button" aria-label="Previous photo">‹</button><button class="nav-btn next" type="button" aria-label="Next photo">›</button>
  <figcaption><span>${esc(t.title)}</span><span id="lb-count"></span></figcaption></figure>`;
document.body.append(lb); lightDismissFallback(lb);
let cur = 0;
const show = i => { cur = (i + photos.length) % photos.length; $('img', lb).src = photos[cur]; $('#lb-count').textContent = `${cur + 1} / ${photos.length}`; };
$('.close-x', lb).addEventListener('click', () => lb.close());
$('.prev', lb).addEventListener('click', () => show(cur - 1));
$('.next', lb).addEventListener('click', () => show(cur + 1));
lb.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); });
if (photos.length < 2) $$('.nav-btn', lb).forEach(b => b.hidden = true);
root.addEventListener('click', e => { const b = e.target.closest('[data-photo]'); if (b) { show(Number(b.dataset.photo)); lb.showModal(); } });

if (location.hash === '#book') $('#book').scrollIntoView();

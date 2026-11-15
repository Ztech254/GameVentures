import { $, $$, api, esc, money, fmtDate, icon, ridePill, mountLayout, openAuth, state, toast } from './app.js';

await mountLayout();

const STATUS = {
  pending: 'Awaiting payment', awaiting: 'Payment in progress', paid: 'Confirmed',
  failed: 'Payment failed', cancelled: 'Cancelled', refund_due: 'Refund due'
};

if (!state.me) {
  $('#guest').hidden = false;
  $$('[data-open]').forEach(b => b.addEventListener('click', () => openAuth(b.dataset.open, { onDone: () => location.reload() })));
} else {
  init();
}

async function init() {
  $('#hello').textContent = `Karibu, ${state.me.name.split(' ')[0]} 👋`;
  $('#tabs').hidden = false; $('#logout-wrap').hidden = false;
  $('#logout').addEventListener('click', async () => { await api('/api/auth/logout', { body: {} }); location.href = '/'; });
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab(location.hash === '#interested' ? 'interested' : 'bookings');

  const paidId = new URLSearchParams(location.search).get('paid');
  await Promise.all([renderBookings(), renderInterested()]);
  if (paidId) watchPayment(paidId);
}

function showTab(tab) {
  $$('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $('#panel-bookings').hidden = tab !== 'bookings';
  $('#panel-interested').hidden = tab !== 'interested';
  history.replaceState(null, '', location.search + (tab === 'interested' ? '#interested' : ''));
}

const thumb = img => `<div class="thumb"><img src="${esc(img)}" alt="" loading="lazy"></div>`;

async function renderBookings() {
  const list = await api('/api/bookings/mine');
  const visible = list.filter(b => b.status !== 'cancelled');
  $('#c-bookings').textContent = visible.length;
  $('#panel-bookings').innerHTML = visible.length ? visible.map(b => {
    const canPay = ['pending', 'failed', 'awaiting'].includes(b.status);
    return `<article class="row-card" data-booking="${b.id}">
      ${thumb(b.image)}
      <div>
        <span class="status ${b.status}">${STATUS[b.status] || b.status}</span>
        <h3><a href="/tour?id=${b.tour_id}" style="text-decoration:none">${esc(b.title)}</a></h3>
        <div class="meta"><span>${icon.cal}${fmtDate(b.start_date)}</span><span>${icon.pin}${esc(b.location)}</span></div>
        <p class="small" style="margin:.4em 0 0">Ref <b>${esc(b.ref)}</b> · ${b.seats} slot${b.seats > 1 ? 's' : ''} · <b>${money(b.amount)}</b>${b.receipt ? ` · Receipt ${esc(b.receipt)}` : ''}</p>
        ${b.pay_message && b.status !== 'paid' ? `<p class="small" style="margin:.2em 0 0">${esc(b.pay_message)}</p>` : ''}
      </div>
      <div class="actions">
        ${canPay ? `<button class="btn btn-sm" data-pay="${b.id}">Pay ${money(b.amount)}</button><button class="btn btn-ghost btn-sm" data-cancel="${b.id}">Cancel</button>` : ''}
        ${b.status === 'paid' ? `<span class="small" style="text-align:center">🎉 See you on the trail!</span>` : ''}
      </div></article>`;
  }).join('') : `<div class="empty"><h3>No bookings yet</h3><p>Your next story is one click away.</p><a class="btn" href="/#trips">Browse trips</a></div>`;
}

async function renderInterested() {
  const list = await api('/api/interests/mine');
  $('#c-interested').textContent = list.length;
  $('#panel-interested').innerHTML = list.length ? `
    <div class="panel" style="background:#fff4e3"><b>No pressure 🧡</b> These are trips you've saved. Our team may reach out with updates and reminders.
      Slots are only guaranteed once paid — so book early for popular trips.</div>` + list.map(t => `
    <article class="row-card">
      ${thumb(t.image)}
      <div>
        <span class="status interested">Interested</span>
        <h3><a href="/tour?id=${t.id}" style="text-decoration:none">${esc(t.title)}</a></h3>
        <div class="meta"><span>${icon.cal}${fmtDate(t.start_date)}</span><span>${icon.pin}${esc(t.location)}</span></div>
        <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap">${ridePill(t)}<span class="small">${t.slots_left ? `${t.slots_left} slots left` : 'Sold out'} · ${money(t.price)} / person</span></div>
      </div>
      <div class="actions">
        ${t.slots_left ? `<a class="btn btn-sm" href="/tour?id=${t.id}#book">Book & pay</a>` : ''}
        <button class="btn btn-ghost btn-sm" data-unsave="${t.id}">Remove</button>
      </div></article>`).join('')
    : `<div class="empty"><h3>Nothing saved yet</h3><p>Tap <b>“I'm interested”</b> on any trip to save it here and pay later.</p><a class="btn" href="/#trips">Find trips</a></div>`;
}

document.addEventListener('click', async e => {
  const pay = e.target.closest('[data-pay]'), cancel = e.target.closest('[data-cancel]'), unsave = e.target.closest('[data-unsave]');
  try {
    if (pay) {
      pay.disabled = true; pay.textContent = 'Opening checkout…';
      const r = await api(`/api/bookings/${pay.dataset.pay}/pay`, { body: {} });
      if (r.authorization_url) { location.href = r.authorization_url; return; }
      toast(r.message || 'Payment started', 'ok');
      watchPayment(pay.dataset.pay);
    } else if (cancel) {
      if (!confirm('Cancel this booking?')) return;
      await api(`/api/bookings/${cancel.dataset.cancel}/cancel`, { body: {} });
      toast('Booking cancelled'); renderBookings();
    } else if (unsave) {
      await api(`/api/interests/${unsave.dataset.unsave}`, { method: 'DELETE' });
      state.interests.delete(Number(unsave.dataset.unsave)); renderInterested();
    }
  } catch (ex) { toast(ex.message, 'err'); renderBookings(); }
});

// After returning from Paystack (or in demo mode), confirm and poll until the payment settles.
async function watchPayment(bookingId) {
  showTab('bookings');
  history.replaceState(null, '', location.pathname);
  for (let i = 0; i < 20; i++) {
    const { status } = await api(`/api/bookings/${bookingId}/verify`, { body: {} }).catch(() => ({}));
    if (status === 'paid') { toast('Payment received - your slot is locked in! 🎉', 'ok'); break; }
    if (status === 'failed') { toast('Payment was not completed. You can try again.', 'err'); break; }
    if (status === 'refund_due') { toast('The trip filled up before your payment landed - we will refund you.', 'err'); break; }
    await new Promise(r => setTimeout(r, 2500));
  }
  await Promise.all([renderBookings(), renderInterested()]);
}

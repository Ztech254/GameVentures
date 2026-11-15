import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedTours } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (fs.existsSync(path.join(__dirname, '.env'))) process.loadEnvFile(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------------------------------------------------------- database
const db = new DatabaseSync(path.join(DATA_DIR, 'gameventures.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    start_date TEXT NOT NULL,
    duration TEXT,
    price INTEGER NOT NULL,
    slots_total INTEGER NOT NULL,
    slots_booked INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    tagline TEXT,
    description TEXT,
    activities TEXT NOT NULL DEFAULT '[]',
    includes TEXT NOT NULL DEFAULT '[]',
    meeting_point TEXT,
    difficulty TEXT,
    transport TEXT,
    transport_note TEXT,
    gallery TEXT NOT NULL DEFAULT '[]',
    featured INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    seats INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    pay_phone TEXT,
    checkout_id TEXT,
    receipt TEXT,
    pay_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at TEXT
  );
  CREATE TABLE IF NOT EXISTS interests (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    seats INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, tour_id)
  );
`);

for (const [col, def] of [['transport', 'TEXT'], ['transport_note', 'TEXT'], ['gallery', "TEXT NOT NULL DEFAULT '[]'"]]) {
  if (!db.prepare('PRAGMA table_info(tours)').all().some(c => c.name === col)) db.exec(`ALTER TABLE tours ADD COLUMN ${col} ${def}`);
}

const TOUR_COLS = 'title, category, location, start_date, duration, price, slots_total, image, tagline, description, activities, includes, meeting_point, difficulty, transport, transport_note, gallery, featured, published';

if (db.prepare('SELECT COUNT(*) AS n FROM tours').get().n === 0) {
  const ins = db.prepare(`INSERT INTO tours (${TOUR_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const t of seedTours) {
    ins.run(t.title, t.category, t.location, t.start_date, t.duration, t.price, t.slots_total, t.image, t.tagline,
      t.description, JSON.stringify(t.activities), JSON.stringify(t.includes), t.meeting_point, t.difficulty, t.transport, t.transport_note, JSON.stringify(t.gallery || []), t.featured ? 1 : 0, 1);
  }
  db.prepare('UPDATE tours SET slots_booked = ? WHERE id = 1').run(23); // make the spotlight feel alive
}

// ---------------------------------------------------------------- auth helpers
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gameventures.co.ke').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
  db.prepare('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?,?,?,1)')
    .run('GameVentures Admin', adminEmail, hashPassword(adminPassword));
  console.log(`Created admin account: ${adminEmail} / ${adminPassword}  (change it via .env before going live)`);
}

const SESSION_DAYS = 30;
function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)')
    .run(token, userId, Date.now() + SESSION_DAYS * 864e5);
  res.cookie('gv_session', token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_DAYS * 864e5, secure: process.env.NODE_ENV === 'production' });
}
function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
function currentUser(req) {
  const token = parseCookies(req.headers.cookie).gv_session;
  if (!token) return null;
  return db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
                     WHERE s.token = ? AND s.expires_at > ?`).get(token, Date.now()) || null;
}
const requireUser = (req, res, next) => (req.user = currentUser(req)) ? next() : res.status(401).json({ error: 'Please log in first.' });
const requireAdmin = (req, res, next) => {
  req.user = currentUser(req);
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admins only.' });
  next();
};

// ---------------------------------------------------------------- formatting
function tourOut(t) {
  return { ...t, activities: JSON.parse(t.activities || '[]'), includes: JSON.parse(t.includes || '[]'), gallery: JSON.parse(t.gallery || '[]'),
    featured: !!t.featured, published: !!t.published, slots_left: Math.max(0, t.slots_total - t.slots_booked) };
}
function normalizePhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return '254' + d.slice(1);
  if (/^[17]\d{8}$/.test(d)) return '254' + d;
  return null;
}

// ---------------------------------------------------------------- Paystack
const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_ON = !!PAYSTACK_KEY;
const PAYSTACK_MODE = !PAYSTACK_ON ? 'demo' : PAYSTACK_KEY.startsWith('sk_live') ? 'live' : 'test';
const CURRENCY = process.env.PAYSTACK_CURRENCY || 'KES';

async function paystack(method, endpoint, body) {
  const r = await fetch(`https://api.paystack.co${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${PAYSTACK_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.status) throw new Error(data.message || `Paystack error ${r.status}`);
  return data.data;
}

// Checks a Paystack transaction and, if it succeeded for the right amount, confirms the booking.
async function settleFromPaystack(reference, bookingIdHint) {
  const b = db.prepare('SELECT * FROM bookings WHERE checkout_id = ?').get(reference)
    || (bookingIdHint && db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingIdHint));
  if (!b || b.status === 'paid' || b.status === 'refund_due') return b;
  const tx = await paystack('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
  if (Number(tx.metadata?.booking_id) !== b.id || !reference.startsWith(b.ref)) return b; // not this booking's transaction
  if (tx.status === 'success') {
    if (tx.amount !== b.amount * 100 || tx.currency !== CURRENCY) {
      db.prepare("UPDATE bookings SET status='failed', pay_message='Amount mismatch - contact support' WHERE id=?").run(b.id);
    } else {
      confirmPayment(b.id, tx.reference);
    }
  } else if (['failed', 'abandoned', 'reversed'].includes(tx.status)) {
    db.prepare("UPDATE bookings SET status='failed', pay_message=? WHERE id=?").run(tx.gateway_response || 'Payment was not completed', b.id);
  }
  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(b.id);
}

// Confirms a payment and claims the seats atomically. Returns false if the tour sold out meanwhile.
function confirmPayment(bookingId, receipt) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (!b || b.status === 'paid') { db.exec('COMMIT'); return true; }
    const claimed = db.prepare('UPDATE tours SET slots_booked = slots_booked + ? WHERE id = ? AND slots_total - slots_booked >= ?')
      .run(b.seats, b.tour_id, b.seats).changes;
    if (claimed) {
      db.prepare("UPDATE bookings SET status='paid', receipt=?, paid_at=datetime('now'), pay_message='Payment received' WHERE id=?").run(receipt, b.id);
      db.prepare('DELETE FROM interests WHERE user_id = ? AND tour_id = ?').run(b.user_id, b.tour_id); // converted lead
    } else {
      db.prepare("UPDATE bookings SET status='refund_due', receipt=?, pay_message='Paid but tour filled up - we will refund you' WHERE id=?").run(receipt, b.id);
    }
    db.exec('COMMIT');
    return !!claimed;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ---------------------------------------------------------------- app
const app = express();
app.disable('x-powered-by');

// Paystack webhook needs the raw body to verify its signature, so it is registered before express.json()
app.post('/api/paystack/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const sig = req.headers['x-paystack-signature'];
  const expected = crypto.createHmac('sha512', PAYSTACK_KEY).update(req.body).digest('hex');
  if (!PAYSTACK_ON || !sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).end();
  }
  res.sendStatus(200); // acknowledge fast, then process
  try {
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'charge.success' && event.data?.reference) await settleFromPaystack(event.data.reference, event.data.metadata?.booking_id);
  } catch (e) { console.error('Webhook processing failed:', e.message); }
});

app.use(express.json({ limit: '60mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Public tours
app.get('/api/tours', (req, res) => {
  const { category, q } = req.query;
  let sql = `SELECT t.*, (SELECT COUNT(*) FROM interests i WHERE i.tour_id = t.id) AS interested_count FROM tours t WHERE published = 1`;
  const args = [];
  if (category && category !== 'all') { sql += ' AND category = ?'; args.push(category); }
  if (q) { sql += ' AND (title LIKE ? OR location LIKE ? OR tagline LIKE ?)'; args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY featured DESC, start_date ASC';
  res.json(db.prepare(sql).all(...args).map(tourOut));
});
app.get('/api/tours/:id', (req, res) => {
  const t = db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM interests i WHERE i.tour_id = t.id) AS interested_count
                        FROM tours t WHERE id = ? AND published = 1`).get(req.params.id);
  t ? res.json(tourOut(t)) : res.status(404).json({ error: 'Trip not found' });
});

// Interest list: travellers who want a trip but are not ready to pay yet
app.get('/api/interests/mine', requireUser, (req, res) => {
  res.json(db.prepare(`SELECT i.seats, i.note, i.created_at AS saved_at, t.* FROM interests i JOIN tours t ON t.id = i.tour_id
                       WHERE i.user_id = ? ORDER BY t.start_date`).all(req.user.id).map(tourOut));
});
app.post('/api/interests', requireUser, (req, res) => {
  const t = db.prepare('SELECT id FROM tours WHERE id = ? AND published = 1').get(req.body?.tour_id);
  if (!t) return res.status(404).json({ error: 'Trip not found' });
  const seats = Math.min(20, Math.max(1, Math.floor(Number(req.body?.seats) || 1)));
  db.prepare(`INSERT INTO interests (user_id, tour_id, seats, note) VALUES (?,?,?,?)
              ON CONFLICT(user_id, tour_id) DO UPDATE SET seats = excluded.seats, note = COALESCE(excluded.note, note)`)
    .run(req.user.id, t.id, seats, req.body?.note ? String(req.body.note).slice(0, 500) : null);
  res.json({ ok: true, count: db.prepare('SELECT COUNT(*) n FROM interests WHERE tour_id = ?').get(t.id).n });
});
app.delete('/api/interests/:tourId', requireUser, (req, res) => {
  db.prepare('DELETE FROM interests WHERE user_id = ? AND tour_id = ?').run(req.user.id, req.params.tourId);
  res.json({ ok: true, count: db.prepare('SELECT COUNT(*) n FROM interests WHERE tour_id = ?').get(req.params.tourId).n });
});

// Auth
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const ph = phone ? normalizePhone(phone) : null;
  if (phone && !ph) return res.status(400).json({ error: 'Enter a valid Safaricom number, e.g. 0712 345 678.' });
  const em = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(em)) return res.status(409).json({ error: 'An account with that email already exists. Log in instead.' });
  const { lastInsertRowid } = db.prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?,?,?,?)')
    .run(name.trim(), em, ph, hashPassword(password));
  createSession(res, Number(lastInsertRowid));
  res.json({ ok: true });
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!u || !verifyPassword(String(password || ''), u.password_hash)) return res.status(401).json({ error: 'Wrong email or password.' });
  createSession(res, u.id);
  res.json({ ok: true });
});
app.post('/api/auth/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie).gv_session;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie('gv_session').json({ ok: true });
});
app.get('/api/me', (req, res) => {
  const u = currentUser(req);
  res.json(u ? { ...u, is_admin: !!u.is_admin } : null);
});

// Bookings
app.post('/api/bookings', requireUser, (req, res) => {
  const seats = Math.floor(Number(req.body?.seats));
  if (!(seats >= 1 && seats <= 20)) return res.status(400).json({ error: 'Choose between 1 and 20 slots.' });
  const t = db.prepare('SELECT * FROM tours WHERE id = ? AND published = 1').get(req.body?.tour_id);
  if (!t) return res.status(404).json({ error: 'Trip not found' });
  if (t.start_date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'This trip has already happened.' });
  if (t.slots_total - t.slots_booked < seats) return res.status(409).json({ error: `Only ${t.slots_total - t.slots_booked} slot(s) left.` });
  const ref = 'GV' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const { lastInsertRowid } = db.prepare('INSERT INTO bookings (ref, user_id, tour_id, seats, amount) VALUES (?,?,?,?,?)')
    .run(ref, req.user.id, t.id, seats, seats * t.price);
  res.json({ id: Number(lastInsertRowid), ref });
});
const BOOKING_SELECT = `SELECT b.*, t.title, t.location, t.start_date, t.image, t.category FROM bookings b JOIN tours t ON t.id = b.tour_id`;
app.get('/api/bookings/mine', requireUser, (req, res) => {
  res.json(db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY b.id DESC`).all(req.user.id));
});
app.get('/api/bookings/:id', requireUser, (req, res) => {
  const b = db.prepare(`${BOOKING_SELECT} WHERE b.id = ? AND b.user_id = ?`).get(req.params.id, req.user.id);
  b ? res.json(b) : res.status(404).json({ error: 'Booking not found' });
});
app.post('/api/bookings/:id/cancel', requireUser, (req, res) => {
  const r = db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND user_id=? AND status IN ('pending','failed','awaiting')").run(req.params.id, req.user.id);
  r.changes ? res.json({ ok: true }) : res.status(400).json({ error: 'Only unpaid bookings can be cancelled.' });
});
app.post('/api/bookings/:id/pay', requireUser, async (req, res) => {
  const b = db.prepare('SELECT b.*, t.slots_total, t.slots_booked FROM bookings b JOIN tours t ON t.id=b.tour_id WHERE b.id=? AND b.user_id=?')
    .get(req.params.id, req.user.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (!['pending', 'failed', 'awaiting'].includes(b.status)) return res.status(400).json({ error: 'This booking is not awaiting payment.' });
  if (b.slots_total - b.slots_booked < b.seats) return res.status(409).json({ error: 'Sorry, this trip just filled up.' });

  // Each attempt gets a unique Paystack reference
  const reference = `${b.ref}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  if (!PAYSTACK_ON) {
    db.prepare("UPDATE bookings SET status='awaiting', checkout_id=?, pay_message='Demo mode: confirming payment...' WHERE id=?").run(reference, b.id);
    setTimeout(() => confirmPayment(b.id, 'DEMO-' + reference), 3000);
    return res.json({ ok: true, demo: true, message: 'Demo mode: payment will auto-confirm in a few seconds.' });
  }
  try {
    const origin = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const tx = await paystack('POST', '/transaction/initialize', {
      email: req.user.email,
      amount: b.amount * 100, // Paystack expects the lowest currency unit (cents)
      currency: CURRENCY,
      reference,
      callback_url: `${origin}/account?paid=${b.id}`,
      metadata: { booking_id: b.id, booking_ref: b.ref, seats: b.seats, customer: req.user.name }
    });
    db.prepare("UPDATE bookings SET status='awaiting', checkout_id=?, pay_message='Waiting for Paystack payment' WHERE id=?").run(reference, b.id);
    res.json({ ok: true, authorization_url: tx.authorization_url });
  } catch (e) {
    console.error('Paystack initialize failed:', e.message);
    res.status(502).json({ error: 'Could not start payment right now. Please try again.' });
  }
});

// Called when the customer returns from Paystack checkout (backup to the webhook)
app.post('/api/bookings/:id/verify', requireUser, async (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (!PAYSTACK_ON || !b.checkout_id || b.status !== 'awaiting') return res.json({ status: b.status });
  try { res.json({ status: (await settleFromPaystack(b.checkout_id)).status }); }
  catch (e) { console.error('Verify failed:', e.message); res.json({ status: b.status }); }
});

// Admin
function saveImage(dataUrl) {
  const m = /^data:image\/(png|jpe?g|webp|avif);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${m[1].replace('jpeg', 'jpg')}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64'));
  return `/uploads/${name}`;
}
function tourValues(body) {
  const list = v => JSON.stringify((Array.isArray(v) ? v : String(v || '').split('\n')).map(s => String(s).trim()).filter(Boolean));
  const image = body.image_upload ? saveImage(body.image_upload) : body.image;
  const gallery = [
    ...(Array.isArray(body.gallery) ? body.gallery : []).map(String).filter(u => /^(https?:\/\/|\/uploads\/)/.test(u)),
    ...(Array.isArray(body.gallery_uploads) ? body.gallery_uploads : []).slice(0, 20).map(saveImage).filter(Boolean)
  ].slice(0, 30);
  return [body.title, body.category, body.location, body.start_date, body.duration, Math.round(Number(body.price)),
    Math.round(Number(body.slots_total)), image, body.tagline, body.description, list(body.activities), list(body.includes),
    body.meeting_point, body.difficulty, body.transport, body.transport_note, JSON.stringify(gallery), body.featured ? 1 : 0, body.published === false ? 0 : 1]
    .map(v => v === undefined || v === '' ? null : v);
}
function validTour(b) {
  return b?.title && b.category && b.location && /^\d{4}-\d{2}-\d{2}$/.test(b.start_date || '') && Number(b.price) >= 0 && Number(b.slots_total) >= 1;
}
app.get('/api/admin/tours', requireAdmin, (req, res) => res.json(db.prepare('SELECT t.*, (SELECT COUNT(*) FROM interests i WHERE i.tour_id = t.id) AS interested_count FROM tours t ORDER BY start_date').all().map(tourOut)));
app.post('/api/admin/tours', requireAdmin, (req, res) => {
  if (!validTour(req.body)) return res.status(400).json({ error: 'Title, category, location, date, price and slots are required.' });
  if (req.body.featured) db.exec('UPDATE tours SET featured = 0');
  const { lastInsertRowid } = db.prepare(`INSERT INTO tours (${TOUR_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...tourValues(req.body));
  res.json({ id: Number(lastInsertRowid) });
});
app.put('/api/admin/tours/:id', requireAdmin, (req, res) => {
  if (!validTour(req.body)) return res.status(400).json({ error: 'Title, category, location, date, price and slots are required.' });
  if (req.body.featured) db.exec('UPDATE tours SET featured = 0');
  const sets = TOUR_COLS.split(', ').map(c => `${c} = ?`).join(', ');
  db.prepare(`UPDATE tours SET ${sets} WHERE id = ?`).run(...tourValues(req.body), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/tours/:id', requireAdmin, (req, res) => {
  const paid = db.prepare("SELECT COUNT(*) n FROM bookings WHERE tour_id=? AND status='paid'").get(req.params.id).n;
  if (paid) return res.status(400).json({ error: `This trip has ${paid} paid booking(s). Unpublish it instead of deleting.` });
  db.prepare('DELETE FROM tours WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT b.*, t.title, t.start_date, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
    FROM bookings b JOIN tours t ON t.id=b.tour_id JOIN users u ON u.id=b.user_id ORDER BY b.id DESC LIMIT 500`).all());
});
app.get('/api/admin/interests', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT i.seats, i.note, i.created_at, t.id AS tour_id, t.title, t.start_date, t.price,
      u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
      (SELECT status FROM bookings b WHERE b.user_id = i.user_id AND b.tour_id = i.tour_id ORDER BY b.id DESC LIMIT 1) AS booking_status
    FROM interests i JOIN tours t ON t.id = i.tour_id JOIN users u ON u.id = i.user_id ORDER BY t.start_date, i.created_at DESC`).all());
});
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json({
    leads: db.prepare('SELECT COUNT(*) v FROM interests').get().v,
    revenue: db.prepare("SELECT COALESCE(SUM(amount),0) v FROM bookings WHERE status='paid'").get().v,
    paid: db.prepare("SELECT COALESCE(SUM(seats),0) v FROM bookings WHERE status='paid'").get().v,
    users: db.prepare('SELECT COUNT(*) v FROM users WHERE is_admin = 0').get().v,
    trips: db.prepare('SELECT COUNT(*) v FROM tours WHERE published = 1').get().v,
    payments: PAYSTACK_MODE
  });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); });

app.listen(PORT, () => {
  console.log(`GameVentures running at http://localhost:${PORT}`);
  console.log(PAYSTACK_ON ? `Paystack: ${PAYSTACK_MODE} mode (${CURRENCY})` : 'Payments: DEMO mode (add PAYSTACK_SECRET_KEY in .env for real payments)');
});

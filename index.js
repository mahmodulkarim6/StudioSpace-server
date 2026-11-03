import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ObjectId } from 'mongodb';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { client, col } from './db.js';
import { auth } from './auth.js';

const { CLIENT_URL = 'http://localhost:3000', PORT = 5000 } = process.env;
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: CLIENT_URL.split(',').map((s) => s.trim()), credentials: true }));

app.all('/api/auth/*', toNodeHandler(auth));
app.use(express.json());

const oid = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ message: 'Server error. Please try again.' }); });

const requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return res.status(401).json({ message: 'Unauthorized: please log in first.' });
    const { id, email, name, image } = session.user;
    req.user = { id, email, name, image };
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized: please log in first.' });
  }
};

const pick = (b) => ({
  title: b.title, category: b.category, hourlyRate: +b.hourlyRate, securityDeposit: +b.securityDeposit || 0,
  capacity: +b.capacity, location: b.location, image: b.image,
  gallery: Array.isArray(b.gallery) ? b.gallery.filter(Boolean) : [],
  amenities: Array.isArray(b.amenities) ? b.amenities : [], description: b.description,
});
const valid = (s) => s.title && s.category && s.hourlyRate > 0 && s.capacity > 0 && s.location && s.image && s.description;

app.get('/api/studios', wrap(async (req, res) => {
  const { category, search, sort, limit } = req.query;
  const q = {};
  if (category && category !== 'All') q.category = category;
  if (search) q.$or = [{ title: { $regex: esc(search), $options: 'i' } }, { location: { $regex: esc(search), $options: 'i' } }];
  const s = sort === 'price-asc' ? { hourlyRate: 1 } : sort === 'price-desc' ? { hourlyRate: -1 } : sort === 'rating' ? { rating: -1 } : { createdAt: -1 };
  let c = col('studios').find(q, { projection: { ownerEmail: 0 } }).sort(s);
  if (limit) c = c.limit(Math.min(+limit || 6, 50));
  res.json(await c.toArray());
}));

app.get('/api/my-studios', requireAuth, wrap(async (req, res) => {
  res.json(await col('studios').find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
}));

app.get('/api/studios/:id', wrap(async (req, res) => {
  const id = oid(req.params.id);
  const s = id && (await col('studios').findOne({ _id: id }));
  if (!s) return res.status(404).json({ message: 'Studio not found.' });
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!session) delete s.ownerEmail;
  res.json(s);
}));

app.post('/api/studios', requireAuth, wrap(async (req, res) => {
  const s = pick(req.body);
  if (!valid(s)) return res.status(400).json({ message: 'Please fill in all required fields.' });
  const doc = { ...s, ownerEmail: req.user.email, ownerName: req.user.name, rating: 0, reviews: [], createdAt: new Date() };
  const r = await col('studios').insertOne(doc);
  res.status(201).json({ ...doc, _id: r.insertedId });
}));

const ownStudio = async (req, res) => {
  const id = oid(req.params.id);
  const s = id && (await col('studios').findOne({ _id: id }));
  if (!s) { res.status(404).json({ message: 'Studio not found.' }); return null; }
  if (s.ownerEmail !== req.user.email) { res.status(403).json({ message: 'You can only change your own listings.' }); return null; }
  return s;
};

app.put('/api/studios/:id', requireAuth, wrap(async (req, res) => {
  const s = await ownStudio(req, res); if (!s) return;
  const d = pick(req.body);
  if (!valid(d)) return res.status(400).json({ message: 'Please fill in all required fields.' });
  await col('studios').updateOne({ _id: s._id }, { $set: { ...d, updatedAt: new Date() } });
  res.json({ message: 'Updated' });
}));

app.delete('/api/studios/:id', requireAuth, wrap(async (req, res) => {
  const s = await ownStudio(req, res); if (!s) return;
  await col('studios').deleteOne({ _id: s._id });
  await col('bookings').updateMany({ studioId: s._id, status: { $in: ['Pending', 'Confirmed'] } }, { $set: { status: 'Cancelled' } });
  res.json({ message: 'Deleted' });
}));

const locks = new Map();
const withLock = (key, fn) => {
  const run = (locks.get(key) || Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return run;
};
const overlap = (studioId, start, end, excludeId) =>
  col('bookings').findOne({ studioId, status: 'Confirmed', startTs: { $lt: end }, endTs: { $gt: start }, ...(excludeId && { _id: { $ne: excludeId } }) });

app.post('/api/bookings', requireAuth, wrap(async (req, res) => {
  const { studioId, date, startTime, hours } = req.body;
  const studio = oid(studioId) && (await col('studios').findOne({ _id: oid(studioId) }));
  if (!studio) return res.status(404).json({ message: 'Studio not found.' });
  if (studio.ownerEmail === req.user.email) return res.status(400).json({ message: 'You cannot book your own studio.' });
  const h = parseInt(hours, 10);
  const start = new Date(`${date}T${startTime}:00Z`).getTime();
  if (!h || h < 1 || h > 12 || Number.isNaN(start)) return res.status(400).json({ message: 'Choose a valid date, start time and 1-12 hours.' });
  if (date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ message: 'You cannot book a date in the past.' });
  const end = start + h * 3600 * 1000;
  if (await overlap(studio._id, start, end))
    return res.status(409).json({ message: 'That time slot is already confirmed for another booking. Please pick a different time.' });
  const doc = {
    studioId: studio._id, studioTitle: studio.title, studioImage: studio.image, ownerEmail: studio.ownerEmail,
    userEmail: req.user.email, userName: req.user.name, date, startTime, hours: h, startTs: start, endTs: end,
    hourlyRate: studio.hourlyRate, securityDeposit: studio.securityDeposit, total: studio.hourlyRate * h + studio.securityDeposit,
    status: 'Pending', createdAt: new Date(),
  };
  const r = await col('bookings').insertOne(doc);
  res.status(201).json({ ...doc, _id: r.insertedId });
}));

app.get('/api/bookings/mine', requireAuth, wrap(async (req, res) => {
  res.json(await col('bookings').find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
}));
app.get('/api/bookings/requests', requireAuth, wrap(async (req, res) => {
  res.json(await col('bookings').find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
}));

app.patch('/api/bookings/:id/status', requireAuth, wrap(async (req, res) => {
  const id = oid(req.params.id);
  const b = id && (await col('bookings').findOne({ _id: id }));
  if (!b) return res.status(404).json({ message: 'Booking not found.' });
  const { status } = req.body;
  const isGuest = b.userEmail === req.user.email, isHost = b.ownerEmail === req.user.email;
  const ok =
    (isGuest && status === 'Cancelled' && b.status === 'Pending') ||
    (isHost && ((status === 'Confirmed' && b.status === 'Pending') || (status === 'Cancelled' && ['Pending', 'Confirmed'].includes(b.status)) || (status === 'Completed' && b.status === 'Confirmed')));
  if (!ok) return res.status(403).json({ message: 'That status change is not allowed.' });
  if (status === 'Confirmed') {
    const clash = await withLock(String(b.studioId), async () => {
      if (await overlap(b.studioId, b.startTs, b.endTs, b._id)) return true;
      await col('bookings').updateOne({ _id: id, status: 'Pending' }, { $set: { status } });
      return false;
    });
    if (clash) return res.status(409).json({ message: 'Another confirmed booking already uses this time slot.' });
    return res.json({ message: 'Status updated' });
  }
  await col('bookings').updateOne({ _id: id }, { $set: { status } });
  res.json({ message: 'Status updated' });
}));

app.get('/api/wishlist', requireAuth, wrap(async (req, res) => {
  const d = await col('wishlists').findOne({ email: req.user.email });
  res.json(d?.ids || []);
}));
app.post('/api/wishlist/:id', requireAuth, wrap(async (req, res) => {
  const { email } = req.user;
  const d = await col('wishlists').findOne({ email });
  const has = (d?.ids || []).includes(req.params.id);
  await col('wishlists').updateOne({ email }, has ? { $pull: { ids: req.params.id } } : { $addToSet: { ids: req.params.id } }, { upsert: true });
  res.json({ saved: !has });
}));

app.get('/api/stats', wrap(async (req, res) => {
  const rows = await col('studios').aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]).toArray();
  res.json({ total: rows.reduce((a, r) => a + r.n, 0), byCategory: Object.fromEntries(rows.map((r) => [r._id, r.n])) });
}));

app.get('/', (req, res) => res.json({ name: 'StudioSpace API', status: 'ok' }));

await client.connect();
await col('bookings').createIndex({ studioId: 1, status: 1, startTs: 1 });
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'StudioSpace API' }));
app.listen(PORT, () => console.log(`StudioSpace API running on :${PORT}`));
import 'dotenv/config';
import { client, db } from './db.js';
import { auth } from './auth.js';

await client.connect();
const img = (s) => `https://picsum.photos/seed/${s}/1000/700`;
const names = ['Rafi H.', 'Nusrat J.', 'Tanvir A.', 'Mim S.'];
const reviews = (r) => names.slice(0, 3).map((n, i) => ({ name: n, rating: Math.max(3, Math.round(r) - (i === 2 ? 1 : 0)), comment: ['Clean space, great lighting and a very helpful host.', 'Booked for a half-day shoot. Smooth check-in and fair pricing.', 'Good value. Would book again for our next session.'][i] }));
const S = (title, category, rate, dep, cap, location, seed, amenities, rating, description) => ({
  title, category, hourlyRate: rate, securityDeposit: dep, capacity: cap, location, image: img(seed),
  gallery: [img(seed + '-2'), img(seed + '-3')], amenities, rating, description, reviews: reviews(rating),
  ownerEmail: 'host@studiospace.com', ownerName: 'Studio Host', createdAt: new Date(),
});
const studios = [
  S('Whiteout Cyc Wall Studio', 'Photo Studio', 45, 100, 12, 'Gulshan, Dhaka', 'cyc', ['Backdrop Rolls', 'Lighting Kit', 'Wi-Fi', 'Air Conditioning'], 4.9, 'A 20-foot seamless white cyc wall with strobe lighting kit, changing room and a client lounge. Ideal for fashion, product and portrait shoots.'),
  S('Northlight Loft', 'Photo Studio', 38, 80, 10, 'Dhanmondi, Dhaka', 'loft', ['Wi-Fi', 'Makeup Room', 'Coffee Bar'], 4.7, 'A bright corner loft with large north-facing windows. Soft natural light all day, perfect for lifestyle and editorial work.'),
  S('Soundstage One', 'Film Stage', 120, 300, 40, 'Uttara, Dhaka', 'stage', ['Green Screen', 'Lighting Kit', 'Soundproofing', 'Parking', 'Air Conditioning'], 4.8, 'A 1,800 sq ft soundstage with a green screen, grid lighting, power distribution and loading dock access for commercial and short film production.'),
  S('Greenroom Podcast Lounge', 'Podcast Lounge', 25, 40, 6, 'Banani, Dhaka', 'pod', ['Mic & Interface', 'Soundproofing', 'Wi-Fi', 'Coffee Bar'], 4.6, 'Four broadcast mics, a mixing desk and acoustic treatment in a cosy lounge. Record video podcasts with a three-camera setup on request.'),
  S('Tape Room Recording Suite', 'Music Suite', 60, 120, 8, 'Mohakhali, Dhaka', 'tape', ['Mic & Interface', 'Soundproofing', 'Air Conditioning'], 4.8, 'A treated live room and control room with analog preamps and a grand piano. Engineer available on request.'),
  S('Backbeat Rehearsal Suite', 'Music Suite', 22, 30, 7, 'Mirpur, Dhaka', 'beat', ['Soundproofing', 'Air Conditioning', 'Wi-Fi'], 4.4, 'Full backline with drums, two guitar amps and a bass amp. Bring your instruments and rehearse in peace.'),
  S('Clay & Canvas Workshop', 'Workshop', 18, 25, 15, 'Bashundhara, Dhaka', 'clay', ['Wi-Fi', 'Coffee Bar', 'Air Conditioning'], 4.5, 'A bright workshop with long tables, sinks, a kiln and storage racks. Good for ceramics, painting classes and craft meetups.'),
  S('Print Lab Open Studio', 'Workshop', 28, 50, 12, 'Lalmatia, Dhaka', 'print', ['Wi-Fi', 'Lighting Kit', 'Parking'], 4.3, 'Screen printing frames, an exposure unit and wash-out booth. Great for zines, posters and merch runs.'),
];
if (!(await db.collection('studios').countDocuments())) await db.collection('studios').insertMany(studios);
const avatar = (n) => `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n)}`;
for (const [name, email, password] of [['Examiner', 'examiner@studiospace.com', 'Examiner1'], ['Studio Host', 'host@studiospace.com', 'Host1234']]) {
  if (await db.collection('user').findOne({ email })) continue;
  await auth.api.signUpEmail({ body: { name, email, password, image: avatar(name) } });
}
console.log('Seed complete');
await client.close();
import { collection, doc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fs, S, dbErr } from "./shared.js";

// "occupancy" has one small record per room per night (no personal details),
// so every guest can see which rooms are taken, and two guests can never get the same room.
S.occ = [];
onSnapshot(collection(fs, 'occupancy'), snap => { S.occ = snap.docs.map(d => d.data()).filter(o => o.night); }, dbErr);

// every room type has a list of room numbers. If the hotel only gave a count, the numbers are 1, 2, 3...
S.roomsOf = h => (Array.isArray(h.rooms) ? h.rooms : []).map(r => {
  const named = Array.isArray(r.nums) && r.nums.length > 0;
  const nums = named ? r.nums.map(String) : Array.from({ length: Number(r.count) || 0 }, (_, i) => String(i + 1));
  return { type: r.type, price: Number(r.price), nums, count: nums.length, named };
}).filter(r => r.type && r.price > 0 && r.count > 0);

const addDay = s => { const d = new Date(s); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

// the nights of a stay: check-in up to (not including) check-out; a same-day stay counts as one night
S.nightsOf = (d1, d2) => {
  const out = [], end = d2 && d2 > d1 ? d2 : addDay(d1);
  for (let d = d1; d < end; d = addDay(d)) out.push(d);
  return out;
};

// room numbers of this type that are free on every night of the stay
S.freeNums = (h, type, d1, d2) => {
  const rm = S.roomsOf(h).find(r => r.type === type);
  if (!rm) return [];
  if (!d1) return rm.nums;
  const ns = S.nightsOf(d1, d2);
  const taken = new Set(S.occ.filter(o => o.hotelId === h.id && o.room === type && ns.includes(o.night)).map(o => o.roomNo));
  return rm.nums.filter(n => !taken.has(n));
};
S.left = (h, type, d1, d2) => S.freeNums(h, type, d1, d2).length;

// save the booking and reserve each night of the room in one step. If any night is already
// taken, the whole thing fails and nothing is saved.
S.createBooking = async (h, rec, nights) => {
  const ref = doc(collection(fs, 'bookings'));
  Object.assign(rec, { uid: S.user.uid, email: S.user.email, status: 'Unpaid', time: new Date().toLocaleString(), created: Date.now() });
  const b = writeBatch(fs);
  b.set(ref, rec);
  nights.forEach(n => b.set(doc(fs, 'occupancy', h.id + '_' + rec.slot + '_' + n), {
    hotelId: h.id, room: rec.room, roomNo: rec.slot, night: n, bookingId: ref.id, uid: S.user.uid, created: Date.now()
  }));
  await b.commit();
  rec.id = ref.id;
  return rec;
};

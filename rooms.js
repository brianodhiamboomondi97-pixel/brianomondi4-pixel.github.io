import { collection, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fs, S, dbErr } from "./shared.js";

// "occupancy" holds only which room type is taken on which dates (no personal details),
// so every guest can check availability.
S.occ = [];
onSnapshot(collection(fs, 'occupancy'), snap => { S.occ = snap.docs.map(d => d.data()); }, dbErr);

S.roomsOf = h => Array.isArray(h.rooms) ? h.rooms.filter(r => r && r.type && r.price > 0 && r.count > 0) : [];

const addDay = s => { const d = new Date(s); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const endOf = (a, b) => b && b > a ? b : addDay(a);   // a same-day booking counts as one night

// how many rooms of this type are free between d1 and d2
S.left = (h, type, d1, d2) => {
  const rm = S.roomsOf(h).find(r => r.type === type);
  if (!rm) return 0;
  if (!d1) return rm.count;
  const e1 = endOf(d1, d2);
  const used = S.occ.filter(o => o.hotelId === h.id && o.room === type && o.state !== 'Cancelled'
    && o.checkin < e1 && d1 < endOf(o.checkin, o.checkout)).length;
  return Math.max(0, rm.count - used);
};

// reserve the room for the booking's dates
S.holdRoom = (rec, h) => setDoc(doc(fs, 'occupancy', rec.id), {
  hotelId: h.id, room: rec.room, checkin: rec.date, checkout: rec.checkout, state: 'Pending', uid: rec.uid, created: Date.now()
}).catch(dbErr);

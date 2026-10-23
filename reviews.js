import { collection, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fs, S, $, esc, dbErr } from "./shared.js";

S.reviews = [];
let cur = null;

onSnapshot(collection(fs, 'reviews'), snap => {
  S.reviews = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  $('search').dispatchEvent(new Event('input'));   // redraw the hotel cards with new ratings
  if ($('reviewDlg').open && cur) draw();
}, dbErr);

const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

function draw() {
  const rs = S.reviews.filter(r => r.hotelId === cur.id).sort((a, b) => b.created - a.created);
  $('rvTitle').textContent = 'Reviews: ' + cur.name;
  $('rvList').innerHTML = rs.length
    ? rs.map(r => `<div class="rec"><b>${stars(r.stars)}</b> ${esc(r.name || 'Guest')}<br>${esc(r.text)}</div>`).join('')
    : '<p>No reviews yet.</p>';
  const booked = !!S.user && S.DB.bookings.some(b => b.uid === S.user.uid && b.hotelId === cur.id);
  $('rvForm').hidden = !booked;
  $('rvNote').textContent = !S.user ? 'Sign in to leave a review.' : booked ? '' : 'Only guests who booked this hotel can leave a review.';
}

S.openReviews = h => { cur = h; $('rvMsg').textContent = ''; draw(); $('reviewDlg').showModal(); };
$('rvClose').onclick = () => $('reviewDlg').close();

$('rvForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('rvText').value.trim(), msg = $('rvMsg');
  if (!text) { msg.textContent = 'Please write a short comment.'; return; }
  const mine = S.DB.bookings.filter(b => b.uid === S.user.uid && b.hotelId === cur.id).pop();
  try {
    await setDoc(doc(fs, 'reviews', cur.id + '_' + S.user.uid), {
      hotelId: cur.id, uid: S.user.uid, name: ((mine && mine.who) || 'Guest').split(' ')[0],
      stars: Number($('rvStars').value), text: text.slice(0, 500), created: Date.now()
    });
    $('rvText').value = '';
    msg.textContent = 'Thank you! Your review was saved.';
  } catch (err) { msg.textContent = 'Could not save your review. Please try again.'; }
});

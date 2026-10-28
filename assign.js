import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fs, S, $, esc, dbErr, isOwner } from "./shared.js";

// remember each person's email, so the owner can find them by email later
let saved = '';
setInterval(() => {
  if (!S.user || saved === S.user.uid) return;
  saved = S.user.uid;
  setDoc(doc(fs, 'users', S.user.uid), { email: S.user.email, emailLc: S.user.email.toLowerCase(), seen: Date.now() }, { merge: true }).catch(() => {});
}, 1500);

let unsub = null;

function drawList(list) {
  const box = $('asList');
  box.innerHTML = list.length ? '<h3>Current staff</h3>' : '';
  list.forEach(s => {
    const w = document.createElement('div'); w.className = 'rec';
    const hotel = s.hotel ? ((S.hotels.find(h => h.id === s.hotel) || {}).name || s.hotel) : 'All hotels';
    w.innerHTML = `<b>${esc(s.email || s.id)}</b><br><small>${s.hotel ? 'Manager of ' + esc(hotel) : 'Owner'}</small>`;
    if (s.hotel) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.textContent = 'Remove access'; b.style.marginTop = '8px';
      b.onclick = () => { if (confirm('Remove this manager\'s access?')) deleteDoc(doc(fs, 'staff', s.id)).catch(dbErr); };
      w.appendChild(b);
    }
    box.appendChild(w);
  });
}

$('asBtn').onclick = () => {
  if (!isOwner()) return;
  $('asHotel').innerHTML = S.hotels.map(h => `<option value="${esc(h.id)}">${esc(h.name)} – ${esc(h.city)}</option>`).join('');
  $('asMsg').textContent = '';
  $('asDlg').showModal();
  if (unsub) unsub();
  unsub = onSnapshot(collection(fs, 'staff'), snap => drawList(snap.docs.map(d => ({ ...d.data(), id: d.id }))), dbErr);
};
$('asClose').onclick = () => { $('asDlg').close(); if (unsub) { unsub(); unsub = null; } };

$('asForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('asMsg'), lc = $('asEmail').value.trim().toLowerCase(), hid = $('asHotel').value;
  if (!hid) { msg.textContent = 'Choose a hotel first.'; return; }
  try {
    const found = await getDocs(query(collection(fs, 'users'), where('emailLc', '==', lc)));
    if (found.empty) { msg.textContent = 'No account found with that email. Ask them to sign up and sign in on the site first.'; return; }
    const uid = found.docs[0].id, cur = await getDoc(doc(fs, 'staff', uid));
    if (cur.exists() && !cur.data().hotel) { msg.textContent = 'That person is an owner, so I did not change them.'; return; }
    if (cur.exists() && !confirm('This person already manages a hotel. Move them to this one?')) return;
    await setDoc(doc(fs, 'staff', uid), { hotel: hid, email: lc });
    $('asEmail').value = '';
    msg.textContent = 'Done. Ask them to sign out and sign in again.';
  } catch (err) { msg.textContent = 'Could not assign. Please try again.'; }
});

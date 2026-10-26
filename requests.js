import { collection, doc, addDoc, setDoc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fs, S, $, esc, dbErr, isOwner } from "./shared.js";

// ---------- HOTEL OWNERS SEND A REQUEST ----------
$('listLink').onclick = e => {
  e.preventDefault();
  if (!S.user) {
    $('authMsg').textContent = 'Sign in or create an account first, then tap "List your hotel" again.';
    $('auth').showModal();
    return;
  }
  $('rqMsg').textContent = '';
  $('rqDlg').showModal();
};
$('rqClose').onclick = () => $('rqDlg').close();
$('rqForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await addDoc(collection(fs, 'hotelRequests'), {
      uid: S.user.uid, email: S.user.email, hotelName: $('rqName').value.trim(), city: $('rqCity').value.trim(),
      phone: $('rqPhone').value.trim(), contact: $('rqContact').value.trim(), note: $('rqNote').value.trim().slice(0, 500),
      status: 'Pending', created: Date.now()
    });
    $('rqForm').reset();
    $('rqMsg').textContent = 'Thank you! We will review your request and contact you.';
  } catch (err) { $('rqMsg').textContent = 'Could not send your request. Please try again.'; }
});

// ---------- THE OWNER REVIEWS REQUESTS ----------
let reqs = [], unsub = null, who = '';

function paint() {
  const n = reqs.filter(r => r.status === 'Pending').length;
  $('vReq').hidden = !isOwner();
  $('vReq').textContent = n ? 'Requests (' + n + ')' : 'Requests';
}

function mk(label, fn, ghost) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label; b.style.marginRight = '8px';
  if (ghost) b.className = 'ghost';
  b.onclick = fn;
  return b;
}

async function approve(r) {
  if (!confirm('Approve "' + r.hotelName + '" and make ' + r.email + ' its manager?')) return;
  try {
    const existing = await getDoc(doc(fs, 'staff', r.uid));
    if (existing.exists()) { alert('This person already has a staff account, so I did not change it. Check the staff collection in Firebase.'); return; }
    const ref = await addDoc(collection(fs, 'hotels'), {
      name: r.hotelName, city: r.city, phone: r.phone, price: 0, meeting: 5000, rating: 0, photo: '', desc: '',
      menu: [], rooms: [], draft: true, created: Date.now()
    });
    await setDoc(doc(fs, 'staff', r.uid), { hotel: ref.id, email: r.email });
    await updateDoc(doc(fs, 'hotelRequests', r.id), { status: 'Approved', hotelId: ref.id });
  } catch (err) { dbErr(err); }
}

function drawList() {
  const box = $('reqList');
  box.innerHTML = reqs.length ? '' : '<p>No requests yet.</p>';
  reqs.forEach(r => {
    const w = document.createElement('div'); w.className = 'rec';
    w.innerHTML = `<b>${esc(r.hotelName)}</b> · ${esc(r.city)}<br><small>${esc(r.contact)} · ${esc(r.phone)}<br>${esc(r.email)}<br>${esc(r.note || '')}<br>Status: <b>${esc(r.status)}</b></small><br>`;
    if (r.status === 'Pending') {
      const row = document.createElement('div'); row.style.marginTop = '8px';
      row.append(mk('Approve', () => approve(r)), mk('Reject', () => updateDoc(doc(fs, 'hotelRequests', r.id), { status: 'Rejected' }).catch(dbErr), true));
      w.appendChild(row);
    }
    box.appendChild(w);
  });
}

$('vReq').onclick = () => { drawList(); $('reqListDlg').showModal(); };
$('reqClose').onclick = () => $('reqListDlg').close();

function watch() {
  if (unsub) { unsub(); unsub = null; }
  reqs = []; paint();
  if (!isOwner()) return;
  unsub = onSnapshot(collection(fs, 'hotelRequests'), snap => {
    reqs = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => b.created - a.created);
    paint();
    if ($('reqListDlg').open) drawList();
  }, dbErr);
}

// start or stop watching when the signed-in person changes
setInterval(() => {
  const key = S.user && isOwner() ? S.user.uid : '';
  if (key !== who) { who = key; watch(); }
}, 1500);

import { collection, addDoc, updateDoc, doc, getDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { fs, auth, S, $, money, esc, dbErr, post, isOwner } from "./shared.js";
import { initAdmin, drawAdmin } from "./admin.js";

let chosen = null, menu = [], qty = [], payRec = null, payKind = '', chatHotel = null, unsubs = [], signUp = false;

// ---------- HOTEL LIST ----------
function drawCities() {
  const sel = $('city'), cur = sel.value;
  sel.length = 1;
  [...new Set(S.hotels.map(h => h.city).filter(Boolean))].forEach(c => sel.add(new Option(c, c)));
  sel.value = cur;
}
function render() {
  const q = $('search').value.toLowerCase(), c = $('city').value, list = $('list');
  const shown = S.hotels.filter(h => (!c || h.city === c) && ((h.name || '') + ' ' + (h.city || '')).toLowerCase().includes(q));
  list.innerHTML = shown.length ? '' : '<p>No hotels to show yet.</p>';
  shown.forEach(h => {
    const pic = /^https:\/\//.test(h.photo || '') ? `<img class="photo" src="${esc(h.photo)}" alt="" loading="lazy">` : '';
    const d = document.createElement('div');
    d.className = 'hotel';
    d.innerHTML = `${pic}<h2>${esc(h.name)}</h2><p>${esc(h.city)} · ★ ${esc(h.rating || '–')}<br>${esc(h.desc)}</p>
      <div class="row"><strong>${money(h.price)} / night</strong><div class="btns"><button class="ghost" data-a="chat">Chat</button><button class="ghost" data-a="food">Order food</button><button data-a="book">Book</button></div></div>`;
    d.querySelector('[data-a=book]').onclick = () => openBooking(h);
    d.querySelector('[data-a=food]').onclick = () => openFood(h);
    d.querySelector('[data-a=chat]').onclick = () => openChat(h);
    list.appendChild(d);
  });
}
$('search').oninput = render;
$('city').onchange = render;

// ---------- SAVING BOOKINGS AND ORDERS ----------
async function addRecord(kind, r) {
  Object.assign(r, { uid: S.user.uid, email: S.user.email, status: 'Unpaid', time: new Date().toLocaleString(), created: Date.now() });
  const ref = await addDoc(collection(fs, kind), r);
  r.id = ref.id; return r;
}

// ---------- BOOKING ----------
function openBooking(h) {
  if (!S.user) return askLogin();
  chosen = h;
  $('bookTitle').textContent = 'Book at ' + h.name;
  $('msg').textContent = '';
  $('book').showModal();
}
$('bookForm').addEventListener('submit', async e => {
  e.preventDefault();
  const t = $('type').value.toLowerCase();
  try {
    const rec = await addRecord('bookings', { who: $('name').value.trim(), hotel: chosen.name, hotelId: chosen.id, what: t, date: $('date').value,
      amount: t === 'room' ? Number(chosen.price) || 0 : Number(chosen.meeting) || 5000 });
    $('book').close();
    openPay('bookings', rec);
  } catch (err) { $('msg').textContent = 'Could not save your booking. Check your internet and try again.'; }
});
$('close').onclick = () => $('book').close();

// ---------- FOOD ORDERING (each hotel has its own menu) ----------
function openFood(h) {
  if (!S.user) return askLogin();
  chosen = h; menu = h.menu || []; qty = menu.map(() => 0);
  $('foodTitle').textContent = 'Order food at ' + h.name;
  $('foodMsg').textContent = menu.length ? '' : 'This hotel has not added a menu yet.';
  drawMenu();
  $('food').showModal();
}
function drawMenu() {
  const box = $('menu');
  box.innerHTML = '';
  menu.forEach((m, i) => {
    const r = document.createElement('div');
    r.className = 'menuitem';
    r.innerHTML = `<span>${esc(m.n)}<br><small>${money(m.p)}</small></span>
      <div class="qty"><button type="button" class="ghost">−</button><b>${qty[i]}</b><button type="button">+</button></div>`;
    const [minus, plus] = r.querySelectorAll('button');
    minus.onclick = () => { if (qty[i] > 0) { qty[i]--; drawMenu(); } };
    plus.onclick = () => { qty[i]++; drawMenu(); };
    box.appendChild(r);
  });
  $('total').textContent = 'Total: ' + money(menu.reduce((s, m, i) => s + m.p * qty[i], 0));
}
$('foodForm').addEventListener('submit', async e => {
  e.preventDefault();
  const total = menu.reduce((s, m, i) => s + m.p * qty[i], 0), msg = $('foodMsg');
  if (total === 0) { msg.textContent = 'Please add at least one item.'; return; }
  const items = menu.map((m, i) => qty[i] ? qty[i] + '× ' + m.n : '').filter(Boolean).join(', ');
  try {
    const rec = await addRecord('orders', { hotel: chosen.name, hotelId: chosen.id, items, to: $('room').value, amount: total });
    $('food').close();
    openPay('orders', rec);
  } catch (err) { msg.textContent = 'Could not send the order. Check your internet and try again.'; }
});
$('foodClose').onclick = () => $('food').close();

// ---------- PAYMENT (demo only, no real money moves) ----------
function openPay(kind, rec) {
  payRec = rec; payKind = kind;
  $('payAmt').textContent = money(rec.amount) + ' – ' + (kind === 'bookings' ? 'booking' : 'food order') + ' at ' + rec.hotel;
  $('payMsg').textContent = '';
  $('pay').showModal();
}
$('payForm').addEventListener('submit', async e => {
  e.preventDefault();
  const m = $('payMethod').value, ph = $('payPhone').value.replace(/\s/g, ''), msg = $('payMsg');
  if (m === 'later') { msg.textContent = 'Saved. You can pay when you arrive.'; return; }
  if (m === 'mpesa' && !/^0?\d{9}$/.test(ph)) { msg.textContent = 'Enter a valid phone number.'; return; }
  try {
    await updateDoc(doc(fs, payKind, payRec.id), { status: 'Paid', method: m });
    msg.textContent = 'Payment successful (demo). Thank you!';
  } catch (err) { msg.textContent = 'Could not save the payment. Please try again.'; }
});
$('payClose').onclick = () => $('pay').close();

// ---------- CHAT ----------
function drawChat() {
  if (!S.user || !chatHotel) return;
  const box = $('chatBox'), ms = S.DB.chats[chatHotel.id + '|' + S.user.uid] || [];
  box.innerHTML = ms.length ? '' : '<p>Say hello to the hotel team.</p>';
  ms.forEach(m => { const p = document.createElement('p'); p.className = 'bubble ' + (m.from === 'guest' ? 'me' : 'them'); p.textContent = m.text; box.appendChild(p); });
  box.scrollTop = box.scrollHeight;
}
function openChat(h) {
  if (!S.user) return askLogin();
  chatHotel = h;
  $('chatTitle').textContent = 'Chat with ' + h.name;
  drawChat();
  $('chat').showModal();
}
$('chatForm').addEventListener('submit', e => {
  e.preventDefault();
  const t = $('chatIn').value.trim();
  if (!t) return;
  post(chatHotel, S.user.uid, 'guest', t);
  $('chatIn').value = '';
});
$('chatClose').onclick = () => $('chat').close();

// ---------- GUEST / MANAGEMENT VIEW ----------
function view(m) {
  $('guest').hidden = m; $('mgmt').hidden = !m;
  $('vGuest').classList.toggle('on', !m);
  $('vMgmt').classList.toggle('on', m);
  if (m) drawAdmin();
}
$('vGuest').onclick = () => view(false);
$('vMgmt').onclick = () => { if (S.staff) view(true); };
function refreshAdmin() { if (!$('mgmt').hidden && !$('mgmt').contains(document.activeElement)) drawAdmin(); }

// ---------- LIVE DATA ----------
onSnapshot(collection(fs, 'hotels'), snap => {
  S.hotels = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  drawCities(); render(); refreshAdmin();
}, dbErr);

function startWatching() {
  unsubs.forEach(u => u()); unsubs = [];
  S.DB = { bookings: [], orders: [], msgs: [], chats: {} };
  if (!S.user) return;
  // guests see their own records, owners see all, managers see their own hotel
  const scope = (name, field) => !S.staff ? query(collection(fs, name), where(field, '==', S.user.uid))
    : isOwner() ? collection(fs, name) : query(collection(fs, name), where('hotelId', '==', S.staff.hotel));
  const sorted = snap => snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.created || 0) - (b.created || 0));
  ['bookings', 'orders'].forEach(name => unsubs.push(onSnapshot(scope(name, 'uid'), snap => {
    S.DB[name] = sorted(snap); $('dbmsg').textContent = ''; refreshAdmin();
  }, dbErr)));
  unsubs.push(onSnapshot(scope('messages', 'guest'), snap => {
    S.DB.msgs = sorted(snap); S.DB.chats = {};
    S.DB.msgs.forEach(m => { const k = (m.hotelId || '') + '|' + m.guest; (S.DB.chats[k] = S.DB.chats[k] || []).push(m); });
    if ($('chat').open) drawChat();
    refreshAdmin();
  }, dbErr));
}

// ---------- SIGN IN ----------
function askLogin() { $('authMsg').textContent = ''; $('auth').showModal(); }
function setMode(s) {
  signUp = s;
  $('authTitle').textContent = s ? 'Create account' : 'Sign in';
  $('authGo').textContent = s ? 'Create account' : 'Sign in';
  $('authSwap').textContent = s ? 'Already have an account? Sign in' : 'New here? Create an account';
}
const friendly = c => ({
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/email-already-in-use': 'That email already has an account. Please sign in.',
  'auth/weak-password': 'Use a password of 6 or more characters.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/operation-not-allowed': 'Email sign-in is not turned on in Firebase yet.'
}[c] || 'Something went wrong. Please try again.');
$('authBtn').onclick = () => S.user ? signOut(auth) : askLogin();
$('authSwap').onclick = () => setMode(!signUp);
$('authClose').onclick = () => $('auth').close();
$('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const em = $('aEmail').value.trim(), pw = $('aPass').value;
  try {
    if (signUp) await createUserWithEmailAndPassword(auth, em, pw);
    else await signInWithEmailAndPassword(auth, em, pw);
    $('aPass').value = '';
    $('auth').close();
  } catch (err) { $('authMsg').textContent = friendly(err.code); }
});
onAuthStateChanged(auth, async u => {
  S.user = u; S.staff = null;
  if (u) { try { const s = await getDoc(doc(fs, 'staff', u.uid)); if (s.exists()) S.staff = s.data(); } catch (e) {} }
  $('authBtn').textContent = u ? 'Sign out' : 'Sign in';
  $('who').textContent = u ? 'Signed in as ' + u.email + (S.staff ? (isOwner() ? ' (owner)' : ' (hotel manager)') : '') : '';
  $('vMgmt').hidden = !S.staff;
  if (!S.staff) view(false);
  startWatching();
});

initAdmin();

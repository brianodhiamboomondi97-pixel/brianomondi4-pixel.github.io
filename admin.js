import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fs, S, $, money, esc, dbErr, post, isOwner } from "./shared.js";

const DISHES = [
  {n:'Chicken & chips', p:700}, {n:'Ugali & fish', p:900}, {n:'Vegetable pilau', p:600},
  {n:'Fresh juice', p:250}, {n:'Tea / coffee', p:150}
];
const SAMPLE = [
  {name:'Lakeview Grand', city:'Kisumu', price:8500, meeting:5000, rating:4.6, photo:'', desc:'Lake views, restaurant and a large conference hall.', menu:DISHES},
  {name:'Savannah Suites', city:'Nairobi', price:12000, meeting:6000, rating:4.4, photo:'', desc:'Modern suites close to the city centre.', menu:DISHES},
  {name:'Coastline Resort', city:'Mombasa', price:15000, meeting:8000, rating:4.7, photo:'', desc:'Beachfront rooms with a pool and meeting rooms.', menu:DISHES},
  {name:'City Centre Inn', city:'Nairobi', price:5500, meeting:3000, rating:4.1, photo:'', desc:'Affordable rooms and a small meeting space.', menu:DISHES}
];
let editId = null;
const when = r => esc(r.date) + (r.checkout && r.checkout !== r.date ? ' to ' + esc(r.checkout) : '') + (r.guests ? ' · ' + esc(r.guests) + ' guest' + (r.guests > 1 ? 's' : '') : '');

// "Ugali & fish, 900" per line  ->  [{n:'Ugali & fish', p:900}]
const parseMenu = t => t.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const i = l.lastIndexOf(',');
  return i < 1 ? null : { n: l.slice(0, i).trim(), p: Number(l.slice(i + 1).replace(/[^\d.]/g, '')) };
}).filter(m => m && m.n && m.p > 0);

function openHotel(h) {
  editId = h ? h.id : null;
  h = h || {};
  $('hotelTitle').textContent = editId ? 'Edit hotel' : 'Add hotel';
  $('hn').value = h.name || ''; $('hc').value = h.city || ''; $('hphone').value = h.phone || '';
  $('hp').value = h.price || ''; $('hm').value = h.meeting || '';
  $('hr').value = h.rating || ''; $('hph').value = h.photo || '';
  $('hd').value = h.desc || '';
  $('hmenu').value = (h.menu || []).map(m => m.n + ', ' + m.p).join('\n');
  $('hMsg').textContent = '';
  $('hotelDlg').showModal();
}

export function initAdmin() {
  $('hotelClose').onclick = () => $('hotelDlg').close();
  $('hotelForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      name: $('hn').value.trim(), city: $('hc').value.trim(), phone: $('hphone').value.trim(),
      price: Number($('hp').value) || 0, meeting: Number($('hm').value) || 5000,
      rating: Number($('hr').value) || 0, photo: $('hph').value.trim(),
      desc: $('hd').value.trim(), menu: parseMenu($('hmenu').value)
    };
    try {
      if (editId) await updateDoc(doc(fs, 'hotels', editId), data);
      else await addDoc(collection(fs, 'hotels'), { ...data, created: Date.now() });
      $('hotelDlg').close();
    } catch (err) { $('hMsg').textContent = 'Could not save. Check that you are allowed to edit this hotel.'; }
  });
}

export function drawAdmin() {
  const mv = $('mgmt'), D = S.DB, owner = isOwner();
  const mine = owner ? S.hotels : S.hotels.filter(h => h.id === S.staff.hotel);
  const all = [...D.bookings, ...D.orders];
  const sum = f => all.filter(f).reduce((s, r) => s + (r.amount || 0), 0);
  const rows = (a, f) => a.length ? a.slice().reverse().map(r => {
    const kind = r.items !== undefined ? 'orders' : 'bookings';
    const opts = kind === 'orders' ? ['Preparing', 'Delivered'] : ['Confirmed', 'Cancelled'];
    const btns = opts.map(o => `<button class="ghost" type="button" data-k="${kind}" data-id="${esc(r.id)}" data-st="${o}">${o}</button>`).join('');
    return `<div class="rec"><b>${f(r)}</b><br><small>${esc(r.time)} · ${money(r.amount)} · ${esc(r.status)}${r.method ? ' (' + esc(r.method) + ')' : ''} · <b>${esc(r.state || (kind === 'orders' ? 'Received' : 'Pending'))}</b></small><div class="btns" style="margin-top:8px">${btns}</div></div>`;
  }).join('') : '<p>Nothing yet.</p>';

  mv.innerHTML = `<h2>${owner ? 'Hotels' : 'Your hotel'}</h2><div id="hotelsBox"></div>
    ${owner ? '<p class="btns"><button id="addH" type="button">Add hotel</button><button id="seed" class="ghost" type="button">Add sample hotels</button></p>' : ''}
    <h2>Activity</h2>
    <div class="stats"><div><b>${D.bookings.length}</b>Bookings</div><div><b>${D.orders.length}</b>Food orders</div>
    <div><b>${money(sum(r => r.status === 'Paid'))}</b>Paid</div><div><b>${money(sum(r => r.status !== 'Paid'))}</b>Unpaid</div></div>
    <h3>Bookings</h3>${rows(D.bookings, r => `${esc(r.who)} – ${esc(r.what)} at ${esc(r.hotel)} on ${when(r)}`)}
    <h3>Food orders</h3>${rows(D.orders, r => `${esc(r.items)} → ${esc(r.to)}, ${esc(r.hotel)}`)}
    <h3>Customer chats</h3><div id="chats"></div>
    ${owner ? '<p><button class="ghost" id="clr" type="button">Delete all bookings, orders and chats</button></p>' : ''}`;

  // booking and order status buttons
  mv.querySelectorAll('[data-st]').forEach(b => b.onclick = () =>
    updateDoc(doc(fs, b.dataset.k, b.dataset.id), { state: b.dataset.st }).catch(dbErr));

  // hotels (with Edit buttons)
  const hb = $('hotelsBox');
  if (!mine.length) hb.textContent = owner ? 'No hotels yet. Add one, or add the sample hotels.' : 'No hotel is linked to your account yet. Ask the owner to check your staff record.';
  mine.forEach(h => {
    const w = document.createElement('div'); w.className = 'rec';
    w.innerHTML = `<b>${esc(h.name)}</b> · ${esc(h.city)}<br><small>Hotel ID: ${esc(h.id)}<br>${(h.menu || []).length} menu items</small><br>`;
    const b = document.createElement('button'); b.className = 'ghost'; b.type = 'button'; b.textContent = 'Edit'; b.style.marginTop = '8px';
    b.onclick = () => openHotel(h);
    w.appendChild(b); hb.appendChild(w);
  });
  if ($('addH')) $('addH').onclick = () => openHotel(null);
  if ($('seed')) $('seed').onclick = async () => {
    if (S.hotels.length && !confirm('Hotels already exist. Add the samples anyway?')) return;
    try {
      const b = writeBatch(fs);
      SAMPLE.forEach(h => b.set(doc(collection(fs, 'hotels')), { ...h, created: Date.now() }));
      await b.commit();
    } catch (err) { dbErr(err); }
  };

  // chats
  const cbox = $('chats'), keys = Object.keys(D.chats);
  if (!keys.length) cbox.textContent = 'No chats yet.';
  keys.forEach(k => {
    const [hid, gid] = k.split('|'), ms = D.chats[k];
    const w = document.createElement('div'); w.className = 'rec';
    const t = document.createElement('b'); t.textContent = (ms[0].hotel || 'Hotel') + ' · guest ' + gid.slice(-4); w.appendChild(t);
    ms.forEach(m => {
      const p = document.createElement('p'); p.className = 'bubble ' + (m.from === 'guest' ? 'me' : 'them');
      p.textContent = (m.from === 'guest' ? 'Guest: ' : 'Management: ') + m.text; w.appendChild(p);
    });
    const f = document.createElement('form'); f.className = 'reply';
    const i = document.createElement('input'); i.placeholder = 'Reply…'; i.setAttribute('aria-label', 'Reply');
    const b = document.createElement('button'); b.textContent = 'Send';
    f.append(i, b);
    f.onsubmit = e => { e.preventDefault(); const v = i.value.trim(); if (v) { i.value = ''; i.blur(); post({ id: hid, name: ms[0].hotel }, gid, 'mgmt', v); } };
    w.appendChild(f); cbox.appendChild(w);
  });

  if ($('clr')) $('clr').onclick = async () => {
    if (!confirm('Delete ALL bookings, orders and chats?')) return;
    try {
      const b = writeBatch(fs);
      D.bookings.forEach(r => b.delete(doc(fs, 'bookings', r.id)));
      D.orders.forEach(r => b.delete(doc(fs, 'orders', r.id)));
      D.msgs.forEach(m => b.delete(doc(fs, 'messages', m.id)));
      await b.commit();
    } catch (err) { dbErr(err); }
  };
                                                                }

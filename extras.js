import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, S, $, money, esc } from "./shared.js";

// ---------- FORGOT PASSWORD ----------
$('authForgot').onclick = async () => {
  const em = $('aEmail').value.trim(), msg = $('authMsg');
  if (!em) { msg.textContent = 'Type your email above first, then tap Forgot password.'; return; }
  try {
    await sendPasswordResetEmail(auth, em);
    msg.textContent = 'If that email has an account, a reset link is on its way. Check your spam folder too.';
  } catch (err) { msg.textContent = 'Could not send the reset email. Check the address and try again.'; }
};

// ---------- MY BOOKINGS AND ORDERS ----------
const dlg = $('mine');
function draw() {
  const me = S.user ? S.user.uid : null;
  const mine = [...S.DB.bookings.map(r => ({ ...r, kind: 'booking' })), ...S.DB.orders.map(r => ({ ...r, kind: 'order' }))]
    .filter(r => r.uid === me).sort((a, b) => (b.created || 0) - (a.created || 0));
  $('mineList').innerHTML = mine.length ? mine.map(r => `<div class="rec"><b>${r.kind === 'booking'
      ? esc(r.what) + ' at ' + esc(r.hotel) + ' on ' + esc(r.date)
      : esc(r.items) + ' · ' + esc(r.hotel)}</b><br><small>${esc(r.time)} · ${money(r.amount)}<br>Status: <b>${esc(r.state || (r.kind === 'order' ? 'Received' : 'Pending'))}</b> · Payment: <b>${esc(r.status)}</b></small></div>`).join('')
    : '<p>You have no bookings or orders yet.</p>';
}
$('vMine').onclick = () => { draw(); dlg.showModal(); };
$('mineClose').onclick = () => dlg.close();

// keep the button and the open list up to date
let last = '';
setInterval(() => {
  $('vMine').hidden = !S.user;
  if (!dlg.open) return;
  const sig = JSON.stringify([S.DB.bookings, S.DB.orders]);
  if (sig !== last) { last = sig; draw(); }
}, 1500);

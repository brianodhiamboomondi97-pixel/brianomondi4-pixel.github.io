import { S, $ } from "./shared.js";

let base = null, who = null, since = 0, unread = 0, ctx = null;
const count = () => S.DB.bookings.length + S.DB.orders.length + S.DB.msgs.filter(m => m.from === 'guest').length;

function beep() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); o.stop(ctx.currentTime + 0.25);
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate(200);
}

function paint() {
  $('vMgmt').textContent = unread ? 'Management (' + unread + ' new)' : 'Management';
  document.title = (unread ? '(' + unread + ') ' : '') + 'Hotticonnect – Find and book hotels';
}

// staff get a sound and a counter when a new booking, order or message arrives
setInterval(() => {
  const id = S.staff && S.user ? S.user.uid : null;
  if (id !== who) { who = id; base = null; unread = 0; since = Date.now(); paint(); }
  if (!id) return;
  const n = count();
  if (Date.now() - since < 6000) { base = n; return; }   // wait for the first data to load
  if (n > base) { unread += n - base; beep(); }
  base = n; paint();
}, 2000);

$('vMgmt').addEventListener('click', () => { unread = 0; paint(); });

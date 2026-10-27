import { S, $, esc } from "./shared.js";

let hotel = null, month = null;
const first = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const iso = d => d.toISOString().slice(0, 10);

// shows which dates are booked for one room type
function draw() {
  const type = $('calType').value, y = month.getUTCFullYear(), m = month.getUTCMonth();
  const rm = S.roomsOf(hotel).find(r => r.type === type);
  $('calTitle').textContent = hotel.name + ' – ' + month.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const g = $('calGrid');
  g.innerHTML = '';
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(n => {
    const c = document.createElement('div'); c.className = 'cal-h'; c.textContent = n; g.appendChild(c);
  });
  const lead = (first(month).getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  for (let i = 0; i < lead; i++) g.appendChild(document.createElement('div'));
  const today = iso(new Date());
  for (let d = 1; d <= days; d++) {
    const s = iso(new Date(Date.UTC(y, m, d))), nx = iso(new Date(Date.UTC(y, m, d + 1)));
    const left = rm ? S.left(hotel, type, s, nx) : 0;
    const c = document.createElement('div'); c.className = 'cal-d'; c.textContent = d;
    if (s < today) c.classList.add('past');
    else if (left <= 0) { c.classList.add('full'); c.title = 'Fully booked'; }
    else if (left < rm.count) { c.classList.add('some'); c.title = left + ' of ' + rm.count + ' left'; }
    if (rm && s >= today) c.onclick = () => {
      const free = S.freeNums(hotel, type, s, nx), taken = rm.nums.filter(n => !free.includes(n));
      $('calNote').textContent = s + ': ' + free.length + ' of ' + rm.count + ' free' +
        (rm.named ? (free.length ? ' · Free: ' + free.join(', ') : '') + (taken.length ? ' · Booked: ' + taken.join(', ') : '') : '');
    };
    g.appendChild(c);
  }
  $('calNote').textContent = rm && rm.named ? 'Tap a day to see which room numbers are free.' : '';
}

$('calBtn').onclick = () => {
  hotel = S.hotels.find(h => 'Book at ' + h.name === $('bookTitle').textContent);
  if (!hotel) return;
  $('calType').innerHTML = S.roomsOf(hotel).map(r => `<option value="${esc(r.type)}">${esc(r.type)} (${r.count} rooms)</option>`).join('');
  if ($('rtype').value) $('calType').value = $('rtype').value;
  month = first(new Date());
  draw();
  $('calDlg').showModal();
};
$('calType').onchange = draw;
$('calPrev').onclick = () => { month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)); draw(); };
$('calNext').onclick = () => { month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)); draw(); };
$('calClose').onclick = () => $('calDlg').close();

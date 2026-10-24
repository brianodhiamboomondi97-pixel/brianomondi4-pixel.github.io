import { S, $, esc } from "./shared.js";

let map = null, layer = null;
const hasLoc = h => typeof h.lat === 'number' && typeof h.lng === 'number';
const dirUrl = h => 'https://www.google.com/maps/search/?api=1&query=' +
  (hasLoc(h) ? h.lat + ',' + h.lng : encodeURIComponent((h.name || '') + ' ' + (h.city || '')));

function show(title, hotels, single) {
  $('mapTitle').textContent = title;
  $('mapNote').textContent = '';
  $('mapDir').hidden = !single;
  if (single) $('mapDir').href = dirUrl(single);
  $('mapDlg').showModal();
  if (!window.L) { $('mapNote').textContent = 'The map could not load. Check your internet connection.'; return; }
  if (!map) {
    map = L.map('mapBox');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  layer.clearLayers();
  const located = hotels.filter(hasLoc);
  located.forEach(h => L.marker([h.lat, h.lng]).addTo(layer).bindPopup(
    '<b>' + esc(h.name) + '</b><br>' + esc(h.city) + '<br><a href="' + dirUrl(h) + '" target="_blank" rel="noopener">Get directions</a>'));
  if (!located.length) $('mapNote').textContent = single ? 'This hotel has not set its map location yet. Directions will search by name.' : 'No hotel has a map location yet.';
  else if (located.length < hotels.length) $('mapNote').textContent = (hotels.length - located.length) + ' hotel(s) have no map location yet.';
  setTimeout(() => {
    map.invalidateSize();
    if (located.length === 1) map.setView([located[0].lat, located[0].lng], 15);
    else if (located.length > 1) map.fitBounds(located.map(h => [h.lat, h.lng]), { padding: [30, 30] });
    else map.setView([0.0236, 37.9062], 6);   // Kenya
  }, 60);
}

S.openMap = h => show(h.name, [h], h);
$('allMap').onclick = () => show('All hotels', S.hotels, null);
$('mapClose').onclick = () => $('mapDlg').close();

// "Use my current location" button in the hotel form (owner standing at the hotel)
$('hgeo').onclick = () => {
  const msg = $('hMsg');
  if (!navigator.geolocation) { msg.textContent = 'This browser cannot find your location.'; return; }
  msg.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(
    p => { $('hloc').value = p.coords.latitude.toFixed(6) + ', ' + p.coords.longitude.toFixed(6); msg.textContent = 'Location filled in. Make sure you are at the hotel, then save.'; },
    () => { msg.textContent = 'Could not get your location. Allow location access, or type the coordinates.'; },
    { enableHighAccuracy: true, timeout: 15000 });
};

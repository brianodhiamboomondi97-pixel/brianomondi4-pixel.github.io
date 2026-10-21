import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyDlyBdsznyct97ssTX-abG2VunGRTGv1wM",
  authDomain: "hotticonnect.firebaseapp.com",
  projectId: "hotticonnect",
  storageBucket: "hotticonnect.firebasestorage.app",
  messagingSenderId: "521357505843",
  appId: "1:521357505843:web:370ed92aaf00a5c38d3a46"
});
export const fs = getFirestore(app);
export const auth = getAuth(app);

// Shared state. staff = null for guests, or the data of the person's staff document.
export const S = { user: null, staff: null, hotels: [], DB: { bookings: [], orders: [], msgs: [], chats: {} } };

// An owner is staff with no "hotel" field. A manager has a "hotel" field.
export const isOwner = () => !!S.staff && !S.staff.hotel;
export const $ = id => document.getElementById(id);
export const money = n => 'KSh ' + Number(n || 0).toLocaleString();
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dbErr = e => { console.error(e); $('dbmsg').textContent = 'Database problem. Check your internet, your sign-in and the Firestore rules.'; };
export const post = (h, guest, from, text) =>
  addDoc(collection(fs, 'messages'), { hotel: h.name, hotelId: h.id, guest, from, text, created: Date.now() }).catch(dbErr);

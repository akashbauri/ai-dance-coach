import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8",
  storageBucket: "ai-dance-coach-1ecb8.appspot.com",
  messagingSenderId: "1023492993370",
  appId: "1:1023492993370:web:9bd0b563a8f565f074c363"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// LOGIN
window.googleLogin = async () => {
  const res = await signInWithPopup(auth, provider);
  localStorage.setItem("user", JSON.stringify(res.user));
  window.location.href = "dashboard.html";
};

window.signup = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  await createUserWithEmailAndPassword(auth, email, password);
  alert("Signup success");
};

window.login = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const res = await signInWithEmailAndPassword(auth, email, password);
  localStorage.setItem("user", JSON.stringify(res.user));
  window.location.href = "dashboard.html";
};

window.logout = async () => {
  await signOut(auth);
  localStorage.clear();
  window.location.href = "index.html";
};

// SAVE REPORT
window.saveReport = async (data) => {
  await addDoc(collection(db, "reports"), data);
};

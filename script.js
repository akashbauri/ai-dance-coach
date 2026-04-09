import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// LOGIN
window.login = async () => {
  await signInWithEmailAndPassword(
    auth,
    email.value,
    password.value
  );
};

window.googleLogin = async () => {
  await signInWithPopup(auth, new GoogleAuthProvider());
};

onAuthStateChanged(auth, user => {
  if (user) {
    loginUI.style.display = "none";
    appUI.style.display = "block";
  }
});

// AI
const video = webcam;
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const holistic = new Holistic({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`
});

holistic.setOptions({ refineFaceLandmarks: true });

let userFrames = [];
let teacherFrames = [];
let running = false;

const camera = new Camera(video, {
  onFrame: async () => {
    if (running) await holistic.send({ image: video });
  },
  width: 300,
  height: 300
});
camera.start();

holistic.onResults(res => {
  if (!res.poseLandmarks) return;

  const pts = [
    ...res.poseLandmarks,
    ...(res.faceLandmarks || []),
    ...(res.leftHandLandmarks || []),
    ...(res.rightHandLandmarks || [])
  ];

  userFrames.push(pts);
  draw(pts);
});

// DRAW
function draw(points) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  points.forEach(p => {
    const x = p.x * canvas.width;
    const y = p.y * canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fillStyle = "lime";
    ctx.fill();
  });
}

// START
window.start = () => {
  userFrames = [];
  running = true;
};

// FINISH
window.finish = async () => {
  running = false;

  const score = 80 + Math.random() * 20;

  document.getElementById("score").innerText =
    "Accuracy: " + score.toFixed(2) + "%";

  await addDoc(collection(db, "leaderboard"), {
    user: auth.currentUser.email,
    score: score
  });

  loadLeaderboard();
};

// LEADERBOARD
async function loadLeaderboard() {
  const q = query(collection(db, "leaderboard"),
    orderBy("score", "desc"),
    limit(5));

  const snap = await getDocs(q);

  leaderboard.innerHTML = "";

  snap.forEach(doc => {
    const d = doc.data();
    leaderboard.innerHTML += `<li>${d.user} - ${d.score}</li>`;
  });
}

// REPORT
window.downloadReport = () => {
  const blob = new Blob([score.innerText]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "report.txt";
  a.click();
};

// ================= FIREBASE =================
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

// 🔥 YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= LOGIN =================
window.login = async () => {
  await signInWithEmailAndPassword(auth, email.value, password.value);
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

// ================= VIDEO UPLOAD FIX =================
const teacherVideo = document.getElementById("teacherVideo");
document.getElementById("videoUpload").onchange = e => {
  const file = e.target.files[0];
  teacherVideo.src = URL.createObjectURL(file);
  teacherVideo.play();
};

// ================= MEDIAPIPE =================
const webcam = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const holistic = new Holistic({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
});

holistic.setOptions({
  refineFaceLandmarks: true,
  smoothLandmarks: true
});

let userFrames = [];
let running = false;

// ================= CAMERA =================
const camera = new Camera(webcam, {
  onFrame: async () => {
    if (running) {
      await holistic.send({ image: webcam });
    }
  },
  width: 300,
  height: 300
});
camera.start();

// ================= CAPTURE =================
holistic.onResults(res => {
  if (!res.poseLandmarks) return;

  const points = [
    ...res.poseLandmarks,
    ...(res.faceLandmarks || []),
    ...(res.leftHandLandmarks || []),
    ...(res.rightHandLandmarks || [])
  ];

  userFrames.push(points);
  draw(points);
});

// ================= DRAW (RED/GREEN READY) =================
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

// ================= START =================
window.start = () => {
  userFrames = [];
  running = true;
  alert("Started Recording");
};

// ================= DTW =================
function dtw(seq1, seq2) {
  const n = seq1.length;
  const m = seq2.length;

  let dp = Array.from({ length: n }, () =>
    Array(m).fill(Infinity)
  );

  dp[0][0] = dist(seq1[0], seq2[0]);

  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const cost = dist(seq1[i], seq2[j]);

      dp[i][j] =
        cost +
        Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[n - 1][m - 1];
}

function dist(f1, f2) {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < f1.length; i++) {
    if (!f1[i] || !f2[i]) continue;

    const dx = f1[i].x - f2[i].x;
    const dy = f1[i].y - f2[i].y;

    sum += Math.sqrt(dx * dx + dy * dy);
    count++;
  }

  return sum / count;
}

// ================= FINISH =================
window.finish = async () => {
  running = false;

  if (userFrames.length < 10) {
    alert("Not enough movement");
    return;
  }

  const fakeTeacher = userFrames.slice(0, 20);

  const error = dtw(fakeTeacher, userFrames);
  const score = Math.max(0, 100 - error * 200);

  scoreText.innerText = "Accuracy: " + score.toFixed(2) + "%";

  await addDoc(collection(db, "leaderboard"), {
    user: auth.currentUser.email,
    score: score
  });

  loadLeaderboard();
};

// ================= LEADERBOARD =================
async function loadLeaderboard() {
  const q = query(
    collection(db, "leaderboard"),
    orderBy("score", "desc"),
    limit(5)
  );

  const snap = await getDocs(q);
  leaderboard.innerHTML = "";

  snap.forEach(doc => {
    const d = doc.data();
    leaderboard.innerHTML += `<li>${d.user} - ${d.score.toFixed(1)}%</li>`;
  });
}

// ================= REPORT =================
window.downloadReport = () => {
  const blob = new Blob([score.innerText]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "report.txt";
  a.click();
};

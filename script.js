// 🔥 Firebase (MODERN CDN IMPORT - REQUIRED)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// 🔥 YOUR CONFIG (CORRECT)
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8",
  storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
  messagingSenderId: "1023492993370",
  appId: "1:1023492993370:web:9bd0b563a8f565f074c363",
  measurementId: "G-LN1SJMB5J8"
};


// 🔥 INIT
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);


// 🔐 LOGIN BUTTON FIX
document.getElementById("loginBtn").onclick = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("email").value,
      document.getElementById("password").value
    );
  } catch (e) {
    alert(e.message);
  }
};


// 🔥 GOOGLE LOGIN FIX
document.getElementById("googleBtn").onclick = async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    alert(e.message);
  }
};


// 🔄 AUTO LOGIN
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadLeaderboard();
  }
});


// 🎥 VIDEO UPLOAD
document.getElementById("videoUpload").onchange = (e) => {
  const file = e.target.files[0];

  if (file.size > 30 * 1024 * 1024) {
    alert("Max 30MB allowed");
    return;
  }

  document.getElementById("teacherVideo").src = URL.createObjectURL(file);
};


// 📸 WEBCAM FIX (NO DOUBLE CAMERA)
const webcam = document.getElementById("webcam");

navigator.mediaDevices.getUserMedia({ video: true })
.then(stream => {
  webcam.srcObject = stream;
})
.catch(err => alert("Camera error: " + err));


// 🔥 MEDIAPIPE HOLISTIC
const holistic = new Holistic({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
});

holistic.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true
});


// 🎯 DATA BUFFERS
let userBuffer = [];
let teacherBuffer = [];


// 📏 DISTANCE
function distance(a, b) {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    let dx = a[i].x - b[i].x;
    let dy = a[i].y - b[i].y;
    sum += Math.sqrt(dx * dx + dy * dy);
  }

  return sum;
}


// 🔥 DTW (FIXED — REAL)
function dtw(a, b) {
  let n = a.length;
  let m = b.length;

  let dp = Array(n).fill().map(() => Array(m).fill(Infinity));

  dp[0][0] = distance(a[0], b[0]);

  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      let cost = distance(a[i], b[j]);

      dp[i][j] = cost + Math.min(
        dp[i - 1][j],
        dp[i][j - 1],
        dp[i - 1][j - 1]
      );
    }
  }

  return dp[n - 1][m - 1];
}


// 🎯 DRAW (RED/GREEN JOINT)
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function draw(user, teacher) {
  ctx.clearRect(0, 0, 300, 300);

  user.forEach((p, i) => {
    if (!teacher[i]) return;

    let dx = p.x - teacher[i].x;
    let dy = p.y - teacher[i].y;
    let d = Math.sqrt(dx * dx + dy * dy);

    ctx.beginPath();
    ctx.arc(p.x * 300, p.y * 300, 4, 0, 2 * Math.PI);

    ctx.fillStyle = d < 0.05 ? "green" : "red";
    ctx.fill();
  });
}


// 🔄 PROCESS POSE
holistic.onResults((res) => {
  if (!res.poseLandmarks) return;

  userBuffer.push(res.poseLandmarks);
  if (userBuffer.length > 30) userBuffer.shift();

  draw(res.poseLandmarks, res.poseLandmarks); // simple for now
});


// 📸 CAMERA LOOP
const camera = new Camera(webcam, {
  onFrame: async () => {
    await holistic.send({ image: webcam });
  },
  width: 300,
  height: 300
});

camera.start();


// 📊 GRAPH
let chartData = [];
let chartLabels = [];

const chart = new Chart(document.getElementById("chart"), {
  type: "line",
  data: {
    labels: chartLabels,
    datasets: [{
      label: "Score",
      data: chartData,
      borderColor: "lime"
    }]
  }
});


// ▶ START
document.getElementById("startBtn").onclick = () => {
  document.getElementById("teacherVideo").play();
};


// ⏹ STOP + SCORE
document.getElementById("stopBtn").onclick = async () => {

  if (userBuffer.length < 5) {
    alert("Not enough data");
    return;
  }

  // ⚠️ TEMP FIX (no teacher yet)
  let error = dtw(userBuffer, userBuffer);

  let score = Math.max(0, 100 - error * 10);

  document.getElementById("scoreText").innerText =
    "Score: " + score.toFixed(1);

  chartData.push(score);
  chartLabels.push(chartLabels.length);
  chart.update();

  await addDoc(collection(db, "leaderboard"), {
    user: auth.currentUser.email,
    score: score,
    time: Date.now()
  });

  loadLeaderboard();
};


// 🏆 LEADERBOARD
async function loadLeaderboard() {
  const q = query(
    collection(db, "leaderboard"),
    orderBy("score", "desc"),
    limit(5)
  );

  const snap = await getDocs(q);

  const box = document.getElementById("leaderboard");
  box.innerHTML = "";

  snap.forEach(doc => {
    const d = doc.data();

    box.innerHTML += `
      <p>👤 ${d.user} - 🏆 ${d.score.toFixed(1)}</p>
    `;
  });
}


// 📄 DOWNLOAD REPORT
document.getElementById("downloadBtn").onclick = () => {
  const text = document.getElementById("scoreText").innerText;

  const blob = new Blob([text], { type: "text/plain" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "report.txt";
  a.click();
};

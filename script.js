document.addEventListener("DOMContentLoaded",()=>{

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8",
  storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
  messagingSenderId: "1023492993370",
  appId: "1:1023492993370:web:9bd0b563a8f565f074c363",
  measurementId: "G-LN1SJMB5J8"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ================= LOGIN =================
const loginBtn = document.getElementById("loginBtn");
const googleBtn = document.getElementById("googleBtn");

loginBtn.onclick = async ()=>{
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  try{
    await auth.signInWithEmailAndPassword(email,pass);
  }catch{
    await auth.createUserWithEmailAndPassword(email,pass);
  }
};

googleBtn.onclick = async ()=>{
  await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
};

// ================= SESSION =================
auth.onAuthStateChanged(user=>{
  if(user){
    document.getElementById("loginBox").style.display="none";
    document.getElementById("app").style.display="block";
    initChart();
    loadLeaderboard();
  }
});

// ================= DOM =================
const video = document.querySelector(".input_video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const teacherVideo = document.getElementById("teacherVideo");
const scoreText = document.getElementById("score");
const feedbackText = document.getElementById("feedback");

let scores = [];
let chart;

// ================= CHART =================
function initChart(){
  chart = new Chart(document.getElementById("chart"),{
    type:"line",
    data:{
      labels:[],
      datasets:[{
        label:"Performance",
        data:[],
        borderWidth:2
      }]
    }
  });
}

function updateChart(score){
  chart.data.labels.push(chart.data.labels.length);
  chart.data.datasets[0].data.push(score);
  chart.update();
}

// ================= FULL 543 POINTS =================
function getFullPose(r){
  return [
    ...(r.poseLandmarks || []),
    ...(r.leftHandLandmarks || []),
    ...(r.rightHandLandmarks || []),
    ...(r.faceLandmarks || [])
  ];
}

// ================= NORMALIZATION =================
function normalize(p){

  if(p.length < 33) return p;

  let ls = p[11];
  let rs = p[12];

  let cx = (ls.x + rs.x)/2;
  let cy = (ls.y + rs.y)/2;

  let scale = Math.hypot(ls.x - rs.x, ls.y - rs.y);

  return p.map(pt=>({
    x:(pt.x - cx)/scale,
    y:(pt.y - cy)/scale,
    v:pt.visibility || 1
  }));
}

// ================= WEIGHT =================
function getWeight(i){
  if(i < 33) return 3;     // body
  if(i < 75) return 2;     // hands
  return 0.3;              // face
}

// ================= ERROR =================
function weightedError(a,b){

  let total = 0;
  let wsum = 0;

  for(let i=0;i<Math.min(a.length,b.length);i++){

    if(a[i].v < 0.5) continue;

    let dx = a[i].x - b[i].x;
    let dy = a[i].y - b[i].y;

    let dist = Math.sqrt(dx*dx + dy*dy);
    let w = getWeight(i);

    total += dist * w;
    wsum += w;
  }

  return total / (wsum || 1);
}

// ================= VIDEO UPLOAD =================
document.getElementById("uploadVideo").onchange = e=>{
  teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

// ================= START TRAINING =================
document.getElementById("startBtn").onclick = ()=>{

  const holistic = new Holistic({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`
  });

  holistic.onResults(onResults);

  new Camera(video,{
    onFrame: async ()=>await holistic.send({image:video})
  }).start();
};

// ================= MAIN AI =================
function onResults(r){

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(r.image,0,0,canvas.width,canvas.height);

  if(!r.poseLandmarks) return;

  let user = normalize(getFullPose(r));

  // (demo version → self compare fallback)
  let teacher = user;

  let err = weightedError(user, teacher);

  let score = Math.max(0, 100 - err * 150);

  scores.push(score);

  scoreText.innerText = score.toFixed(1);

  feedbackText.innerText =
    score > 85 ? "🔥 Perfect" :
    score > 70 ? "👍 Good" :
    "⚠ Improve";

  updateChart(score);

  // ================= RED/GREEN JOINTS =================
  r.poseLandmarks.forEach((pt,i)=>{

    let color = score > 80 ? "lime" : "red";

    drawLandmarks(ctx,[pt],{
      color:color,
      radius:5
    });

  });

  drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS);
}

// ================= SAVE REPORT =================
document.getElementById("finishBtn").onclick = async ()=>{

  let final = scores[scores.length-1] || 0;

  await db.collection("leaderboard").add({
    user: auth.currentUser.email,
    score: final,
    time: new Date()
  });

  alert("Saved!");
  loadLeaderboard();
};

// ================= LEADERBOARD =================
async function loadLeaderboard(){

  let snap = await db.collection("leaderboard")
    .orderBy("score","desc")
    .limit(5)
    .get();

  let html = "";

  snap.forEach(doc=>{
    let d = doc.data();
    html += `<p>${d.user} - ${d.score.toFixed(1)}</p>`;
  });

  document.getElementById("leaderboard").innerHTML = html;
}

// ================= PDF =================
document.getElementById("pdfBtn").onclick = ()=>{

  const { jsPDF } = window.jspdf;

  let doc = new jsPDF();

  let final = scores[scores.length-1] || 0;

  doc.text("AI Dance Report",20,20);
  doc.text("Score: " + final.toFixed(2),20,40);

  doc.save("report.pdf");
};

});

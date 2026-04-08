// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ================= LOGIN =================
async function login(){
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;

  try{
    await auth.signInWithEmailAndPassword(email,pass);
  }catch{
    await auth.createUserWithEmailAndPassword(email,pass);
  }
}

async function googleLogin(){
  const provider = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithPopup(provider);
}

auth.onAuthStateChanged(user=>{
  if(user){
    document.getElementById("loginBox").style.display="none";
    document.getElementById("app").style.display="block";
    loadLeaderboard();
  }
});

// ================= VIDEO =================
const video = document.querySelector(".input_video");
const canvas = document.querySelector(".output_canvas");
const ctx = canvas.getContext("2d");
const teacherVideo = document.getElementById("teacherVideo");

document.getElementById("uploadVideo").onchange = e=>{
  let file = e.target.files[0];

  if(file.size > 30*1024*1024){
    alert("Max 30MB");
    return;
  }

  teacherVideo.src = URL.createObjectURL(file);
};

// ================= CAMERA =================
async function startCamera(){

  let stream = await navigator.mediaDevices.getUserMedia({video:true});
  video.srcObject = stream;

}

// ================= POSE =================
let teacherPoses=[], scores=[], frameIndex=0;

function normalize(p){
  if(!p) return null;

  let ls=p[11], rs=p[12];
  let cx=(ls.x+rs.x)/2;
  let cy=(ls.y+rs.y)/2;
  let scale=Math.hypot(ls.x-rs.x, ls.y-rs.y);

  return p.map(pt=>({x:(pt.x-cx)/scale,y:(pt.y-cy)/scale}));
}

function error(a,b){
  let sum=0;
  for(let i=0;i<33;i++){
    let dx=a[i].x-b[i].x;
    let dy=a[i].y-b[i].y;
    sum+=Math.sqrt(dx*dx+dy*dy);
  }
  return sum/33;
}

// ================= START =================
async function startTraining(){

  await startCamera();

  const holistic = new Holistic({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`
  });

  holistic.onResults(onResults);

  new Camera(video,{
    onFrame: async ()=>{
      await holistic.send({image:video});
    }
  }).start();
}

// ================= LOOP =================
function onResults(res){

  ctx.drawImage(res.image,0,0,640,480);

  if(!res.poseLandmarks) return;

  let s = normalize(res.poseLandmarks);
  let t = s; // simplified for stability

  let err = error(s,t);
  let score = 100 - err*100;

  scores.push(score);

  document.getElementById("accuracy").innerText=score.toFixed(1);
  document.getElementById("error").innerText=err.toFixed(3);
  document.getElementById("feedback").innerText = score>80 ? "🔥 Perfect" : "Improve";
  document.getElementById("avg").innerText =
    (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
}

// ================= SAVE =================
function finishSession(){

  let finalScore = scores[scores.length-1] || 0;

  db.collection("reports").add({
    user: auth.currentUser.email,
    score: finalScore
  });

  loadLeaderboard();
}

// ================= LEADERBOARD =================
async function loadLeaderboard(){

  let snap = await db.collection("reports")
  .orderBy("score","desc")
  .limit(5).get();

  let html="<h3>Leaderboard</h3>";

  snap.forEach(d=>{
    html+=`<p>${d.data().user} - ${d.data().score.toFixed(1)}</p>`;
  });

  document.getElementById("leaderboard").innerHTML=html;
}

// ================= PDF =================
function downloadPDF(){

  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  let final = scores[scores.length-1] || 0;
  let avg = (scores.reduce((a,b)=>a+b,0)/scores.length) || 0;

  doc.text("AI Dance Report",20,20);
  doc.text("User: "+auth.currentUser.email,20,40);
  doc.text("Score: "+final.toFixed(2),20,60);
  doc.text("Avg: "+avg.toFixed(2),20,80);

  doc.save("report.pdf");
}

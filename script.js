// ===============================
// 🔥 FIREBASE CONFIG
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===============================
// 🔐 LOGIN
// ===============================
async function login(){

  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;

  try{
    await auth.signInWithEmailAndPassword(email,password);
  }catch{
    await auth.createUserWithEmailAndPassword(email,password);
  }

  document.getElementById("loginBox").style.display="none";
  document.getElementById("app").style.display="block";
}

// ===============================
// 🎥 ELEMENTS
// ===============================
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const teacherVideo = document.getElementById("teacherVideo");

let teacherPoses = [];
let frameIndex = 0;
let scores = [];

// ===============================
// 🎬 VIDEO UPLOAD
// ===============================
document.getElementById("uploadVideo").onchange = (e)=>{
  teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

// ===============================
// 🧠 POSE
// ===============================
function getFullPose(res){
  return res.poseLandmarks || [];
}

// ===============================
// 📏 NORMALIZE
// ===============================
function normalize(p){
  if(!p || p.length<13) return p;

  let ls=p[11], rs=p[12];
  let cx=(ls.x+rs.x)/2;
  let cy=(ls.y+rs.y)/2;
  let scale=Math.hypot(ls.x-rs.x, ls.y-rs.y);

  return p.map(pt=>({x:(pt.x-cx)/scale,y:(pt.y-cy)/scale}));
}

// ===============================
// 📐 ERROR
// ===============================
function getError(a,b){
  let sum=0;
  for(let i=0;i<33;i++){
    let dx=a[i].x-b[i].x;
    let dy=a[i].y-b[i].y;
    sum+=Math.sqrt(dx*dx+dy*dy);
  }
  return sum/33;
}

// ===============================
// 🎯 FEEDBACK FIX
// ===============================
function detectMistakes(error){

  if(error < 0.05) return "🔥 Perfect";
  if(error < 0.1) return "👍 Good";
  if(error < 0.2) return "⚠ Improve posture";

  return "❌ Incorrect pose";
}

// ===============================
// 🎬 EXTRACT TEACHER
// ===============================
async function extractTeacher(){

  teacherPoses=[];

  return new Promise(resolve=>{
    const h=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`});

    h.setOptions({modelComplexity:0}); // 🔥 FAST

    h.onResults(r=>{
      if(r.poseLandmarks){
        teacherPoses.push(r.poseLandmarks);
      }
    });

    teacherVideo.onplay=async()=>{
      const c=document.createElement("canvas");
      const ctx=c.getContext("2d");

      async function loop(){
        if(teacherVideo.paused){resolve();return;}

        c.width=320;
        c.height=240;

        ctx.drawImage(teacherVideo,0,0,320,240);

        await h.send({image:c});
        requestAnimationFrame(loop);
      }
      loop();
    };

    teacherVideo.play();
  });
}

// ===============================
// 🚀 START
// ===============================
async function startTraining(){
  await extractTeacher();
  frameIndex=0;
  scores=[];
  startWebcam();
}

// ===============================
// 🎥 WEBCAM FIX (NO DELAY)
// ===============================
function startWebcam(){

  const h=new Holistic({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`
  });

  h.setOptions({
    modelComplexity:0,
    smoothLandmarks:true
  });

  h.onResults(onResults);

  const camera = new Camera(videoElement,{
    onFrame: async ()=>{
      await h.send({image:videoElement});
    },
    width:320,
    height:240
  });

  camera.start();
}

// ===============================
// ⚡ MAIN LOOP
// ===============================
function onResults(res){

  canvasCtx.drawImage(res.image,0,0,640,480);

  let s=normalize(res.poseLandmarks);
  let t=normalize(teacherPoses[frameIndex] || []);

  if(s && t){

    let error=getError(s,t);

    let score = Math.max(0,100 - error*120); // 🔥 FIXED SCALE

    scores.push(score);

    document.getElementById("accuracy").innerText=score.toFixed(1);
    document.getElementById("error").innerText=error.toFixed(3);
    document.getElementById("feedback").innerText=detectMistakes(error);

    frameIndex++;
  }
}

// ===============================
// 💾 SAVE REPORT
// ===============================
function finishSession(){

  let finalScore = scores[scores.length-1];

  db.collection("reports").add({
    user:auth.currentUser.email,
    score:finalScore
  });

  alert("Saved!");
  loadLeaderboard();
}

// ===============================
// 🏆 LEADERBOARD
// ===============================
async function loadLeaderboard(){

  let snapshot = await db.collection("reports")
  .orderBy("score","desc")
  .limit(5)
  .get();

  let html = "<h2>🏆 Leaderboard</h2>";

  snapshot.forEach(doc=>{
    let d = doc.data();
    html += `<p>${d.user} - ${d.score.toFixed(1)}</p>`;
  });

  document.getElementById("leaderboard").innerHTML = html;
}

// ===============================
// 📄 DOWNLOAD REPORT
// ===============================
function downloadReport(){

  let finalScore = scores[scores.length-1];

  let content = `
AI Dance Report

User: ${auth.currentUser.email}
Score: ${finalScore}
`;

  let blob = new Blob([content]);
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "report.txt";
  a.click();
}

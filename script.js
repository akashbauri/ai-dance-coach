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

// AUTO LOGIN
auth.onAuthStateChanged(user=>{
  if(user){
    document.getElementById("loginBox").style.display="none";
    document.getElementById("app").style.display="block";
    loadLeaderboard();
  }
});

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
// 🧠 POSE FUNCTIONS
// ===============================
function getFullPose(res){
  return [...(res.poseLandmarks||[]),
  ...(res.leftHandLandmarks||[]),
  ...(res.rightHandLandmarks||[])];
}

function normalize(p){
  if(p.length<13) return p;
  let ls=p[11], rs=p[12];
  let cx=(ls.x+rs.x)/2;
  let cy=(ls.y+rs.y)/2;
  let scale=Math.hypot(ls.x-rs.x, ls.y-rs.y);
  return p.map(pt=>({x:(pt.x-cx)/scale,y:(pt.y-cy)/scale}));
}

function getErrors(a,b){
  let e=[];
  for(let i=0;i<Math.min(a.length,b.length);i++){
    let dx=a[i].x-b[i].x;
    let dy=a[i].y-b[i].y;
    e.push(Math.sqrt(dx*dx+dy*dy));
  }
  return e;
}

// ===============================
// 🔴 DRAW JOINTS
// ===============================
function drawErrors(res, errors){
  for(let i=0;i<res.poseLandmarks.length;i++){
    let err = errors[i]||0;
    let color = err>0.05 ? "red":"green";
    drawLandmarks(canvasCtx,[res.poseLandmarks[i]],{color:color,lineWidth:5});
  }
}

// ===============================
// 🎯 FEEDBACK
// ===============================
function detectMistakes(errors){

  function avg(a){return a.reduce((x,y)=>x+y,0)/a.length;}

  let leftArm = avg([errors[11],errors[13],errors[15]]);
  let rightArm = avg([errors[12],errors[14],errors[16]]);

  if(leftArm>0.05) return "Fix LEFT arm";
  if(rightArm>0.05) return "Fix RIGHT arm";

  return "Perfect";
}

// ===============================
// 🎬 EXTRACT TEACHER
// ===============================
async function extractTeacher(){

  teacherPoses=[];

  return new Promise(resolve=>{
    const h=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`});

    h.onResults(r=>{
      let p=getFullPose(r);
      if(p.length>0) teacherPoses.push(p);
    });

    teacherVideo.onplay=async()=>{
      const c=document.createElement("canvas");
      const ctx=c.getContext("2d");

      async function loop(){
        if(teacherVideo.paused){resolve();return;}
        c.width=teacherVideo.videoWidth;
        c.height=teacherVideo.videoHeight;
        ctx.drawImage(teacherVideo,0,0);
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
// 🎥 WEBCAM
// ===============================
function startWebcam(){
  const h=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`});
  h.onResults(onResults);

  new Camera(videoElement,{
    onFrame: async ()=>await h.send({image:videoElement}),
    width:640,height:480
  }).start();
}

// ===============================
// ⚡ MAIN LOOP
// ===============================
function onResults(res){

  canvasCtx.drawImage(res.image,0,0,640,480);

  let s=normalize(getFullPose(res));
  let t=normalize(teacherPoses[frameIndex]||[]);

  if(s.length>0 && t.length>0){

    let errors=getErrors(s,t);
    let total=errors.reduce((a,b)=>a+b,0)/errors.length;

    let score=Math.max(0,100-total*150);
    scores.push(score);

    document.getElementById("accuracy").innerText=score.toFixed(1);
    document.getElementById("error").innerText=total.toFixed(3);
    document.getElementById("feedback").innerText=detectMistakes(errors);

    drawErrors(res,errors);

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

// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ================= DOM =================
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const loginBox = document.getElementById("loginBox");
const app = document.getElementById("app");

const teacherVideo = document.getElementById("teacherVideo");
const video = document.querySelector(".input_video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const accuracy = document.getElementById("accuracy");
const error = document.getElementById("error");
const feedbackText = document.getElementById("feedback");

// ================= LOGIN =================
async function login(){
  let email = emailInput.value;
  let pass = passwordInput.value;

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
    loginBox.style.display="none";
    app.style.display="block";
    initChart();
  }
});

// ================= VIDEO =================
document.getElementById("uploadVideo").onchange = e=>{
  teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

// ================= POSE =================
function getFullPose(r){
  return r.poseLandmarks || [];
}

function normalize(p){
  let ls=p[11], rs=p[12];
  let cx=(ls.x+rs.x)/2;
  let cy=(ls.y+rs.y)/2;
  let scale=Math.hypot(ls.x-rs.x, ls.y-rs.y);

  return p.map(pt=>({x:(pt.x-cx)/scale,y:(pt.y-cy)/scale}));
}

function getError(a,b){
  let sum=0;
  for(let i=0;i<33;i++){
    let dx=a[i].x-b[i].x;
    let dy=a[i].y-b[i].y;
    sum+=Math.sqrt(dx*dx+dy*dy);
  }
  return sum/33;
}

// ================= SMOOTH =================
let prevPose=null;

function smooth(p){
  if(!prevPose){ prevPose=p; return p; }

  let sm=p.map((pt,i)=>({
    x: prevPose[i].x*0.7 + pt.x*0.3,
    y: prevPose[i].y*0.7 + pt.y*0.3
  }));

  prevPose=sm;
  return sm;
}

// ================= GLOBAL =================
let teacherPoses=[];
let scores=[];

// ================= EXTRACT =================
async function extractTeacher(){

  teacherPoses=[];

  return new Promise(resolve=>{

    const h=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`});

    h.onResults(r=>{
      if(r.poseLandmarks){
        teacherPoses.push(r.poseLandmarks);
      }
    });

    teacherVideo.onplay=()=>{
      const c=document.createElement("canvas");
      const cx=c.getContext("2d");

      function loop(){
        if(teacherVideo.paused){resolve();return;}
        cx.drawImage(teacherVideo,0,0,320,240);
        h.send({image:c});
        requestAnimationFrame(loop);
      }
      loop();
    };

    teacherVideo.play();
  });
}

// ================= START =================
async function startTraining(){
  await extractTeacher();
  startCamera();
}

// ================= CAMERA =================
function startCamera(){

  navigator.mediaDevices.getUserMedia({video:true})
  .then(stream=>{
    video.srcObject=stream;
  });

  const h=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`});

  h.onResults(onResults);

  new Camera(video,{
    onFrame: async()=>await h.send({image:video})
  }).start();
}

// ================= MAIN =================
function onResults(r){

  ctx.drawImage(r.image,0,0,640,480);

  if(!r.poseLandmarks) return;

  let user = smooth(normalize(getFullPose(r)));

  let frame = Math.floor(teacherVideo.currentTime * 30);
  let teacher = normalize(teacherPoses[frame] || []);

  if(!teacher.length) return;

  let err = getError(user,teacher);
  let score = 100 - err*100;

  scores.push(score);

  // draw skeleton
  drawConnectors(ctx, r.poseLandmarks, POSE_CONNECTIONS);
  drawLandmarks(ctx, r.poseLandmarks);

  accuracy.innerText = score.toFixed(1);
  error.innerText = err.toFixed(3);
  feedbackText.innerText = score>80?"Good":"Improve";

  updateChart(score);
}

// ================= CHART =================
let chart;

function initChart(){
  chart = new Chart(document.getElementById("chart"),{
    type:"line",
    data:{labels:[],datasets:[{data:[]}]}
  });
}

function updateChart(score){
  chart.data.labels.push(chart.data.labels.length);
  chart.data.datasets[0].data.push(score);
  chart.update();
}

// ================= SAVE =================
function finishSession(){
  let final = scores[scores.length-1];

  db.collection("reports").add({
    user: auth.currentUser.email,
    score: final
  });
}

// ================= PDF =================
function downloadPDF(){
  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  let final = scores[scores.length-1] || 0;

  doc.text("AI Dance Report",20,20);
  doc.text("Score: "+final.toFixed(2),20,40);

  doc.save("report.pdf");
}

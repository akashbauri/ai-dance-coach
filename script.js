// ===============================
// 🔥 FIREBASE CONFIG
// ===============================
const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===============================
// 🔐 LOGIN
// ===============================
async function login(){
  let email = prompt("Enter Email");
  let password = "123456";

  try{
    await auth.signInWithEmailAndPassword(email,password);
  }catch{
    await auth.createUserWithEmailAndPassword(email,password);
  }
}

// ===============================
// 🎤 VOICE SYSTEM
// ===============================
function speak(text){
  const speech = new SpeechSynthesisUtterance(text);
  speech.rate = 1;
  speech.pitch = 1;
  window.speechSynthesis.speak(speech);
}

// ===============================
// 🎥 ELEMENTS
// ===============================
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const teacherVideo = document.getElementById("teacherVideo");

const accuracyText = document.getElementById("accuracy");
const errorText = document.getElementById("error");
const feedbackText = document.getElementById("feedback");
const latencyText = document.getElementById("latency");

// ===============================
// 📊 CHART
// ===============================
const ctxChart = document.getElementById('chart').getContext('2d');

let chart = new Chart(ctxChart,{
  type:'line',
  data:{labels:[],datasets:[{label:'Accuracy',data:[]}]},
  options:{animation:false,scales:{y:{min:0,max:100}}}
});

// ===============================
let teacherPoses = [];
let frameIndex = 0;
let scores = [];
let movements = [];

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
// 🎯 FEEDBACK + VOICE
// ===============================
let lastVoiceTime = 0;

function detectMistakes(errors){

  function avg(a){return a.reduce((x,y)=>x+y,0)/a.length;}

  let leftArm = avg([errors[11],errors[13],errors[15]]);
  let rightArm = avg([errors[12],errors[14],errors[16]]);
  let posture = avg([errors[11],errors[12]]);

  let msg = "";

  if(leftArm>0.05) msg="Raise your left arm";
  else if(rightArm>0.05) msg="Adjust your right arm";
  else if(posture>0.04) msg="Stand straight";
  else msg="Perfect";

  // 🎤 SPEAK (every 3 sec)
  if(Date.now() - lastVoiceTime > 3000){
    speak(msg);
    lastVoiceTime = Date.now();
  }

  return msg;
}

// ===============================
// 🧠 DANCE STYLE DETECTION
// ===============================
function detectStyle(speed){

  if(speed > 0.08) return "🔥 Energetic";
  if(speed > 0.04) return "💃 Medium";
  return "🧘 Slow";
}

// ===============================
// 🧠 ADAPTIVE SCORE
// ===============================
function adaptiveScore(score){
  let avg = scores.reduce((a,b)=>a+b,0)/scores.length || score;
  return score*0.7 + avg*0.3;
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
  movements=[];
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

    let score=adaptiveScore(Math.max(0,100-total*150));
    scores.push(score);

    // movement speed
    movements.push(total);

    let style = detectStyle(total);

    accuracyText.innerText = score.toFixed(1)+"%";
    errorText.innerText = total.toFixed(3);
    feedbackText.innerText = detectMistakes(errors) + " | " + style;

    drawErrors(res,errors);

    chart.data.labels.push(frameIndex);
    chart.data.datasets[0].data.push(score);
    chart.update();

    frameIndex++;
  }
}

// ===============================
// 💾 SAVE + LEADERBOARD
// ===============================
function finishSession(){

  let finalScore = scores[scores.length-1];

  db.collection("reports").add({
    user:auth.currentUser.email,
    score:finalScore
  });

  alert("Saved!");
}

// ===============================
// 🏆 GET LEADERBOARD
// ===============================
async function loadLeaderboard(){

  let snapshot = await db.collection("reports")
  .orderBy("score","desc")
  .limit(5)
  .get();

  snapshot.forEach(doc=>{
    console.log(doc.data());
  });
}

// ===============================
// 📄 DOWNLOAD
// ===============================
function downloadReport(){

  let txt = "Final Score: "+scores[scores.length-1];

  let blob=new Blob([txt]);
  let a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="report.txt";
  a.click();
}

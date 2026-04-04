// ===============================
// 🔥 1. FIREBASE CONFIG
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
// 🔐 2. LOGIN SYSTEM
// ===============================
async function login(){
  let email = prompt("Enter Email");
  let password = "123456";

  try{
    await auth.signInWithEmailAndPassword(email,password);
  }catch{
    await auth.createUserWithEmailAndPassword(email,password);
  }

  alert("Login Success");
}

// ===============================
// 🎥 3. ELEMENTS
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
// 📊 4. CHART SETUP
// ===============================
const ctxChart = document.getElementById('chart').getContext('2d');

let chart = new Chart(ctxChart,{
  type:'line',
  data:{
    labels:[],
    datasets:[{
      label:'Accuracy',
      data:[],
      borderWidth:2
    }]
  },
  options:{
    responsive:true,
    animation:false,
    scales:{
      y:{ min:0, max:100 }
    }
  }
});

// ===============================
// 📦 5. GLOBAL VARIABLES
// ===============================
let teacherPoses = [];
let frameIndex = 0;
let scores = [];
let startTime = 0;

// ===============================
// 🎬 6. VIDEO UPLOAD
// ===============================
document.getElementById("uploadVideo").onchange = (e)=>{
  teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

// ===============================
// 🧠 7. GET FULL BODY (500+)
// ===============================
function getFullPose(res){
  return [
    ...(res.poseLandmarks || []),
    ...(res.leftHandLandmarks || []),
    ...(res.rightHandLandmarks || [])
  ];
}

// ===============================
// 📏 8. NORMALIZATION
// ===============================
function normalize(pose){
  if(pose.length < 13) return pose;

  let ls = pose[11], rs = pose[12];
  let cx = (ls.x + rs.x)/2;
  let cy = (ls.y + rs.y)/2;
  let scale = Math.hypot(ls.x-rs.x, ls.y-rs.y);

  return pose.map(p=>({
    x:(p.x-cx)/scale,
    y:(p.y-cy)/scale
  }));
}

// ===============================
// 📐 9. ERROR PER JOINT
// ===============================
function getJointErrors(p1, p2){
  let errors = [];
  let len = Math.min(p1.length, p2.length);

  for(let i=0;i<len;i++){
    let dx = p1[i].x - p2[i].x;
    let dy = p1[i].y - p2[i].y;
    errors.push(Math.sqrt(dx*dx + dy*dy));
  }

  return errors;
}

// ===============================
// 🔴 10. DRAW ERROR JOINTS
// ===============================
function drawErrorJoints(res, errors){
  if(!res.poseLandmarks) return;

  for(let i=0;i<res.poseLandmarks.length;i++){
    let err = errors[i] || 0;
    let color = err > 0.05 ? "red" : "green";

    drawLandmarks(canvasCtx,[res.poseLandmarks[i]],{
      color: color,
      lineWidth: 5
    });
  }
}

// ===============================
// 🧠 11. SMART FEEDBACK
// ===============================
function detectMistakes(errors){

  function avg(arr){ return arr.reduce((a,b)=>a+b,0)/arr.length; }

  let feedback = [];

  let leftArm = avg([errors[11], errors[13], errors[15]]);
  let rightArm = avg([errors[12], errors[14], errors[16]]);
  let leftLeg = avg([errors[23], errors[25], errors[27]]);
  let rightLeg = avg([errors[24], errors[26], errors[28]]);
  let posture = avg([errors[11], errors[12]]);

  if(leftArm > 0.05) feedback.push("Fix LEFT arm");
  if(rightArm > 0.05) feedback.push("Fix RIGHT arm");
  if(leftLeg > 0.05) feedback.push("Fix LEFT leg");
  if(rightLeg > 0.05) feedback.push("Fix RIGHT leg");
  if(posture > 0.04) feedback.push("Straighten posture");

  if(feedback.length === 0){
    return "🔥 Perfect!";
  }

  return feedback.join(" | ");
}

// ===============================
// 🧠 12. AI LEARNING (ADAPTIVE)
// ===============================
function adaptiveScore(score){
  let avg = scores.reduce((a,b)=>a+b,0)/scores.length || score;
  return score*0.7 + avg*0.3;
}

// ===============================
// 🎬 13. EXTRACT TEACHER POSES
// ===============================
async function extractTeacher(){

  teacherPoses = [];

  return new Promise(resolve=>{

    const holistic = new Holistic({
      locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`
    });

    holistic.setOptions({modelComplexity:1});

    holistic.onResults(res=>{
      let pose = getFullPose(res);
      if(pose.length>0){
        teacherPoses.push(pose);
      }
    });

    teacherVideo.onplay = async ()=>{

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      async function process(){

        if(teacherVideo.paused || teacherVideo.ended){
          resolve();
          return;
        }

        canvas.width = teacherVideo.videoWidth;
        canvas.height = teacherVideo.videoHeight;

        ctx.drawImage(teacherVideo,0,0);

        await holistic.send({image:canvas});
        requestAnimationFrame(process);
      }

      process();
    };

    teacherVideo.play();
  });
}

// ===============================
// 🚀 14. START TRAINING
// ===============================
async function startTraining(){
  feedbackText.innerText = "Processing teacher...";
  await extractTeacher();
  feedbackText.innerText = "Start dancing!";
  frameIndex = 0;
  scores = [];
  chart.data.labels = [];
  chart.data.datasets[0].data = [];
  chart.update();
  startWebcam();
}

// ===============================
// 🎥 15. WEBCAM START
// ===============================
function startWebcam(){

  const holistic = new Holistic({
    locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`
  });

  holistic.setOptions({
    modelComplexity:1,
    smoothLandmarks:true
  });

  holistic.onResults(onResults);

  const camera = new Camera(videoElement,{
    onFrame: async ()=>{
      startTime = performance.now();
      await holistic.send({image:videoElement});
    },
    width:640,
    height:480
  });

  camera.start();
}

// ===============================
// ⚡ 16. MAIN AI LOOP
// ===============================
function onResults(res){

  canvasCtx.clearRect(0,0,640,480);
  canvasCtx.drawImage(res.image,0,0,640,480);

  let student = normalize(getFullPose(res));
  let teacher = normalize(teacherPoses[Math.min(frameIndex, teacherPoses.length-1)] || []);

  if(student.length>0 && teacher.length>0){

    let errors = getJointErrors(student, teacher);
    let totalError = errors.reduce((a,b)=>a+b,0)/errors.length;

    let rawScore = Math.max(0,100 - totalError*150);
    let score = adaptiveScore(rawScore);

    scores.push(score);

    // UI UPDATE
    accuracyText.innerText = score.toFixed(1) + "%";
    errorText.innerText = totalError.toFixed(4);
    feedbackText.innerText = detectMistakes(errors);

    // 🔴 VISUAL ERROR
    drawErrorJoints(res, errors);

    // 📊 GRAPH UPDATE
    chart.data.labels.push(frameIndex);
    chart.data.datasets[0].data.push(score);
    chart.update();

    frameIndex++;

    // LATENCY
    let latency = performance.now() - startTime;
    latencyText.innerText = latency.toFixed(0) + " ms";
  }
}

// ===============================
// 💾 17. SAVE REPORT
// ===============================
function finishSession(){

  db.collection("reports").add({
    user: auth.currentUser.email,
    scores: scores,
    finalScore: scores[scores.length-1],
    timestamp: new Date()
  });

  alert("Report Saved!");
}

// ===============================
// 📄 18. DOWNLOAD REPORT
// ===============================
function downloadReport(){

  let content = `
AI Dance Report

Final Score: ${scores[scores.length-1]}
All Scores: ${scores.join(", ")}
`;

  let blob = new Blob([content],{type:"text/plain"});
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "report.txt";
  a.click();
}

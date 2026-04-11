const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const teacherVideo = document.getElementById("teacherVideo");

const accuracyText = document.getElementById("accuracy");
const errorText = document.getElementById("error");
const feedbackText = document.getElementById("feedback");
const bar = document.getElementById("bar");

let teacherPoses = [];
let frameIndex = 0;
let scores = [];

//////////////////////////////
// LOAD TEACHER VIDEO
document.getElementById("uploadVideo").onchange = (e)=>{
  teacherVideo.src = URL.createObjectURL(e.target.files[0]);
  extractTeacher();
};

//////////////////////////////
// NORMALIZE
function normalize(p){
  let ls=p[11], rs=p[12];
  let cx=(ls.x+rs.x)/2;
  let cy=(ls.y+rs.y)/2;
  let scale=Math.hypot(ls.x-rs.x, ls.y-rs.y);

  return p.map(x=>({x:(x.x-cx)/scale,y:(x.y-cy)/scale}));
}

//////////////////////////////
// DISTANCE
function dist(p1,p2){
  let sum=0;
  for(let i=0;i<p1.length;i++){
    let dx=p1[i].x-p2[i].x;
    let dy=p1[i].y-p2[i].y;
    let d=Math.sqrt(dx*dx+dy*dy);

    let w=(i<11)?1:(i<23)?2:3;
    sum+=d*w;
  }
  return sum/p1.length;
}

//////////////////////////////
// SMOOTH SCORE
function smoothScore(newScore){
  scores.push(newScore);
  let last = scores.slice(-10);
  return last.reduce((a,b)=>a+b,0)/last.length;
}

//////////////////////////////
// FEEDBACK
function getFeedback(score){
  if(score > 90) return "🔥 Perfect!";
  if(score > 75) return "👍 Good! Adjust arms slightly";
  if(score > 60) return "⚠ Fix posture";
  return "❌ Incorrect pose";
}

//////////////////////////////
// EXTRACT TEACHER POSES
async function extractTeacher(){

  teacherPoses=[];

  const pose = new Pose({
    locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
  });

  pose.onResults(r=>{
    if(r.poseLandmarks){
      teacherPoses.push(normalize(r.poseLandmarks));
    }
  });

  teacherVideo.onplay=async()=>{
    const canvas=document.createElement("canvas");
    const ctx=canvas.getContext("2d");

    async function loop(){
      if(teacherVideo.paused||teacherVideo.ended) return;

      canvas.width=teacherVideo.videoWidth;
      canvas.height=teacherVideo.videoHeight;

      ctx.drawImage(teacherVideo,0,0);

      await pose.send({image:canvas});
      requestAnimationFrame(loop);
    }
    loop();
  };

  teacherVideo.play();
}

//////////////////////////////
// MAIN AI LOOP
function onResults(results){

  canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
  canvasCtx.drawImage(results.image,0,0,canvasElement.width,canvasElement.height);

  if(!results.poseLandmarks || teacherPoses.length===0) return;

  let student = normalize(results.poseLandmarks);
  let teacher = teacherPoses[Math.min(frameIndex, teacherPoses.length-1)];

  let error = dist(student, teacher);
  let rawScore = Math.max(0,100-error*180);

  let score = smoothScore(rawScore);

  // UI UPDATE
  accuracyText.innerText = "Accuracy: " + score.toFixed(1) + "%";
  errorText.innerText = "Error: " + error.toFixed(4);
  feedbackText.innerText = getFeedback(score);

  // PROGRESS BAR
  bar.style.width = score + "%";

  // GLOW EFFECT
  if(score > 85){
    canvasElement.style.boxShadow = "0 0 20px #22c55e";
  } else {
    canvasElement.style.boxShadow = "none";
  }

  /////////////////////////////
  // DRAW SKELETON
  drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,{
    color:"#00FFAA",
    lineWidth:3
  });

  /////////////////////////////
  // RED/GREEN JOINTS
  for(let i=0;i<results.poseLandmarks.length;i++){

    let dx=student[i].x-teacher[i].x;
    let dy=student[i].y-teacher[i].y;
    let d=Math.sqrt(dx*dx+dy*dy);

    let color = d>0.05 ? "red" : "green";

    drawLandmarks(canvasCtx,[results.poseLandmarks[i]],{
      color: color,
      lineWidth:5
    });
  }

  frameIndex++;
}

//////////////////////////////
// CAMERA AUTO START
const pose = new Pose({
  locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
});

pose.setOptions({
  modelComplexity:1,
  smoothLandmarks:true
});

pose.onResults(onResults);

const camera = new Camera(videoElement,{
  onFrame: async ()=>{
    await pose.send({image:videoElement});
  },
  width:640,
  height:480
});

camera.start();

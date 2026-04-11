const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const teacherVideo = document.getElementById("teacherVideo");

let teacherPoses = [];
let studentIndex = 0;

//////////////////////////////
// LOAD VIDEO
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
// EXTRACT TEACHER
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
// MAIN AI
function onResults(results){

  canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
  canvasCtx.drawImage(results.image,0,0,canvasElement.width,canvasElement.height);

  if(!results.poseLandmarks || teacherPoses.length===0) return;

  let student = normalize(results.poseLandmarks);

  let teacher = teacherPoses[Math.min(studentIndex, teacherPoses.length-1)];

  let error = dist(student, teacher);
  let score = Math.max(0,100-error*180);

  document.getElementById("accuracy").innerText = score.toFixed(1)+"%";

  //////////////////////////////
  // DRAW SKELETON
  drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,{
    color:"#00FFAA",
    lineWidth:3
  });

  //////////////////////////////
  // RED GREEN JOINTS
  for(let i=0;i<results.poseLandmarks.length;i++){

    let dx = student[i].x - teacher[i].x;
    let dy = student[i].y - teacher[i].y;
    let d = Math.sqrt(dx*dx + dy*dy);

    let color = d > 0.05 ? "red" : "green";

    drawLandmarks(canvasCtx, [results.poseLandmarks[i]],{
      color: color,
      lineWidth:5
    });
  }

  studentIndex++;
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

//////////////////////////////
// FINISH
function finishSession(){
  alert("Session Completed!");
}

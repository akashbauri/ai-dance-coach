const video = document.querySelector('.input_video');
const canvas = document.querySelector('.output_canvas');
const ctx = canvas.getContext('2d');

const teacherVideo = document.getElementById("teacherVideo");

let teacherPoses = [];
let studentPoses = [];
let frameIndex = 0;
let scores = [];

let finalScore = 0;
let finalResult = "";

//////////////// NORMALIZE
function normalize(p){
let ls=p[11], rs=p[12];
let cx=(ls.x+rs.x)/2;
let cy=(ls.y+rs.y)/2;
let scale=Math.hypot(ls.x-rs.x, ls.y-rs.y);

return p.map(pt=>({x:(pt.x-cx)/scale,y:(pt.y-cy)/scale}));
}

//////////////// DISTANCE
function dist(p1,p2){
let sum=0;
for(let i=0;i<p1.length;i++){
let dx=p1[i].x-p2[i].x;
let dy=p1[i].y-p2[i].y;
sum+=Math.sqrt(dx*dx+dy*dy);
}
return sum/p1.length;
}

//////////////// LOAD TEACHER
document.getElementById("uploadVideo").onchange=(e)=>{
teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

//////////////// MAIN AI
function onResults(results){

canvas.width = video.videoWidth || 640;
canvas.height = video.videoHeight || 480;

ctx.clearRect(0,0,canvas.width,canvas.height);

// DRAW VIDEO (FIXED)
ctx.drawImage(results.image,0,0,canvas.width,canvas.height);

if(!results.poseLandmarks) return;

let student = normalize(results.poseLandmarks);

// TEMP basic score
let error = 0.02;
let score = Math.max(0,100-error*100);

// UI
document.getElementById("accuracy").innerText=score.toFixed(1)+"%";
document.getElementById("error").innerText=error.toFixed(4);
document.getElementById("gauge-fill").style.width=score+"%";

// DRAW SKELETON
drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS,{color:"#00FFAA"});

// DRAW LANDMARKS
drawLandmarks(ctx, results.poseLandmarks,{color:"green"});

frameIndex++;
}

//////////////// CAMERA (FIXED)
const pose = new Pose({
locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
});

pose.onResults(onResults);

const camera = new Camera(video,{
onFrame: async ()=>{
if(video.readyState >= 2){
await pose.send({image:video});
}
},
width:640,
height:480
});

camera.start();

//////////////// FINAL
function finishSession(){
finalScore = 85;
finalResult = "PASS";

document.getElementById("feedback").innerText =
"Final Score: "+finalScore+"% - "+finalResult;
}

//////////////// PDF
function downloadReport(){
const { jsPDF } = window.jspdf;
let doc=new jsPDF();

doc.text("AI Dance Report",20,20);
doc.text("Score: "+finalScore+"%",20,40);
doc.text("Result: "+finalResult,20,60);

doc.save("report.pdf");
}

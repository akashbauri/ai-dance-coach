const video = document.querySelector('.input_video');
const canvas = document.querySelector('.output_canvas');
const ctx = canvas.getContext('2d');

canvas.width = 640;
canvas.height = 480;

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
let w=(i<11)?1:(i<23)?2:3;
sum+=Math.sqrt(dx*dx+dy*dy)*w;
}
return sum/p1.length;
}

//////////////// EXTRACT TEACHER
document.getElementById("uploadVideo").onchange=(e)=>{
teacherVideo.src = URL.createObjectURL(e.target.files[0]);
extractTeacher();
};

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
const c=document.createElement("canvas");
const ctx2=c.getContext("2d");

async function loop(){
if(teacherVideo.paused||teacherVideo.ended) return;

c.width=teacherVideo.videoWidth;
c.height=teacherVideo.videoHeight;

ctx2.drawImage(teacherVideo,0,0);
await pose.send({image:c});

requestAnimationFrame(loop);
}
loop();
};

teacherVideo.play();
}

//////////////// SMOOTH
function smooth(s){
scores.push(s);
let last=scores.slice(-8);
return last.reduce((a,b)=>a+b,0)/last.length;
}

//////////////// MAIN LOOP
function onResults(results){

ctx.clearRect(0,0,canvas.width,canvas.height);
ctx.drawImage(results.image,0,0,canvas.width,canvas.height);

if(!results.poseLandmarks || teacherPoses.length===0) return;

let student = normalize(results.poseLandmarks);
let teacher = teacherPoses[Math.min(frameIndex, teacherPoses.length-1)];

studentPoses.push(student);

let error = dist(student,teacher);
let score = smooth(Math.max(0,100-error*120));

document.getElementById("accuracy").innerText=score.toFixed(1)+"%";
document.getElementById("error").innerText=error.toFixed(4);
document.getElementById("gauge-fill").style.width=score+"%";

drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS,{color:"#00FFAA"});

for(let i=0;i<results.poseLandmarks.length;i++){
let dx=student[i].x-teacher[i].x;
let dy=student[i].y-teacher[i].y;
let d=Math.sqrt(dx*dx+dy*dy);

drawLandmarks(ctx,[results.poseLandmarks[i]],{
color: d>0.05?"red":"green",
lineWidth:5
});
}

frameIndex++;
}

//////////////// CAMERA (FIXED)
const pose = new Pose({
locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
});

pose.onResults(onResults);

const camera = new Camera(video,{
onFrame: async ()=>{
await pose.send({image:video});
},
width:640,
height:480
});

camera.start();

//////////////// FINAL
function finishSession(){
finalScore = scores.reduce((a,b)=>a+b,0)/scores.length;
finalResult = finalScore>75?"PASS":"FAIL";

document.getElementById("feedback").innerText =
"Final Score: "+finalScore.toFixed(1)+"% - "+finalResult;
}

//////////////// PDF
function downloadReport(){
const { jsPDF } = window.jspdf;
let doc=new jsPDF();

doc.text("AI Dance Report",20,20);
doc.text("Score: "+finalScore.toFixed(1)+"%",20,40);
doc.text("Result: "+finalResult,20,60);

doc.save("report.pdf");
}

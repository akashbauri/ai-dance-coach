// 🔥 Firebase Config
const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// LOGIN
async function login(){
let email = prompt("Enter Email");
let password = "123456";
try{
await auth.signInWithEmailAndPassword(email,password);
}catch{
await auth.createUserWithEmailAndPassword(email,password);
}
}

// ELEMENTS
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

let teacherPoses = [];
let frameIndex = 0;
let scores = [];

// GRAPH
const ctxChart = document.getElementById('chart').getContext('2d');
let chart = new Chart(ctxChart,{
type:'line',
data:{labels:[],datasets:[{label:'Accuracy',data:[]}]}
});

// FULL POSE
function getFullPose(res){
return [...(res.poseLandmarks||[]),
...(res.leftHandLandmarks||[]),
...(res.rightHandLandmarks||[])];
}

// NORMALIZE
function normalize(p){
if(p.length<13) return p;
let ls=p[11], rs=p[12];
let cx=(ls.x+rs.x)/2;
let cy=(ls.y+rs.y)/2;
let scale=Math.hypot(ls.x-rs.x, ls.y-rs.y);
return p.map(pt=>({x:(pt.x-cx)/scale,y:(pt.y-cy)/scale}));
}

// ERROR PER JOINT
function getErrors(a,b){
let e=[];
for(let i=0;i<Math.min(a.length,b.length);i++){
let dx=a[i].x-b[i].x;
let dy=a[i].y-b[i].y;
e.push(Math.sqrt(dx*dx+dy*dy));
}
return e;
}

// 🔴 DRAW JOINTS
function drawErrors(res, errors){
for(let i=0;i<res.poseLandmarks.length;i++){
let err = errors[i] || 0;
let color = err>0.05 ? "red" : "green";
drawLandmarks(canvasCtx,[res.poseLandmarks[i]],{color:color,lineWidth:5});
}
}

// 🧠 AI LEARNING (simple smoothing)
function adaptiveScore(score){
let avg = scores.reduce((a,b)=>a+b,0)/scores.length || score;
return (score*0.7 + avg*0.3);
}

// START
async function startTraining(){
await extractTeacher();
startWebcam();
}

// EXTRACT TEACHER
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

// WEBCAM
function startWebcam(){
const h=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`});
h.onResults(onResults);
new Camera(videoElement,{
onFrame: async ()=>await h.send({image:videoElement}),
width:640,height:480
}).start();
}

// MAIN AI LOOP
function onResults(res){
canvasCtx.clearRect(0,0,640,480);
canvasCtx.drawImage(res.image,0,0,640,480);

let s=normalize(getFullPose(res));
let t=normalize(teacherPoses[frameIndex]||[]);

if(s.length>0 && t.length>0){
let errors=getErrors(s,t);
let total=errors.reduce((a,b)=>a+b,0)/errors.length;
let score=adaptiveScore(Math.max(0,100-total*150));

scores.push(score);

document.getElementById("accuracy").innerText=score.toFixed(1)+"%";
document.getElementById("error").innerText=total.toFixed(3);

drawErrors(res, errors);

// GRAPH UPDATE
chart.data.labels.push(frameIndex);
chart.data.datasets[0].data.push(score);
chart.update();

frameIndex++;
}
}

// SAVE
function finishSession(){
db.collection("reports").add({
user:auth.currentUser.email,
scores:scores,
final:scores[scores.length-1]
});
alert("Saved!");
}

// DOWNLOAD
function downloadReport(){
let txt="Scores:\n"+scores.join(",");
let blob=new Blob([txt]);
let a=document.createElement("a");
a.href=URL.createObjectURL(blob);
a.download="report.txt";
a.click();
}

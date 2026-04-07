// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// LOGIN
async function login(){
  let email = emailInput.value;
  let pass = password.value;

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

// AUTO LOGIN
auth.onAuthStateChanged(user=>{
  if(user){
    loginBox.style.display="none";
    app.style.display="block";
    loadLeaderboard();
  }
});

// VIDEO
uploadVideo.onchange = e=>{
  let file=e.target.files[0];

  if(file.size > 30*1024*1024){
    alert("Max 30MB only");
    return;
  }

  teacherVideo.src = URL.createObjectURL(file);
};

let teacherPoses=[], scores=[], frameIndex=0;

// NORMALIZE
function normalize(p){
  let ls=p[11], rs=p[12];
  let cx=(ls.x+rs.x)/2;
  let cy=(ls.y+rs.y)/2;
  let scale=Math.hypot(ls.x-rs.x, ls.y-rs.y);

  return p.map(pt=>({x:(pt.x-cx)/scale,y:(pt.y-cy)/scale}));
}

// ERROR
function getError(a,b){
  let sum=0;
  for(let i=0;i<33;i++){
    let dx=a[i].x-b[i].x;
    let dy=a[i].y-b[i].y;
    sum+=Math.sqrt(dx*dx+dy*dy);
  }
  return sum/33;
}

// FEEDBACK
function feedback(e){
  if(e<0.05) return "🔥 Perfect";
  if(e<0.1) return "👍 Good";
  return "⚠ Improve";
}

// EXTRACT TEACHER
async function extractTeacher(){
  teacherPoses=[];

  return new Promise(resolve=>{
    const h=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`});

    h.onResults(r=>{
      if(r.poseLandmarks) teacherPoses.push(r.poseLandmarks);
    });

    teacherVideo.onplay=async()=>{
      const c=document.createElement("canvas");
      const ctx=c.getContext("2d");

      async function loop(){
        if(teacherVideo.paused){resolve();return;}
        ctx.drawImage(teacherVideo,0,0,320,240);
        await h.send({image:c});
        requestAnimationFrame(loop);
      }
      loop();
    };

    teacherVideo.play();
  });
}

// START
async function startTraining(){
  await extractTeacher();
  frameIndex=0;
  scores=[];
  startWebcam();
}

// WEBCAM
function startWebcam(){
  const h=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`});
  h.onResults(onResults);

  new Camera(input_video,{
    onFrame: async ()=>await h.send({image:input_video}),
    width:320,height:240
  }).start();
}

// LOOP
function onResults(res){

  output_canvas.getContext("2d").drawImage(res.image,0,0,640,480);

  let s=normalize(res.poseLandmarks);
  let t=normalize(teacherPoses[frameIndex]||[]);

  if(s && t){

    let err=getError(s,t);
    let score=Math.max(0,100-err*120);

    scores.push(score);

    accuracy.innerText=score.toFixed(1);
    error.innerText=err.toFixed(3);
    feedback.innerText=feedback(err);

    avg.innerText=(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);

    frameIndex++;
  }
}

// SAVE
function finishSession(){
  let finalScore=scores[scores.length-1];

  db.collection("reports").add({
    user:auth.currentUser.email,
    score:finalScore
  });

  loadLeaderboard();
}

// LEADERBOARD
async function loadLeaderboard(){
  let snap=await db.collection("reports")
  .orderBy("score","desc")
  .limit(5).get();

  let html="<h2>🏆 Leaderboard</h2>";
  snap.forEach(d=>{
    html+=`<p>${d.data().user} - ${d.data().score.toFixed(1)}</p>`;
  });

  leaderboard.innerHTML=html;
}

// PDF REPORT
function downloadPDF(){

  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  let finalScore=scores[scores.length-1];
  let avgScore=(scores.reduce((a,b)=>a+b,0)/scores.length);

  doc.text("AI Dance Report",20,20);
  doc.text("User: "+auth.currentUser.email,20,40);
  doc.text("Final Score: "+finalScore.toFixed(2),20,60);
  doc.text("Average Score: "+avgScore.toFixed(2),20,80);

  doc.save("Dance_Report.pdf");
}

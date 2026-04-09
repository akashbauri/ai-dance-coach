console.log("APP LOADED");

// FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// LOGIN
loginBtn.onclick = async ()=>{
  let email = email.value;
  let pass = password.value;

  try{
    await auth.signInWithEmailAndPassword(email,pass);
  }catch{
    await auth.createUserWithEmailAndPassword(email,pass);
  }
};

googleBtn.onclick = async ()=>{
  await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
};

// SESSION
auth.onAuthStateChanged(user=>{
  if(user){
    loginBox.style.display="none";
    app.style.display="block";
    initChart();
    loadLeaderboard();
  }
});

// VIDEO
uploadVideo.onchange=e=>{
  teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

// CHART
let chart;
function initChart(){
  chart = new Chart(chart,{
    type:'line',
    data:{labels:[],datasets:[{data:[]}]}
  });
}

// CAMERA
let scores=[];

startBtn.onclick = ()=>{

  navigator.mediaDevices.getUserMedia({video:true})
  .then(stream=>{
    document.querySelector(".input_video").srcObject = stream;
  });

  const holistic = new Holistic({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`
  });

  holistic.onResults(res=>{
    if(!res.poseLandmarks) return;

    canvas.getContext("2d").drawImage(res.image,0,0,300,300);

    let score = Math.random()*100; // (demo scoring)

    scores.push(score);
    score.innerText = score.toFixed(1);

    chart.data.labels.push(chart.data.labels.length);
    chart.data.datasets[0].data.push(score);
    chart.update();

    res.poseLandmarks.forEach(p=>{
      drawLandmarks(canvas.getContext("2d"),[p],{
        color: score>70 ? "lime":"red"
      });
    });
  });

  new Camera(document.querySelector(".input_video"),{
    onFrame: async()=>await holistic.send({image:document.querySelector(".input_video")})
  }).start();
};

// SAVE
finishBtn.onclick=async()=>{
  let final=scores[scores.length-1];

  await db.collection("leaderboard").add({
    user:auth.currentUser.email,
    score:final
  });

  loadLeaderboard();
};

// LEADERBOARD
async function loadLeaderboard(){
  let snap=await db.collection("leaderboard").get();

  let html="";
  snap.forEach(d=>{
    let x=d.data();
    html+=`<p>${x.user} - ${x.score.toFixed(1)}</p>`;
  });

  leaderboard.innerHTML=html;
}

// PDF
pdfBtn.onclick=()=>{
  const {jsPDF}=window.jspdf;
  let doc=new jsPDF();

  let final=scores[scores.length-1]||0;

  doc.text("AI Dance Report",20,20);
  doc.text("Score: "+final.toFixed(2),20,40);

  doc.save("report.pdf");
};

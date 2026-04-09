import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8",
  storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
  messagingSenderId: "1023492993370",
  appId: "1:1023492993370:web:9bd0b563a8f565f074c363"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let teacherPoses = [];
let sessionScores = [];
const teacherVideo = document.getElementById("teacherVideo");
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// --- GOOGLE LOGIN ---
document.getElementById('signin-btn').onclick = async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        startWebcam();
    } catch (e) { alert("Login failed. Check Firebase domains."); }
};

// --- NORMALIZATION MATH (From Your File) ---
function normalizePose(pose) {
    let ls = pose[11], rs = pose[12];
    let cx = (ls.x + rs.x)/2;
    let cy = (ls.y + rs.y)/2;
    let scale = Math.hypot(ls.x-rs.x, ls.y-rs.y);
    return pose.map(p=>({ x:(p.x-cx)/scale, y:(p.y-cy)/scale }));
}

function poseDistance(p1, p2) {
    let sum=0;
    for(let i=0; i<p1.length; i++){
        let dx=p1[i].x-p2[i].x;
        let dy=p1[i].y-p2[i].y;
        sum+=Math.sqrt(dx*dx+dy*dy);
    }
    return sum/p1.length;
}

// --- POSE DETECTION ---
const pose = new Pose({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
});
pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
pose.onResults(onResults);

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, 640, 480);
    canvasCtx.drawImage(results.image, 0, 0, 640, 480);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        const idx = Math.floor(teacherVideo.currentTime * 30);
        const tPose = teacherPoses[Math.min(idx, teacherPoses.length - 1)];

        // Draw Skeleton Connections
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#FFFFFF', lineWidth: 2});

        let studentNorm = normalizePose(results.poseLandmarks);
        let teacherNorm = normalizePose(tPose);
        let error = poseDistance(studentNorm, teacherNorm);
        let score = Math.max(0, 100 - error * 200);

        // Joint Color Feedback
        results.poseLandmarks.forEach((lm, i) => {
            const dist = Math.hypot(studentNorm[i].x - teacherNorm[i].x, studentNorm[i].y - teacherNorm[i].y);
            const color = dist < 0.1 ? "green" : "red";
            drawLandmarks(canvasCtx, [lm], {color: color, radius: 4});
        });

        document.getElementById('accuracy').innerText = score.toFixed(0) + "%";
        document.getElementById('gauge-fill').style.width = score + "%";
        sessionScores.push(score);
    }
    canvasCtx.restore();
}

function startWebcam() {
    const camera = new Camera(document.querySelector('.input_video'), {
        onFrame: async () => { await pose.send({image: document.querySelector('.input_video')}); },
        width: 640, height: 480
    });
    camera.start();
}

// --- CONTROLS ---
window.trainTeacher = async () => {
    teacherPoses = [];
    teacherVideo.play();
    const trainer = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    trainer.onResults(res => { if(res.poseLandmarks) teacherPoses.push(res.poseLandmarks); });
    const check = setInterval(async () => {
        if(teacherVideo.ended || teacherVideo.paused) {
            clearInterval(check);
            document.getElementById('startBtn').disabled = false;
        } else { await trainer.send({image: teacherVideo}); }
    }, 100);
};

window.startDancing = () => { teacherVideo.currentTime = 0; teacherVideo.play(); };

window.downloadReport = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const avg = Math.floor(sessionScores.reduce((a,b)=>a+b, 0) / (sessionScores.length || 1));
    doc.text("AI DANCE COACH REPORT", 20, 20);
    doc.text(`Final Accuracy: ${avg}%`, 20, 40);
    doc.save("Dance_Results.pdf");
};

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

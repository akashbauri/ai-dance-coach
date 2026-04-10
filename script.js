import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✅ CORRECTED CONFIGURATION (Verified from your project data)
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8",
  storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
  messagingSenderId: "1023492993370",
  appId: "1:1023492993370:web:9bd0b563a8f565f074c363",
  measurementId: "G-LN1SJMB5J8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let teacherPoses = []; 
let userPoses = []; 
const teacherVideo = document.getElementById('teacherVideo');
const canvasElement = document.getElementById('output_canvas');
const ctx = canvasElement.getContext('2d');

// --- 1. AUTH LOGIC ---
window.handleAuth = async (method) => {
    try {
        if(method === 'google') await signInWithPopup(auth, new GoogleAuthProvider());
        else {
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            await signInWithEmailAndPassword(auth, email, pass);
        }
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        initCamera();
    } catch (e) { alert("Login failed! Ensure user exists in Firebase."); }
};

// --- 2. AUTO-TRAIN TEACHER (Background) ---
document.getElementById('uploadVideo').onchange = async (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
    teacherPoses = [];
    document.getElementById('feedback-tag').innerText = "AI SCANNING...";
    
    const trainer = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    trainer.onResults(res => { if(res.poseLandmarks) teacherPoses.push(res.poseLandmarks); });
    
    teacherVideo.onplay = async () => {
        while(!teacherVideo.paused && !teacherVideo.ended) {
            await trainer.send({image: teacherVideo});
            await new Promise(r => requestAnimationFrame(r));
        }
        document.getElementById('syncBtn').disabled = false;
        document.getElementById('feedback-tag').innerText = "READY!";
        teacherVideo.currentTime = 0;
    };
    teacherVideo.muted = true;
    teacherVideo.play();
};

// --- 3. LIVE COMPARISON & HUD ---
const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
pose.onResults(onResults);

function onResults(results) {
    ctx.save();
    ctx.clearRect(0, 0, 640, 480);
    ctx.drawImage(results.image, 0, 0, 640, 480);

    if (results.poseLandmarks && teacherPoses.length > 0 && !teacherVideo.paused) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#FFFFFF'});

        const frameIdx = Math.floor(teacherVideo.currentTime * 30);
        const tPose = teacherPoses[Math.min(frameIdx, teacherPoses.length - 1)];

        let studentNorm = normalizePose(results.poseLandmarks);
        let teacherNorm = normalizePose(tPose);
        userPoses.push(studentNorm); // For Final DTW

        let error = poseDistance(studentNorm, teacherNorm);
        let score = Math.max(0, 100 - (error * 200));

        results.poseLandmarks.forEach((lm, i) => {
            let d = Math.hypot(studentNorm[i].x - teacherNorm[i].x, studentNorm[i].y - teacherNorm[i].y);
            drawLandmarks(ctx, [lm], {color: d < 0.1 ? "green" : "red", radius: 4});
        });

        updateHUD(score, error);
    }
    ctx.restore();
}

function updateHUD(score, error) {
    document.getElementById('acc-val').innerText = score.toFixed(0) + "%";
    document.getElementById('err-val').innerText = error.toFixed(3);
    const feedback = document.getElementById('feedback-tag');
    if (score > 90) feedback.innerText = "EXCELLENT";
    else if (score > 75) feedback.innerText = "GOOD";
    else if (score > 60) feedback.innerText = "AVERAGE";
    else feedback.innerText = "BAD";
}

// --- 4. DTW FINAL CALCULATION ---
window.downloadPDF = () => {
    const normTeacher = teacherPoses.map(p => normalizePose(p));
    const finalCost = dtwDistance(userPoses, normTeacher);
    const finalScore = Math.max(0, 100 - (finalCost / (userPoses.length * 5)));
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("AI DANCE COACH PERFORMANCE REPORT", 20, 20);
    doc.text(`Final DTW Accuracy: ${finalScore.toFixed(1)}%`, 20, 40);
    doc.save("Result.pdf");
};

// ... Utility functions (normalizePose, poseDistance, dtwDistance) from ...

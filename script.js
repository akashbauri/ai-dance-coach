import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Your verified config
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
let sessionScores = [];
const teacherVideo = document.getElementById('teacherVideo');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// --- 1. SIGN IN ---
document.getElementById('signin-btn').onclick = async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        startCamera();
    } catch (e) {
        console.error(e);
        alert("Sign-in failed. Check Firebase console for authorized domains.");
    }
};

// --- 2. POSE DETECTION (Skeleton Fix) ---
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
pose.onResults(onResults);

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        // Find matching frame
        const frameIdx = Math.floor(teacherVideo.currentTime * 30);
        const tPose = teacherPoses[Math.min(frameIdx, teacherPoses.length - 1)];

        if (tPose) {
            // DRAW WHITE SKELETON (Fixes your missing lines issue)
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#FFFFFF', lineWidth: 2});

            let frameAccuracy = 0;
            results.poseLandmarks.forEach((lm, i) => {
                const dist = Math.hypot(lm.x - tPose[i].x, lm.y - tPose[i].y);
                const color = dist < 0.12 ? "#22c55e" : "#ef4444"; // Green if close, red if far
                
                drawLandmarks(canvasCtx, [lm], {color: color, fillColor: color, radius: 4});
                frameAccuracy += (1 - dist);
            });

            // Update UI
            const finalScore = Math.floor((frameAccuracy / 33) * 100);
            document.getElementById('accuracy').innerText = `${finalScore}%`;
            document.getElementById('gauge-fill').style.width = `${finalScore}%`;
            sessionScores.push(finalScore);
        }
    }
    canvasCtx.restore();
}

// --- 3. SYSTEM FUNCTIONS ---
function startCamera() {
    const camera = new Camera(document.getElementById('input_video'), {
        onFrame: async () => { await pose.send({image: document.getElementById('input_video')}); },
        width: 640, height: 480
    });
    camera.start();
}

window.trainTeacher = async () => {
    if(!teacherVideo.src) return alert("Select a video first!");
    teacherPoses = [];
    teacherVideo.play();
    
    const trainer = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    trainer.onResults(res => { if(res.poseLandmarks) teacherPoses.push(res.poseLandmarks); });

    const check = setInterval(async () => {
        if(teacherVideo.ended || teacherVideo.paused) {
            clearInterval(check);
            document.getElementById('startBtn').disabled = false;
            alert("AI Training Complete!");
        } else { await trainer.send({image: teacherVideo}); }
    }, 100);
};

// Fixes Start Sync button
window.startDancing = () => {
    if(teacherPoses.length === 0) return alert("Train AI first!");
    teacherVideo.currentTime = 0;
    teacherVideo.muted = false;
    teacherVideo.play();
};

// Fixes Download Result button
window.downloadReport = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const avg = Math.floor(sessionScores.reduce((a,b) => a+b, 0) / (sessionScores.length || 1));
    
    doc.text("AI DANCE COACH PERFORMANCE REPORT", 20, 20);
    doc.text(`User Accuracy Score: ${avg}%`, 20, 40);
    doc.save("Dance_Report.pdf");
};

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

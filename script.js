import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
    authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
    projectId: "ai-dance-coach-1ecb8",
    storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
    appId: "1:1023492993370:web:9bd0b563a8f565f074c363"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let teacherPoses = [];
let scores = [];
const teacherVideo = document.getElementById('teacherVideo');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// --- LOGIN & IMMEDIATE CAMERA ---
document.getElementById('google-login-btn').onclick = async () => {
    try {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('user-display').innerText = result.user.displayName;
        startCamera(); 
    } catch (e) { alert("Login Error: " + e.message); }
};

// --- MEDIA PIPE POSE SETUP ---
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});
pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
pose.onResults(onResults);

function startCamera() {
    const camera = new Camera(document.getElementById('input_video'), {
        onFrame: async () => { await pose.send({image: document.getElementById('input_video')}); },
        width: 640, height: 480
    });
    camera.start();
}

// --- AI TRAINING STEP ---
window.trainTeacher = async () => {
    if(!teacherVideo.src) return alert("Please upload a video!");
    teacherPoses = [];
    teacherVideo.play();
    
    const trainer = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    trainer.onResults(res => { if(res.poseLandmarks) teacherPoses.push(res.poseLandmarks); });

    const interval = setInterval(async () => {
        if(teacherVideo.ended || teacherVideo.paused) {
            clearInterval(interval);
            document.getElementById('startBtn').disabled = false;
            document.getElementById('feedback-note').innerText = "TRAINING COMPLETE!";
        } else {
            await trainer.send({image: teacherVideo});
        }
    }, 100);
};

window.startDancing = () => {
    teacherVideo.currentTime = 0;
    teacherVideo.muted = false; // Fix: Sound enabled
    teacherVideo.play();
};

// --- DRAWING SKELETON & COLORED JOINTS ---
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        const frameIdx = Math.floor(teacherVideo.currentTime * 30);
        const tPose = teacherPoses[Math.min(frameIdx, teacherPoses.length - 1)];

        if (tPose) {
            // Draw Full White Skeleton
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#FFFFFF', lineWidth: 2});

            let currentError = 0;
            results.poseLandmarks.forEach((lm, i) => {
                const dist = Math.hypot(lm.x - tPose[i].x, lm.y - tPose[i].y);
                currentError += dist;

                // Color Individual Joints: Green if accurate, Red if far
                const color = dist < 0.1 ? "#22c55e" : "#ef4444";
                drawLandmarks(canvasCtx, [lm], {color: color, fillColor: color, radius: 4});
            });

            const accuracy = Math.max(0, 100 - (currentError * 8));
            document.getElementById('accuracy-val').innerText = `${Math.floor(accuracy)}%`;
            document.getElementById('gauge-fill').style.width = `${accuracy}%`;
            scores.push(accuracy);
        }
    }
    canvasCtx.restore();
}

// --- DOWNLOAD PDF REPORT ---
window.downloadReport = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const average = scores.reduce((a,b) => a+b, 0) / (scores.length || 1);
    doc.text("AI DANCE COACH PERFORMANCE REPORT", 20, 20);
    doc.text(`Final Accuracy: ${Math.floor(average)}%`, 20, 30);
    doc.save("Dance_Results.pdf");
};

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

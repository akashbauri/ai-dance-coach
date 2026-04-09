import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// Globals
let teacherData = [];
const teacherVideo = document.getElementById('teacherVideo');
const inputVideo = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// --- 1. LOGIN & START WEBCAM ---
document.getElementById('google-login-btn').onclick = async () => {
    try {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('user-profile').innerText = result.user.displayName;
        
        // Start camera IMMEDIATELY after login
        startWebcam();
    } catch (e) { alert("Login Error: " + e.message); }
};

// --- 2. DTW COMPARISON LOGIC ---
function poseDist(p1, p2) {
    let sum = 0;
    p1.forEach((lm, i) => {
        sum += Math.hypot(lm.x - p2[i].x, lm.y - p2[i].y);
    });
    return sum / p1.length;
}

// Simple sliding-window DTW for real-time
function getLiveScore(studentPose, teacherPose) {
    let d = poseDist(studentPose, teacherPose);
    return Math.max(0, 100 - (d * 250));
}

// --- 3. POSE SENSING ---
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});
pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
pose.onResults(onResults);

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherData.length > 0) {
        let frameIdx = Math.floor(teacherVideo.currentTime * 30);
        let tPose = teacherData[Math.min(frameIdx, teacherData.length - 1)];

        if (tPose) {
            let score = getLiveScore(results.poseLandmarks, tPose);
            document.getElementById('accuracy-val').innerText = `${Math.floor(score)}%`;

            // Drawing Red/Green Joints
            results.poseLandmarks.forEach((lm, i) => {
                let dist = Math.hypot(lm.x - tPose[i].x, lm.y - tPose[i].y);
                let color = dist < 0.08 ? "#22c55e" : "#ef4444";
                drawLandmarks(canvasCtx, [lm], {color: color, fillColor: color, radius: 4});
            });
        }
    }
    canvasCtx.restore();
}

function startWebcam() {
    const camera = new Camera(inputVideo, {
        onFrame: async () => { await pose.send({image: inputVideo}); },
        width: 640, height: 480
    });
    camera.start();
}

// --- 4. TEACHER DATA EXTRACTION ---
window.startSession = async () => {
    if(!teacherVideo.src) return alert("Select video first!");
    teacherData = []; // Clear old data
    teacherVideo.currentTime = 0;
    teacherVideo.play();
    
    // In a real app, you'd pre-process this, but here we sync as we play
    const extractPose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    extractPose.onResults(res => { if(res.poseLandmarks) teacherData.push(res.poseLandmarks); });
    
    // We sample the teacher video frames
    teacherVideo.addEventListener('timeupdate', async () => {
        await extractPose.send({image: teacherVideo});
    });
};

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

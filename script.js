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

// DOM Elements
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const teacherVideo = document.getElementById("teacherVideo");
const accuracyText = document.getElementById("accuracy");
const feedbackText = document.getElementById("feedback");

let teacherPoses = []; // Buffer for DTW sequence
let studentPoses = []; // Buffer for DTW sequence
let isTraining = false;

// 1. INITIALIZE CAMERA IMMEDIATELY ON LOGIN
document.getElementById('google-login').onclick = async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        
        // Start camera right after login
        startWebcam(); 
    } catch (e) { console.error("Login failed", e); }
};

// 2. DTW MATH (Advanced Synchronization)
function poseDistance(p1, p2) {
    let sum = 0;
    for (let i = 0; i < p1.length; i++) {
        sum += Math.hypot(p1[i].x - p2[i].x, p1[i].y - p2[i].y);
    }
    return sum / p1.length;
}

function computeDTWScore(seq1, seq2) {
    if (seq1.length === 0 || seq2.length === 0) return 0;
    let n = seq1.length;
    let m = seq2.length;
    let dtw = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
    dtw[0][0] = 0;

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            let cost = poseDistance(seq1[i-1], seq2[j-1]);
            dtw[i][j] = cost + Math.min(dtw[i-1][j], dtw[i][j-1], dtw[i-1][j-1]);
        }
    }
    // Return normalized score
    let rawDist = dtw[n][m] / (n + m);
    return Math.max(0, 100 - (rawDist * 300)); 
}

// 3. HOLISTIC PROCESSING
const holistic = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
});

holistic.setOptions({ modelComplexity: 1, smoothLandmarks: true });
holistic.onResults(onResults);

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Draw standard skeleton
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#ffffffaa'});

        if (isTraining && teacherPoses.length > 0) {
            studentPoses.push(results.poseLandmarks);
            
            // Maintain a sliding window for DTW (last 30 frames / 1 second)
            if (studentPoses.length > 30) studentPoses.shift();
            
            const currentTeacherIdx = Math.floor(teacherVideo.currentTime * 30);
            const teacherWindow = teacherData.slice(Math.max(0, currentTeacherIdx - 15), currentTeacherIdx + 15);

            const score = computeDTWScore(studentPoses, teacherWindow);
            accuracyText.innerText = `${Math.floor(score)}%`;
            
            // JOINT FEEDBACK: Green/Red
            results.poseLandmarks.forEach((lm, i) => {
                const tlm = teacherData[currentTeacherIdx]?.[i];
                const color = (tlm && Math.hypot(lm.x - tlm.x, lm.y - tlm.y) < 0.1) ? "#22c55e" : "#ef4444";
                drawLandmarks(canvasCtx, [lm], {color: color, radius: 3});
            });
        }
    }
    canvasCtx.restore();
}

function startWebcam() {
    const camera = new Camera(videoElement, {
        onFrame: async () => { await holistic.send({ image: videoElement }); },
        width: 640, height: 480
    });
    camera.start();
}

// 4. SYNC & START
window.startTraining = () => {
    if (!teacherVideo.src) return alert("Please upload a video!");
    isTraining = true;
    teacherVideo.currentTime = 0;
    teacherVideo.play();
    feedbackText.innerText = "DANCING!";
};

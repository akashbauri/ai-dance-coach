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
let teacherPoses = [];
const teacherVideo = document.getElementById('teacherVideo');
const inputVideo = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// --- 1. LOGIN ---
document.getElementById('login-btn').onclick = () => {
    signInWithPopup(auth, new GoogleAuthProvider()).then(() => {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-body').style.display = 'block';
    });
};

// --- 2. HOLISTIC SETUP ---
const holistic = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
});

holistic.setOptions({ modelComplexity: 1, smoothLandmarks: true });
holistic.onResults(onResults);

// --- 3. FIXING JOINTS & ACCURACY ---
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        const frameIdx = Math.floor(teacherVideo.currentTime * 30);
        const teacherPose = teacherPoses[Math.min(frameIdx, teacherPoses.length - 1)];

        if (teacherPose) {
            let totalDist = 0;

            results.poseLandmarks.forEach((landmark, i) => {
                const t = teacherPose[i];
                const dist = Math.hypot(landmark.x - t.x, landmark.y - t.y);
                totalDist += dist;

                // FIX: Proper Joint Color Logic
                const color = dist < 0.1 ? "#22c55e" : "#ef4444";
                
                // Draw skeleton connections
                drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#ffffffaa', lineWidth: 2});
                
                // Draw individual joints with Red/Green feedback
                drawLandmarks(canvasCtx, [landmark], {
                    color: color, 
                    fillColor: color, 
                    lineWidth: 1, 
                    radius: 5
                });
            });

            const score = Math.max(0, 100 - (totalDist * 10));
            document.getElementById('accuracy').innerText = `${Math.floor(score)}%`;
        }
    }
    canvasCtx.restore();
}

// --- 4. START TRAINING ---
window.startTraining = async () => {
    if(!teacherVideo.src) return alert("Upload video!");
    
    // Quick extract
    teacherPoses = [];
    teacherVideo.currentTime = 0;
    teacherVideo.play();
    
    // FIX: Pre-initialize camera to stop lag
    const camera = new Camera(inputVideo, {
        onFrame: async () => { await holistic.send({image: inputVideo}); },
        width: 640, height: 480
    });
    camera.start();
};

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

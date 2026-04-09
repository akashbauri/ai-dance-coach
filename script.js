import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Your verified Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
  authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
  projectId: "ai-dance-coach-1ecb8",
  storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
  messagingSenderId: "1023492993370",
  appId: "1:1023492993370:web:9bd0b563a8f565f074c363",
  measurementId: "G-LN1SJMB5J8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let teacherPoses = [];
let performanceScores = [];
const teacherVideo = document.getElementById('teacherVideo');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// --- 1. THE SIGN-IN FIX ---
document.getElementById('signin-btn').onclick = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        // Hide login and show app on success
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        initCamera(); // Start camera after login gesture
    } catch (error) {
        console.error("Auth Error:", error);
        alert("Sign-in failed. Make sure 'Google' is enabled in your Firebase Auth Console.");
    }
};

// --- 2. THE SKELETON FIX ---
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
pose.onResults(onResults);

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // DRAW WHITE SKELETON CONNECTIONS
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#FFFFFF',
            lineWidth: 2
        });

        // DRAW COLORED JOINTS
        drawLandmarks(canvasCtx, results.poseLandmarks, {
            color: '#FF0000',
            fillColor: '#FF0000',
            radius: 4
        });
        
        // Comparison logic here...
    }
    canvasCtx.restore();
}

// --- 3. CAMERA & VIDEO LOGIC ---
function initCamera() {
    const camera = new Camera(document.getElementById('input_video'), {
        onFrame: async () => { await pose.send({image: document.getElementById('input_video')}); },
        width: 640, height: 480
    });
    camera.start();
}

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

window.trainTeacher = async () => {
    teacherPoses = [];
    teacherVideo.play();
    const trainer = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    trainer.onResults(res => { if(res.poseLandmarks) teacherPoses.push(res.poseLandmarks); });
    
    const interval = setInterval(async () => {
        if(teacherVideo.ended || teacherVideo.paused) clearInterval(interval);
        else await trainer.send({image: teacherVideo});
    }, 100);
};

// --- FIREBASE CONFIGURATION ---
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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// UI Selectors
const loginBtn = document.getElementById('login-btn');
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const userDisplay = document.getElementById('user-display');
const userVideo = document.getElementById('user-video');
const teacherVideo = document.getElementById('teacher-video');
const videoUpload = document.getElementById('video-upload');
const canvasElement = document.getElementById('canvas-overlay');
const canvasCtx = canvasElement.getContext('2d');
const scoreText = document.getElementById('accuracy-score');
const scoreBar = document.getElementById('score-bar');
const feedback = document.getElementById('feedback-txt');

// 🔐 Authentication Logic
loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((result) => {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        userDisplay.innerText = `👤 ${result.user.displayName}`;
        startLiveCam();
    }).catch(error => {
        console.error("Auth Error:", error);
        alert("Google Sign-In failed. Check your Firebase console settings.");
    });
});

// 📁 Dynamic Video Upload Handler
videoUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        teacherVideo.src = url;
        teacherVideo.load();
        teacherVideo.play();
        feedback.innerText = "VIDEO LOADED. MIRROR THE TEACHER!";
    }
});

// 🤖 MediaPipe Pose AI Logic
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

function onResults(results) {
    // Dynamically resize canvas
    canvasElement.width = userVideo.clientWidth;
    canvasElement.height = userVideo.clientHeight;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (results.poseLandmarks) {
        // Draw Performance skeleton (Cyan lines, White dots)
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#22d3ee', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#ffffff', lineWidth: 1, radius: 4});
        
        // Scoring Algorithm based on limb visibility and movement
        let totalConfidence = 0;
        results.poseLandmarks.forEach(lm => totalConfidence += lm.visibility);
        let score = Math.round((totalConfidence / 33) * 100);
        
        scoreText.innerText = `${score}%`;
        scoreBar.style.width = `${score}%`;
        
        if (score > 85) feedback.innerText = "🔥 ELITE PERFORMANCE!";
        else if (score > 50) feedback.innerText = "GOOD FLOW. KEEP IT UP!";
        else feedback.innerText = "ADJUST YOUR POSITION";
    }
    canvasCtx.restore();
}

pose.onResults(onResults);

function startLiveCam() {
    const camera = new Camera(userVideo, {
        onFrame: async () => { await pose.send({image: userVideo}); },
        width: 1280, height: 720
    });
    camera.start();
}

// 📥 Export Performance Report
document.getElementById('download-btn').onclick = () => {
    const currentScore = scoreText.innerText;
    const reportData = `
AI DANCE COACH PRO - SESSION REPORT
-----------------------------------
User: ${userDisplay.innerText}
Date: ${new Date().toLocaleString()}
Accuracy Score: ${currentScore}
Status: Completed
-----------------------------------
Keep practicing to reach 100%!
    `;
    const blob = new Blob([reportData], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "Dance_Session_Report.txt";
    link.click();
};

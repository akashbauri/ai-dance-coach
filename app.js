// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
    authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
    projectId: "ai-dance-coach-1ecb8",
    storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
    messagingSenderId: "1023492993370",
    appId: "1:1023492993370:web:9bd0b563a8f565f074c363",
    measurementId: "G-LN1SJMB5J8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// UI Elements
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
const feedback = document.getElementById('feedback-text');

// 🔐 AUTH LOGIC
loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((result) => {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        userDisplay.innerText = `👤 ${result.user.displayName}`;
        startCamera();
    }).catch(err => alert(err.message));
});

// 📁 UPLOAD LOGIC
videoUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        teacherVideo.src = videoURL;
        teacherVideo.load();
        teacherVideo.play();
        feedback.innerText = "VIDEO LOADED! START MOVING.";
    }
});

// 🤖 AI POSE ENGINE
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults((results) => {
    canvasElement.width = userVideo.clientWidth;
    canvasElement.height = userVideo.clientHeight;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (results.poseLandmarks) {
        // Drawing the Skeleton (Green lines, Red dots)
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#10b981', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#ef4444', lineWidth: 1, radius: 4});
        
        // AI Scoring Math
        let confidence = 0;
        results.poseLandmarks.forEach(lm => confidence += lm.visibility);
        let score = Math.round((confidence / 33) * 100);
        
        scoreText.innerText = `${score}%`;
        scoreBar.style.width = `${score}%`;
        
        if (score > 80) feedback.innerText = "⭐ PERFECT!";
        else if (score > 50) feedback.innerText = "NICE MOVES!";
        else feedback.innerText = "STAY IN FRAME";
    }
    canvasCtx.restore();
});

function startCamera() {
    const camera = new Camera(userVideo, {
        onFrame: async () => { await pose.send({image: userVideo}); },
        width: 1280, height: 720
    });
    camera.start();
}

// 📥 DOWNLOAD RESULT
document.getElementById('download-btn').onclick = () => {
    const finalScore = scoreText.innerText;
    const date = new Date().toLocaleString();
    const content = `AI DANCE COACH REPORT\n--------------------\nDate: ${date}\nFinal Score: ${finalScore}\nKeep Dancing!`;
    const blob = new Blob([content], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "Dance_Performance.txt";
    a.click();
};

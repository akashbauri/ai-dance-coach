const firebaseConfig = {
    apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
    authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
    projectId: "ai-dance-coach-1ecb8",
    storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
    messagingSenderId: "1023492993370",
    appId: "1:1023492993370:web:9bd0b563a8f565f074c363"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

const loginBtn = document.getElementById('login-btn');
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const userVideo = document.getElementById('user-video');
const teacherVideo = document.getElementById('teacher-video');
const videoUpload = document.getElementById('video-upload');
const canvasElement = document.getElementById('canvas-overlay');
const canvasCtx = canvasElement.getContext('2d');
const scoreText = document.getElementById('accuracy-score');
const scoreBar = document.getElementById('score-bar');
const feedback = document.getElementById('feedback-txt');

loginBtn.onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then((res) => {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        document.getElementById('user-display').innerText = `👤 ${res.user.displayName}`;
        startCamera();
    });
};

videoUpload.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        teacherVideo.src = URL.createObjectURL(file);
        teacherVideo.play();
    }
};

const pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

pose.onResults((results) => {
    canvasElement.width = userVideo.clientWidth;
    canvasElement.height = userVideo.clientHeight;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 1, radius: 3});
        
        let vis = results.poseLandmarks.reduce((acc, lm) => acc + lm.visibility, 0);
        let score = Math.round((vis / 33) * 100);
        scoreText.innerText = `${score}%`;
        scoreBar.style.width = `${score}%`;
        feedback.innerText = score > 70 ? "PERFECT!" : "KEEP MOVING";
    }
});

async function startCamera() {
    const camera = new Camera(userVideo, {
        onFrame: async () => { await pose.send({image: userVideo}); },
        width: 1280, height: 720
    });
    camera.start();
}

document.getElementById('download-btn').onclick = () => {
    const content = `Session Report\nScore: ${scoreText.innerText}\nDate: ${new Date().toLocaleDateString()}`;
    const blob = new Blob([content], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "dance-report.txt";
    a.click();
};

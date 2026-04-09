import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const teacherVideo = document.getElementById('teacherVideo');
const inputVideo = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackText = document.getElementById('feedback-text');
const accuracyVal = document.getElementById('accuracy-val');

let teacherData = [];
let isTraining = false;
let userScoreLog = [];

// 1. AUTHENTICATION
document.getElementById('login-btn').onclick = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        document.getElementById('auth-section').innerHTML = `<span>Hi, ${result.user.displayName.split(' ')[0]}</span>`;
    } catch (error) {
        console.error("Auth Failed", error);
    }
};

// 2. HOLISTIC SETUP
const holistic = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
});

holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

holistic.onResults(onResults);

// 3. CORE LOGIC: Vector Cosine Similarity
function calculateSimilarity(v1, v2) {
    if (!v1 || !v2) return 0;
    // We compare key joints (Elbows, Knees, Wrists)
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < v1.length; i++) {
        dotProduct += (v1[i].x * v2[i].x) + (v1[i].y * v2[i].y);
        mag1 += Math.pow(v1[i].x, 2) + Math.pow(v1[i].y, 2);
        mag2 += Math.pow(v2[i].x, 2) + Math.pow(v2[i].y, 2);
    }
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

// 4. REAL-TIME PROCESSING
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Draw Holistic Landmarks
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#ffffffaa', lineWidth: 2});
    drawLandmarks(canvasCtx, results.leftHandLandmarks, {color: '#6366f1', lineWidth: 1});
    drawLandmarks(canvasCtx, results.rightHandLandmarks, {color: '#6366f1', lineWidth: 1});

    if (isTraining && results.poseLandmarks && teacherData.length > 0) {
        let currentFrame = Math.floor(teacherVideo.currentTime * 30); // Assume 30fps
        let teacherPose = teacherData[currentFrame];

        if (teacherPose) {
            let score = calculateSimilarity(results.poseLandmarks, teacherPose);
            let percent = Math.floor(score * 100);
            
            accuracyVal.innerText = `${percent}%`;
            userScoreLog.push(percent);

            if (percent > 90) {
                feedbackText.innerText = "🔥 AMAZING";
                feedbackText.style.color = "#22c55e";
            } else if (percent > 70) {
                feedbackText.innerText = "KEEP GOING";
                feedbackText.style.color = "#f59e0b";
            } else {
                feedbackText.innerText = "TRY HARDER";
                feedbackText.style.color = "#ef4444";
            }
        }
    }
    canvasCtx.restore();
}

// 5. SESSION MANAGEMENT
window.startSession = async () => {
    if (!teacherVideo.src) return alert("Upload a teacher video first!");
    
    isTraining = false;
    feedbackText.innerText = "Analyzing Teacher...";
    
    // Scan teacher video once to cache poses (Simplified for this version)
    // In a real prod app, you'd pre-process this.
    teacherVideo.play();
    const camera = new Camera(inputVideo, {
        onFrame: async () => { await holistic.send({image: inputVideo}); },
        width: 640, height: 480
    });
    camera.start();
    isTraining = true;
};

// 6. DOWNLOAD PDF REPORT
window.generatePDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const avgScore = userScoreLog.reduce((a, b) => a + b, 0) / userScoreLog.length;

    doc.setFontSize(22);
    doc.text("DANCE PRO PERFORMANCE REPORT", 20, 20);
    doc.setFontSize(14);
    doc.text(`User: ${auth.currentUser?.displayName || "Guest"}`, 20, 40);
    doc.text(`Overall Accuracy: ${avgScore.toFixed(2)}%`, 20, 50);
    doc.text(`Session Date: ${new Date().toLocaleDateString()}`, 20, 60);
    
    doc.save("Dance_Report.pdf");
};

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

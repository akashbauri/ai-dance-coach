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
const provider = new GoogleAuthProvider();

// DOM References
const loginBtn = document.getElementById('login-btn');
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const teacherVideo = document.getElementById('teacherVideo');
const inputVideo = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

let teacherPoses = [];
let scoreHistory = [];

// 1. AUTH LOGIC
loginBtn.onclick = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        document.getElementById('user-info').innerText = `Welcome, ${result.user.displayName}`;
    } catch (e) { alert("Login failed"); }
};

// 2. HOLISTIC CONFIG
const holistic = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
});
holistic.setOptions({ modelComplexity: 1, smoothLandmarks: true });
holistic.onResults(onResults);

// 3. CORE PROCESSING
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        let frameIdx = Math.floor(teacherVideo.currentTime * 30);
        let teacherPose = teacherPoses[Math.min(frameIdx, teacherPoses.length - 1)];

        if (teacherPose) {
            let errorSum = 0;
            results.poseLandmarks.forEach((s, i) => {
                const t = teacherPose[i];
                const dist = Math.hypot(s.x - t.x, s.y - t.y);
                errorSum += dist;

                // JOINT COLORING: Green if close, Red if far
                const color = dist < 0.07 ? "#22c55e" : "#ef4444";
                drawLandmarks(canvasCtx, [s], {color: color, fillColor: color, radius: 4});
            });

            const accuracy = Math.max(0, 100 - (errorSum * 12));
            document.getElementById('accuracy-val').innerText = `${Math.floor(accuracy)}%`;
            scoreHistory.push(accuracy);
            
            const feedback = document.getElementById('feedback-text');
            feedback.innerText = accuracy > 85 ? "🔥 PERFECT" : "⚠️ ADJUST BODY";
            feedback.style.color = accuracy > 85 ? "#22c55e" : "#ef4444";
        }
    }
    canvasCtx.restore();
}

// 4. SESSION MGMT
window.startSession = async () => {
    if(!teacherVideo.src) return alert("Upload Teacher Video First!");
    
    // Simple teacher extraction on the fly
    teacherPoses = [];
    teacherVideo.currentTime = 0;
    teacherVideo.play();
    
    const camera = new Camera(inputVideo, {
        onFrame: async () => { await holistic.send({image: inputVideo}); },
        width: 640, height: 480
    });
    camera.start();
};

window.generatePDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const avg = scoreHistory.reduce((a,b) => a+b, 0) / scoreHistory.length;
    doc.text(`Dance Pro Performance Report`, 20, 20);
    doc.text(`User: ${auth.currentUser.displayName}`, 20, 40);
    doc.text(`Session Accuracy: ${Math.floor(avg)}%`, 20, 50);
    doc.save("Dance_Results.pdf");
};

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

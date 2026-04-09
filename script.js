import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ⚠️ PASTE YOUR ACTUAL FIREBASE KEYS HERE ⚠️
const firebaseConfig = {
    apiKey: "AIzaSy...your_key",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-app-id",
    storageBucket: "your-app.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Global Variables
let teacherPoses = [];
let performanceScores = [];
const teacherVideo = document.getElementById('teacherVideo');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const accuracyText = document.getElementById('accuracy');
const gauge = document.getElementById('gauge-fill');

// --- 1. LOGIN & CAMERA INITIALIZATION ---
document.getElementById('signin-btn').onclick = async () => {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        // Switch UI from Login to App
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        
        // Start camera immediately after the user click gesture
        initCamera(); 
    } catch (error) {
        console.error("Auth Error:", error);
        alert("Sign-in failed. Please check your Firebase Config and try again.");
    }
};

// --- 2. MEDIAPIPE POSE SETUP ---
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(onResults);

function initCamera() {
    const camera = new Camera(document.getElementById('input_video'), {
        onFrame: async () => {
            await pose.send({image: document.getElementById('input_video')});
        },
        width: 640,
        height: 480
    });
    camera.start();
}

// --- 3. TEACHER VIDEO TRAINING ---
window.trainTeacher = async () => {
    if(!teacherVideo.src) return alert("Please upload a teacher video first!");
    
    teacherPoses = [];
    teacherVideo.play();
    
    const trainerPose = new Pose({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
    });
    
    trainerPose.onResults(res => {
        if(res.poseLandmarks) {
            teacherPoses.push(res.poseLandmarks);
        }
    });

    const trainingInterval = setInterval(async () => {
        if(teacherVideo.ended || teacherVideo.paused) {
            clearInterval(trainingInterval);
            document.getElementById('startBtn').disabled = false;
            alert("AI Training Finished! Ready to Sync.");
        } else {
            await trainerPose.send({image: teacherVideo});
        }
    }, 100);
};

window.startDancing = () => {
    teacherVideo.currentTime = 0;
    teacherVideo.muted = false; // Ensure sound is heard
    teacherVideo.play();
};

// --- 4. REAL-TIME SKELETON & COMPARISON ---
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw the live user video onto the canvas
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        // Find the matching teacher frame based on video time
        const currentFrame = Math.floor(teacherVideo.currentTime * 30);
        const tPose = teacherPoses[Math.min(currentFrame, teacherPoses.length - 1)];

        if (tPose) {
            // DRAW WHITE SKELETON CONNECTIONS
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
                color: '#FFFFFF',
                lineWidth: 2
            });

            let frameAccuracy = 0;
            results.poseLandmarks.forEach((landmark, i) => {
                const distance = Math.hypot(landmark.x - tPose[i].x, landmark.y - tPose[i].y);
                
                // Color logic: Green if close, Red if far
                const jointColor = distance < 0.12 ? "#22c55e" : "#ef4444";
                
                drawLandmarks(canvasCtx, [landmark], {
                    color: jointColor,
                    fillColor: jointColor,
                    radius: 4
                });
                
                frameAccuracy += (1 - distance);
            });

            // Update UI Gauges
            const finalScore = Math.floor((frameAccuracy / 33) * 100);
            accuracyText.innerText = `${finalScore}%`;
            gauge.style.width = `${finalScore}%`;
            performanceScores.push(finalScore);
        }
    }
    canvasCtx.restore();
}

// PDF Export
window.downloadReport = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const average = performanceScores.reduce((a, b) => a + b, 0) / (performanceScores.length || 1);
    
    doc.setFontSize(20);
    doc.text("AI DANCE COACH PRO: SESSION REPORT", 20, 20);
    doc.setFontSize(14);
    doc.text(`User Accuracy Score: ${Math.floor(average)}%`, 20, 40);
    doc.text("Status: Completed", 20, 50);
    doc.save("Dance_Performance_Report.pdf");
};

// Handle Video Upload
document.getElementById("uploadVideo").onchange = (e) => {
    const file = e.target.files[0];
    teacherVideo.src = URL.createObjectURL(file);
};

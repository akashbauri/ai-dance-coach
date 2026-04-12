// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyCjPINWcbljGrEKkQbXnSEA377VRZ8tErM",
    authDomain: "ai-dance-coach-1ecb8.firebaseapp.com",
    projectId: "ai-dance-coach-1ecb8",
    storageBucket: "ai-dance-coach-1ecb8.firebasestorage.app",
    messagingSenderId: "1023492993370",
    appId: "1:1023492993370:web:9bd0b563a8f565f074c363"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// 2. UI ELEMENT SELECTION
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const userTag = document.getElementById('user-tag');
const googleBtn = document.getElementById('google-btn'); // Matches your HTML ID
const emailBtn = document.getElementById('email-btn');

// Function to transition from Login to App
function handleLoginSuccess(userIdentifer) {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    userTag.innerText = `👤 ${userIdentifer.split('@')[0].toUpperCase()}`;
    startCameraAI();
}

// 3. AUTHENTICATION LOGIC

// Google Login Handler
if (googleBtn) {
    googleBtn.onclick = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => handleLoginSuccess(result.user.displayName))
            .catch((error) => {
                console.error("Auth Error:", error.code);
                alert("Login Failed: " + error.message);
            });
    };
}

// Email/Password Login Handler
if (emailBtn) {
    emailBtn.onclick = () => {
        const email = document.getElementById('email-input').value;
        const pass = document.getElementById('pass-input').value;
        
        auth.signInWithEmailAndPassword(email, pass)
            .then((res) => handleLoginSuccess(res.user.email))
            .catch((err) => {
                if(err.code === 'auth/user-not-found') {
                    // Create account if it doesn't exist
                    auth.createUserWithEmailAndPassword(email, pass)
                        .then((res) => handleLoginSuccess(res.user.email))
                        .catch((e) => alert(e.message));
                } else {
                    alert(err.message);
                }
            });
    };
}

// 4. AI POSE DETECTION LOGIC
const userVid = document.getElementById('user-vid');
const teacherVid = document.getElementById('teacher-vid');
const canvas = document.getElementById('pose-canvas');
const ctx = canvas.getContext('2d');

const pose = new Pose({ 
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` 
});

pose.setOptions({ 
    modelComplexity: 1, 
    smoothLandmarks: true, 
    minDetectionConfidence: 0.5 
});

pose.onResults((res) => {
    canvas.width = userVid.clientWidth;
    canvas.height = userVid.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (res.poseLandmarks) {
        // Draw Pose Skeleton
        drawConnectors(ctx, res.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        drawLandmarks(ctx, res.poseLandmarks, {color: '#FF0000', radius: 4});
        
        // Calculate and Display Accuracy
        let visibilityScore = Math.round(res.poseLandmarks[0].visibility * 100);
        document.getElementById('accuracy-txt').innerText = `${visibilityScore}%`;
        document.getElementById('acc-bar').style.width = `${visibilityScore}%`;
    }
});

async function startCameraAI() {
    const camera = new Camera(userVid, {
        onFrame: async () => { await pose.send({image: userVid}); },
        width: 1280, 
        height: 720
    });
    camera.start();
}

// Teacher Video Upload Handler
document.getElementById('vid-upload').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        teacherVid.src = URL.createObjectURL(file);
        teacherVid.play();
    }
};

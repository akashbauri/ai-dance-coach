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

// Screen Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const userTag = document.getElementById('user-tag');

// Logic for Success
const goInside = (name) => {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    userTag.innerText = `👤 ${name.toUpperCase()}`;
    startAI();
};

// 1. Google Login
document.getElementById('google-btn').onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((res) => goInside(res.user.displayName))
        .catch((err) => alert("Google Help: Ensure your domain is added in Firebase!"));

};

// 2. Email/Password Login
document.getElementById('email-btn').onclick = () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('pass-input').value;
    
    auth.signInWithEmailAndPassword(email, pass)
        .then((res) => goInside(res.user.email))
        .catch((err) => {
            if(err.code === 'auth/user-not-found') {
                auth.createUserWithEmailAndPassword(email, pass).then((res) => goInside(res.user.email));
            } else { alert(err.message); }
        });
};

// AI Vision Logic
const userVid = document.getElementById('user-vid');
const teacherVid = document.getElementById('teacher-vid');
const canvas = document.getElementById('pose-canvas');
const ctx = canvas.getContext('2d');

const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

pose.onResults((res) => {
    canvas.width = userVid.clientWidth;
    canvas.height = userVid.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (res.poseLandmarks) {
        drawConnectors(ctx, res.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        drawLandmarks(ctx, res.poseLandmarks, {color: '#FF0000', radius: 4});
        
        let score = Math.round(res.poseLandmarks[0].visibility * 100);
        document.getElementById('accuracy-txt').innerText = `${score}%`;
        document.getElementById('acc-bar').style.width = `${score}%`;
    }
});

async function startAI() {
    const camera = new Camera(userVid, {
        onFrame: async () => { await pose.send({image: userVid}); },
        width: 1280, height: 720
    });
    camera.start();
}

document.getElementById('vid-upload').onchange = (e) => {
    teacherVid.src = URL.createObjectURL(e.target.files[0]);
    teacherVid.play();
};

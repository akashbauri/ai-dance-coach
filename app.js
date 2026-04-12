// 1. YOUR UPDATED FIREBASE CONFIG
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

// 2. CONNECTING THE BUTTONS
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const googleBtn = document.getElementById('google-btn'); // Matching your HTML
const emailBtn = document.getElementById('email-btn');

// This function hides the login and shows the app
function showApp(userName) {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    console.log("Welcome, " + userName);
}

// FIX: GOOGLE SIGN-IN BUTTON
if (googleBtn) {
    googleBtn.onclick = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => showApp(result.user.displayName))
            .catch((error) => {
                alert("Error: " + error.message);
                console.error(error);
            });
    };
}

// FIX: EMAIL/PASSWORD LOGIN
if (emailBtn) {
    emailBtn.onclick = () => {
        const email = document.getElementById('email-input').value;
        const pass = document.getElementById('pass-input').value;

        auth.signInWithEmailAndPassword(email, pass)
            .then((res) => showApp(res.user.email))
            .catch((err) => {
                // If the user doesn't exist yet, create them automatically
                if (err.code === 'auth/user-not-found') {
                    auth.createUserWithEmailAndPassword(email, pass)
                        .then((res) => showApp(res.user.email))
                        .catch((e) => alert(e.message));
                } else {
                    alert(err.message);
                }
            });
    };
}

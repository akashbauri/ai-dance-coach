const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const teacherVideo = document.getElementById('teacherVideo');

let teacherPoses = [];
let scores = [];

function handleLogin() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    initCamera();
}

function initCamera() {
    const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
    pose.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => { await pose.send({image: videoElement}); },
        width: 640, height: 480
    });
    camera.start();
}

async function trainTeacher() {
    if(!teacherVideo.src) return alert("Upload video first!");
    teacherPoses = [];
    teacherVideo.play();
    const trainer = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    trainer.onResults(res => { if(res.poseLandmarks) teacherPoses.push(res.poseLandmarks); });

    const check = setInterval(async () => {
        if(teacherVideo.ended || teacherVideo.paused) {
            clearInterval(check);
            document.getElementById('startBtn').disabled = false;
            alert("Training Complete!");
        } else { await trainer.send({image: teacherVideo}); }
    }, 100);
}

function startDancing() {
    teacherVideo.currentTime = 0;
    teacherVideo.muted = false; // Sound enabled
    teacherVideo.play();
}

// 🎯 UPDATED REAL-TIME COMPARISON WITH SKELETON
function onResults(results) {
    // Clear the canvas and draw the new webcam frame
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        let student = normalizePose(results.poseLandmarks);
        let teacher = normalizePose(teacherPoses[Math.min(frameIndex, teacherPoses.length - 1)]);

        // 1. DRAW THE SKELETON (White lines connecting joints)
        // This uses the POSE_CONNECTIONS map from MediaPipe to draw the body structure
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#FFFFFF', 
            lineWidth: 2
        });

        // 2. DRAW COLORED JOINTS (Feedback dots)
        for (let i = 0; i < results.poseLandmarks.length; i++) {
            let dx = student[i].x - teacher[i].x;
            let dy = student[i].y - teacher[i].y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            // Change dot color based on accuracy distance
            let color = dist > 0.1 ? "red" : "green";

            drawLandmarks(canvasCtx, [results.poseLandmarks[i]], {
                color: color,
                fillColor: color,
                lineWidth: 2,
                radius: 4 // Slightly larger for better visibility
            });
        }

        // 3. UPDATE METRICS
        let error = poseDistance(student, teacher);
        let score = Math.max(0, 100 - error * 200);

        accuracyText.innerText = score.toFixed(1) + "%";
        errorText.innerText = error.toFixed(4);
        gauge.style.width = score + "%";

        feedbackText.innerText =
            score > 90 ? "🔥 Perfect" :
            score > 75 ? "👍 Good" :
            score > 60 ? "⚠ Adjust arms" :
            "❌ Incorrect pose";

        frameIndex++;

        // 4. LATENCY TRACKING
        let latency = performance.now() - startTime;
        latencyText.innerText = latency.toFixed(0) + " ms";
    }
    canvasCtx.restore();
}
}

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

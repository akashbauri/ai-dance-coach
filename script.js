const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const accuracyText = document.getElementById("accuracy");
const feedbackText = document.getElementById("feedback");
const gauge = document.getElementById("gauge-fill");
const teacherVideo = document.getElementById("teacherVideo");

let teacherPoses = [];
let frameIndex = 0;
let sessionScores = [];

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

// 1. DEDICATED TRAINING FUNCTION
async function trainTeacher() {
    if (!teacherVideo.src) return alert("Please upload a video first!");
    feedbackText.innerText = "Analyzing Teacher... Please wait.";
    teacherPoses = [];
    
    const poseDetector = new Pose({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
    });
    poseDetector.setOptions({ modelComplexity: 1 });
    poseDetector.onResults((res) => {
        if (res.poseLandmarks) teacherPoses.push(res.poseLandmarks);
    });

    teacherVideo.play();
    const stream = teacherVideo.captureStream ? teacherVideo.captureStream() : null;
    
    // Process frames while video plays
    const interval = setInterval(async () => {
        if (teacherVideo.paused || teacherVideo.ended) {
            clearInterval(interval);
            feedbackText.innerText = "Training Complete! Click Start.";
            document.getElementById("startBtn").disabled = false;
            return;
        }
        await poseDetector.send({ image: teacherVideo });
    }, 100);
}

// 2. START WEBCAM & COMPARISON
function startTraining() {
    frameIndex = 0;
    sessionScores = [];
    
    const pose = new Pose({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
    });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
    pose.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => { await pose.send({ image: videoElement }); },
        width: 640, height: 480
    });
    camera.start();
    teacherVideo.currentTime = 0;
    teacherVideo.play();
}

// 3. FIX SKELETON & COLORED JOINTS
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        let currentTeacherPose = teacherPoses[Math.min(frameIndex, teacherPoses.length - 1)];

        // DRAW SKELETON CONNECTIONS (White/Gray)
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#FFFFFF', lineWidth: 2});

        let frameError = 0;
        results.poseLandmarks.forEach((landmark, i) => {
            const t = currentTeacherPose[i];
            const dist = Math.hypot(landmark.x - t.x, landmark.y - t.y);
            frameError += dist;

            // DRAW JOINTS (Red if far, Green if close)
            const jointColor = dist < 0.1 ? "#00FF00" : "#FF0000";
            drawLandmarks(canvasCtx, [landmark], {color: jointColor, fillColor: jointColor, radius: 4});
        });

        const score = Math.max(0, 100 - (frameError * 5));
        accuracyText.innerText = Math.floor(score) + "%";
        gauge.style.width = score + "%";
        sessionScores.push(score);

        frameIndex++;
    }
    canvasCtx.restore();
}

// 4. DOWNLOAD RESULT
window.downloadReport = () => {
    if (sessionScores.length === 0) return alert("No session data found!");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const avgScore = sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length;
    
    doc.setFontSize(20);
    doc.text("AI Dance Coach PRO - Report", 20, 20);
    doc.setFontSize(14);
    doc.text(`Average Accuracy: ${Math.floor(avgScore)}%`, 20, 40);
    doc.text(`Total Frames Analyzed: ${sessionScores.length}`, 20, 50);
    doc.save("dance-result.pdf");
};

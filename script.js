const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const accuracyText = document.getElementById("accuracy");
const errorText = document.getElementById("error");
const feedbackText = document.getElementById("feedback");
const gauge = document.getElementById("gauge-fill");
const latencyText = document.getElementById("latency");

const teacherVideo = document.getElementById("teacherVideo");

let teacherPoses = [];
let frameIndex = 0;
let startTime = 0;

// ✅ FILE UPLOAD HANDLER
document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

// ✅ HELPER: CLONE LANDMARKS
function clonePose(p) {
    return p.map(x => ({ x: x.x, y: x.y }));
}

// ✅ NORMALIZATION: Keeps comparison fair regardless of distance from camera
function normalizePose(pose) {
    let ls = pose[11], rs = pose[12];
    let cx = (ls.x + rs.x) / 2;
    let cy = (ls.y + rs.y) / 2;
    let scale = Math.hypot(ls.x - rs.x, ls.y - rs.y);

    return pose.map(p => ({
        x: (p.x - cx) / scale,
        y: (p.y - cy) / scale
    }));
}

// ✅ POSE DISTANCE: Calculates how far you are from the teacher
function poseDistance(p1, p2) {
    let sum = 0;
    for (let i = 0; i < p1.length; i++) {
        let dx = p1[i].x - p2[i].x;
        let dy = p1[i].y - p2[i].y;
        sum += Math.sqrt(dx * dx + dy * dy);
    }
    return sum / p1.length;
}

// ✅ EXTRACT TEACHER POSES: Analyzes the uploaded video
async function extractTeacherPoses() {
    teacherPoses = [];
    return new Promise(resolve => {
        const poseDetector = new Pose({
            locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
        });
        poseDetector.setOptions({ modelComplexity: 1 });
        poseDetector.onResults(res => {
            if (res.poseLandmarks) {
                teacherPoses.push(clonePose(res.poseLandmarks));
            }
        });

        teacherVideo.onplay = async () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            async function process() {
                if (teacherVideo.paused || teacherVideo.ended) {
                    resolve();
                    return;
                }
                canvas.width = teacherVideo.videoWidth;
                canvas.height = teacherVideo.videoHeight;
                ctx.drawImage(teacherVideo, 0, 0);
                await poseDetector.send({ image: canvas });
                requestAnimationFrame(process);
            }
            process();
        };
        teacherVideo.play();
    });
}

// ✅ START TRAINING: Triggered by button click
async function startTraining() {
    if (!teacherVideo.src) {
        alert("Please upload a video first!");
        return;
    }
    feedbackText.innerText = "Processing teacher...";
    await extractTeacherPoses();
    feedbackText.innerText = "Start dancing!";
    frameIndex = 0;
    startWebcam(); // Now browser will ask for permission
}

// ✅ WEBCAM INITIALIZATION
function startWebcam() {
    const pose = new Pose({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
    });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
    pose.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            startTime = performance.now();
            await pose.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    camera.start();
}

// ✅ 🎯 REAL-TIME DRAWING & COMPARISON
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw the live camera feed
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        let student = normalizePose(results.poseLandmarks);
        let teacher = normalizePose(teacherPoses[Math.min(frameIndex, teacherPoses.length - 1)]);

        // 1. DRAW SKELETON (White connecting lines)
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#FFFFFF',
            lineWidth: 2
        });

        // 2. DRAW COLORED JOINTS & CALCULATE ACCURACY
        for (let i = 0; i < results.poseLandmarks.length; i++) {
            let dx = student[i].x - teacher[i].x;
            let dy = student[i].y - teacher[i].y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            // Change dot color: Green for close, Red for far
            let color = dist > 0.1 ? "red" : "green";

            drawLandmarks(canvasCtx, [results.poseLandmarks[i]], {
                color: color,
                fillColor: color,
                lineWidth: 2,
                radius: 4
            });
        }

        // 3. UPDATE UI
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

        // ⏱ LATENCY
        let latency = performance.now() - startTime;
        latencyText.innerText = latency.toFixed(0) + " ms";
    }
    canvasCtx.restore();
}

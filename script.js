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

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks && teacherPoses.length > 0) {
        const frameIdx = Math.floor(teacherVideo.currentTime * 30);
        const tPose = teacherPoses[Math.min(frameIdx, teacherPoses.length - 1)];

        if(tPose) {
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#FFFFFF', lineWidth: 2});
            results.poseLandmarks.forEach((lm, i) => {
                const dist = Math.hypot(lm.x - tPose[i].x, lm.y - tPose[i].y);
                const color = dist < 0.12 ? "#22c55e" : "#ef4444";
                drawLandmarks(canvasCtx, [lm], {color: color, fillColor: color, radius: 4});
            });
        }
    }
    canvasCtx.restore();
}

document.getElementById("uploadVideo").onchange = (e) => {
    teacherVideo.src = URL.createObjectURL(e.target.files[0]);
};

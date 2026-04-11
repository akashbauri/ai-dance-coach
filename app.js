const videoElement = document.getElementById("userVideo");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let userLandmarks = null;
let teacherLandmarks = null;

// 🔥 MEDIAPIPE SETUP
const pose = new Pose({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// 🎯 RESULTS CALLBACK
pose.onResults((results) => {

  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw video
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    userLandmarks = results.poseLandmarks;

    drawSkeleton(results.poseLandmarks);
    calculateAccuracy();
  }
});

// 🎥 CAMERA
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

camera.start();


// 🔴 DRAW SKELETON
function drawSkeleton(landmarks) {

  // RED POINTS
  landmarks.forEach((lm) => {
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
  });

  // GREEN LINES
  const connections = [
    [11,13],[13,15],
    [12,14],[14,16],
    [11,12],
    [23,24],
    [11,23],[12,24],
    [23,25],[25,27],
    [24,26],[26,28]
  ];

  connections.forEach(([a, b]) => {
    const p1 = landmarks[a];
    const p2 = landmarks[b];

    ctx.beginPath();
    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
    ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}


// 🎯 ACCURACY CALCULATION (BASIC VERSION)
function calculateAccuracy() {
  if (!userLandmarks || !teacherLandmarks) return;

  let error = 0;

  for (let i = 0; i < userLandmarks.length; i++) {
    let dx = userLandmarks[i].x - teacherLandmarks[i].x;
    let dy = userLandmarks[i].y - teacherLandmarks[i].y;

    error += Math.sqrt(dx * dx + dy * dy);
  }

  let score = Math.max(0, 100 - error * 100);

  document.getElementById("accuracy").innerText =
    "Accuracy: " + score.toFixed(2) + "%";
}

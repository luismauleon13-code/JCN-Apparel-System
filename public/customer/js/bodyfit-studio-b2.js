
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const $ = id => document.getElementById(id);

const SIZES = [
  { size: "XS", width: 53.34, length: 68.58 },
  { size: "S", width: 55.88, length: 71.12 },
  { size: "M", width: 58.42, length: 73.66 },
  { size: "L", width: 60.96, length: 76.20 },
  { size: "XL", width: 63.50, length: 78.74 },
  { size: "2XL", width: 66.04, length: 81.28 },
  { size: "3XL", width: 68.58, length: 83.82 }
];

// Example size chart. Replace with actual JCN product measurements.
const state = {
  pose: null,
  poseResult: null,
  stream: null,
  front: null,
  side: null,
  photo: null,
  photoUrl: null,
  logoUrl: null,
  estimate: null,
  rotation: 0
};

const video = $("camera");
const overlay = $("overlay");
const status = $("status");

function say(message) {
  status.textContent = message;
}

// ===================================================
// MEDIAPIPE BODY SCANNING
// ===================================================

async function poseEngine() {
  if (state.pose) return state.pose;

  const { PoseLandmarker, FilesetResolver } =
    await import("../assets/mediapipe/vision_bundle.mjs");

  const files = await FilesetResolver.forVisionTasks(
    new URL("../assets/mediapipe/wasm", import.meta.url).href
  );

  state.pose = await PoseLandmarker.createFromOptions(files, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "CPU"
    },
    runningMode: "IMAGE",
    numPoses: 1
  });

  return state.pose;
}

function detected(frame) {
  const lm = frame?.landmarks?.[0];

  return Boolean(
    lm &&
    [11, 12, 23, 24].every(i =>
      (lm[i]?.visibility ?? 0) >= 0.55 &&
      lm[i].x > 0.04 &&
      lm[i].x < 0.96 &&
      lm[i].y > 0.04 &&
      lm[i].y < 0.96
    )
  );
}

function captureFrame() {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext("2d").drawImage(video, 0, 0);
  return canvas;
}

function landmarks(frame) {
  return frame.landmarks?.[0] || null;
}

function draw(lm) {
  const w = video.videoWidth;
  const h = video.videoHeight;

  overlay.width = w;
  overlay.height = h;

  const ctx = overlay.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  if (!lm) return;

  ctx.fillStyle = "#e5bd55";
  ctx.strokeStyle = "#e5bd55";
  ctx.lineWidth = 3;

  for (const [a, b] of [
    [11, 12], [11, 23], [12, 24], [23, 24]
  ]) {
    if (!lm[a] || !lm[b]) continue;

    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  }

  for (const i of [11, 12, 23, 24]) {
    if (!lm[i]) continue;

    ctx.beginPath();
    ctx.arc(lm[i].x * w, lm[i].y * h, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===================================================
// AUTOMATIC FRONT AND SIDE CAPTURE
// ===================================================

let busy = false;
let tick = 0;

const scan = {
  enabled: true,
  phase: "front",
  stableSince: 0,
  countdownSince: 0,
  nextPhaseAfter: 0
};

const stableMs = 2000;
const countdownMs = 5000;

const scanPanel = document.createElement("div");
scanPanel.id = "autoScanPanel";
scanPanel.style.cssText =
  "margin:12px 0;padding:14px;border:1px solid #785f2b;" +
  "border-radius:12px;background:#211d16;color:#f1d17c;" +
  "font:14px Arial,sans-serif;line-height:1.6";

scanPanel.innerHTML = `
  <label style="display:flex;gap:8px;align-items:center">
    <input type="checkbox" id="autoScanToggle" checked>
    Automatic front / side capture
  </label>
  <div id="autoScanMessage" role="status" aria-live="polite">
    Ready for front scan.
  </div>
  <strong id="autoScanCountdown"
    style="display:block;font-size:34px;text-align:center">
  </strong>
  <button type="button" id="retakeScan"
    style="padding:9px 15px;border-radius:7px;border:0;
    background:#e5bd55;color:#17130b;cursor:pointer">
    Retake both scans
  </button>
`;

$("stopCamera").parentElement.insertAdjacentElement(
  "afterend", scanPanel
);

const scanMessage = $("autoScanMessage");
const scanCountdown = $("autoScanCountdown");

function resetTimer() {
  scan.stableSince = 0;
  scan.countdownSince = 0;
  scanCountdown.textContent = "";
}

function setPhase(phase) {
  scan.phase = phase;
  resetTimer();

  scanMessage.textContent =
    phase === "front"
      ? "Face the camera: show shoulders through hips."
      : phase === "side"
        ? "Turn sideways: show shoulders through hips."
        : "Both scans captured! Review the estimated size.";
}

function classifyPose(lm) {
  if (!lm || ![11, 12, 23, 24].every(i =>
    (lm[i]?.visibility ?? 0) >= 0.55 &&
    lm[i].x > 0.04 && lm[i].x < 0.96 &&
    lm[i].y > 0.04 && lm[i].y < 0.96
  )) return "missing";

  const w = video.videoWidth;
  const h = video.videoHeight;

  if (!w || !h) return "unknown";

  const shoulderWidth =
    Math.abs(lm[11].x - lm[12].x) * w;

  const hipWidth =
    Math.abs(lm[23].x - lm[24].x) * w;

  const torsoHeight = (
    Math.abs(lm[11].y - lm[23].y) +
    Math.abs(lm[12].y - lm[24].y)
  ) * h / 2;

  if (torsoHeight < 30) return "unknown";

  const ratio = shoulderWidth / torsoHeight;
  const hipRatio = hipWidth / torsoHeight;

  if (ratio >= 0.48 && hipRatio >= 0.24) return "front";
  if (ratio <= 0.34 && hipRatio <= 0.32) return "side";

  return "unknown";
}

function renderScanMessage(message, seconds = "") {
  scanMessage.textContent = message;
  scanCountdown.textContent = seconds;
}

function autoScan(result, now) {
  if (
    !scan.enabled ||
    !state.stream ||
    scan.phase === "done" ||
    now < scan.nextPhaseAfter
  ) return;

  const orientation = classifyPose(landmarks(result));
  const desired = scan.phase;

  if (orientation !== desired) {
    resetTimer();

    renderScanMessage(
      orientation === "missing"
        ? "Keep shoulders and hips inside the camera frame."
        : orientation === "unknown"
          ? "Adjust your pose so the camera can determine your orientation."
          : `Detected ${orientation}. Please show ${desired} view.`
    );

    return;
  }

  if (!scan.stableSince) scan.stableSince = now;

  const elapsed = now - scan.stableSince;

  if (elapsed < stableMs) {
    renderScanMessage(
      `Hold still for ${Math.ceil((stableMs - elapsed) / 1000)}s.`
    );
    return;
  }

  if (!scan.countdownSince) scan.countdownSince = now;

  const left = Math.max(
    0,
    Math.ceil((countdownMs - (now - scan.countdownSince)) / 1000)
  );

  if (left > 0) {
    renderScanMessage(
      `Capturing your ${desired} view automatically…`,
      String(left)
    );
    return;
  }

  resetTimer();

  state[desired] = {
    frame: captureFrame(),
    result
  };

  if (desired === "front") {
    setPhase("side");
    scan.nextPhaseAfter = now + 1500;
    say("Front captured. Turn sideways for the next scan.");
  } else {
    setPhase("done");
    say("Both scans captured. Updating size recommendation.");
    recommend();
  }
}

async function frameLoop() {
  if (!state.stream) return;

  requestAnimationFrame(frameLoop);

  if (
    busy ||
    performance.now() - tick < 160 ||
    video.readyState < 2
  ) return;

  tick = performance.now();
  busy = true;

  try {
    const engine = await poseEngine();
    const result = engine.detect(video);

    state.poseResult = result;

    draw(landmarks(result));

    $("cameraState").textContent = detected(result)
      ? "Body landmarks found"
      : "Show shoulders through hips";

    autoScan(result, performance.now());
  } catch (error) {
    $("cameraState").textContent = "Pose model unavailable";
    renderScanMessage(error.message);
  } finally {
    busy = false;
  }
}

$("autoScanToggle").onchange = event => {
  scan.enabled = event.target.checked;
  resetTimer();

  scanMessage.textContent = scan.enabled
    ? "Automatic scanning enabled."
    : "Use the manual front and side buttons.";
};

$("retakeScan").onclick = () => {
  state.front = null;
  state.side = null;
  state.estimate = null;

  scan.nextPhaseAfter = 0;
  setPhase("front");

  $("sizeValue").textContent = "—";
  $("confidence").textContent = "Awaiting scan";
  $("measurements").textContent = "No new scan yet.";

  say("Ready to retake both scans.");
};

$("startCamera").onclick = async () => {
  if (state.stream) {
    say("Camera is already running.");
    return;
  }

  try {
    say("Loading pose model…");
    await poseEngine();

    state.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = state.stream;
    await video.play();

    $("front").disabled = false;
    $("side").disabled = false;

    scan.nextPhaseAfter = 0;
    setPhase(state.front ? "side" : "front");

    say("Camera ready. Stand still.");
    frameLoop();
  } catch (error) {
    say("Camera unavailable: " + error.message);
  }
};

function stop() {
  state.stream?.getTracks().forEach(track => track.stop());
  state.stream = null;

  video.srcObject = null;
  resetTimer();

  $("front").disabled = true;
  $("side").disabled = true;

  $("cameraState").textContent = "Camera off";

  overlay.getContext("2d").clearRect(
    0, 0, overlay.width, overlay.height
  );
}

$("stopCamera").onclick = stop;
window.addEventListener("pagehide", stop);

async function take(which) {
  try {
    if (!state.stream || video.readyState < 2) {
      say("Start the camera first.");
      return;
    }

    const frame = captureFrame();
    const result = (await poseEngine()).detect(frame);

    if (!detected(result)) {
      say("Include both shoulders and hips in the frame.");
      return;
    }

    if (classifyPose(landmarks(result)) !== which) {
      say(`Please show the ${which} view.`);
      return;
    }

    state[which] = { frame, result };

    if (which === "front") {
      state.side = null;
      setPhase("side");
      say("Front captured. Turn sideways.");
    } else {
      setPhase("done");
      say("Side captured. Recommendation updated.");
    }

    recommend();
  } catch (error) {
    say("Capture error: " + error.message);
  }
}

$("front").onclick = () => take("front");
$("side").onclick = () => take("side");

$("photo").onchange = async event => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 8 * 1024 * 1024
  ) {
    say("Choose JPG, PNG, or WEBP under 8 MB.");
    return;
  }

  try {
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);

    state.photoUrl = URL.createObjectURL(file);

    const img = new Image();
    img.src = state.photoUrl;

    await img.decode();

    const result = (await poseEngine()).detect(img);

    if (!detected(result)) {
      say("Shoulders and hips not detected.");
      return;
    }

    state.front = { frame: img, result };

    $("photoPreview").src = state.photoUrl;
    $("photoPreview").hidden = false;

    recommend();
  } catch (error) {
    say("Photo analysis failed: " + error.message);
  }
};

// ===================================================
// SIZE RECOMMENDATION
// ===================================================

function recommend() {
  const height = Number($("heightCm").value);
  const chest = Number($("manualChest").value);
  const width = Number($("manualWidth").value);
  const fit = $("fit").value;

  if (!Number.isFinite(height) || height < 110 || height > 230) {
    say("Enter a valid height between 110 and 230 cm.");
    return;
  }

  let target;
  let quality;
  let note;
  let method;

  if (width >= 30 && width <= 100) {
    target = width + (
      fit === "loose" ? 3 : fit === "slim" ? -1 : 0
    );

    quality = "Manual garment width";
    note = "Compared against the example size chart.";
    method = "manual_shirt_width";
  } else if (chest >= 50 && chest <= 180) {
    target = chest / 2 + (
      fit === "loose" ? 11 : fit === "slim" ? 5 : 8
    );

    quality = "Manual chest measurement";
    note = "Approximate garment ease included.";
    method = "manual_chest";
  } else if (state.front) {
    const lm = landmarks(state.front.result);

    if (!lm || !detected(state.front.result)) {
      say("Retake the front scan.");
      return;
    }

    const aspect =
      state.front.frame.width / state.front.frame.height ||
      1;

    const shoulderSpan =
      Math.abs(lm[11].x - lm[12].x) * aspect;

    const torso = (
      Math.hypot(
        (lm[11].x - lm[23].x) * aspect,
        lm[11].y - lm[23].y
      ) +
      Math.hypot(
        (lm[12].x - lm[24].x) * aspect,
        lm[12].y - lm[24].y
      )
    ) / 2;

    if (torso < 0.08) {
      say("Torso is not clear enough. Retake scan.");
      return;
    }

    const proportion = shoulderSpan / torso;

    target = THREE.MathUtils.clamp(
      58.42 +
      (proportion - 1.15) * 8 +
      (fit === "loose" ? 3 : fit === "slim" ? -1 : 0),
      53.34,
      68.58
    );

    quality = "Very low confidence — camera heuristic";
    note =
      "Camera landmarks cannot measure actual chest circumference. " +
      "Verify with manual measurements.";

    method = "pose_heuristic_upper_body";
  } else {
    say("Capture a front scan or enter manual measurements.");
    return;
  }

  const selected =
    SIZES.find(item => item.width >= target) ||
    SIZES[SIZES.length - 1];

  state.estimate = {
    size: selected.size,
    targetWidth: Math.round(target * 10) / 10,
    confidence: quality,
    heightCm: height,
    method,
    frontCaptured: Boolean(state.front),
    sideCaptured: Boolean(state.side)
  };

  $("sizeValue").textContent = selected.size;
  $("confidence").textContent = quality;

  $("measurements").textContent =
    note +
    ` Suggested width: ${target.toFixed(1)} cm. ` +
    `Size ${selected.size}: ${selected.width.toFixed(1)} cm. ` +
    "Verify against actual JCN product measurements.";

  $("selectedSize").value = selected.size;

  updateShape();

  window.dispatchEvent(new CustomEvent(
    "jcn:size-recommended",
    { detail: { ...state.estimate } }
  ));
}

$("estimate").onclick = recommend;

["heightCm", "fit", "manualChest", "manualWidth"].forEach(id => {
  $(id).addEventListener("change", () => {
    if (
      state.front ||
      $("manualChest").value ||
      $("manualWidth").value
    ) recommend();
  });
});

// ===================================================
// THREE.JS REALISTIC AVATAR VIEWER
// ===================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color("#d9dad1");

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 1.5, 6.8);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio || 1, 2)
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

$("viewer").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(
  0xffffff, 0x4a4036, 2.3
));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(3, 7, 8);
scene.add(light);

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;
controls.target.set(0, 1, 0);
controls.minDistance = 1.5;
controls.maxDistance = 12;
controls.enablePan = false;

// ===================================================
// DEMO MANNEQUIN — FALLBACK ONLY
// ===================================================

const skin = new THREE.MeshStandardMaterial({
  color: 0xc89473,
  roughness: 0.88
});

const shirtMat = new THREE.MeshStandardMaterial({
  color: $("shirtColor").value,
  roughness: 0.86,
  side: THREE.DoubleSide
});

const person = new THREE.Group();
scene.add(person);

function oval(rx, ry, rz, y, material) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 18),
    material
  );

  mesh.scale.set(rx, ry, rz);
  mesh.position.y = y;
  person.add(mesh);

  return mesh;
}

oval(0.23, 0.30, 0.22, 2.71, skin);
oval(0.14, 0.14, 0.14, 2.34, skin);
oval(0.39, 0.63, 0.21, 0.24, skin);

for (const x of [-0.22, 0.22]) {
  const leg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.12, 1.3, 16),
    skin
  );

  leg.position.set(x, -0.75, 0);
  person.add(leg);
}

const torso = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 0.48, 1.2, 8, 1),
  shirtMat
);

torso.position.y = 1.49;
person.add(torso);

const sleeves = [];

for (const x of [-1, 1]) {
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.21, 0.55, 12),
    shirtMat
  );

  sleeve.rotation.z = x * 0.7;
  sleeve.position.set(x * 0.7, 1.86, 0);

  person.add(sleeve);
  sleeves.push(sleeve);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.11, 0.82, 16),
    skin
  );

  arm.rotation.z = x * 0.13;
  arm.position.set(x * 0.78, 1.12, 0);

  person.add(arm);
}

const artMat = new THREE.MeshBasicMaterial({
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false
});

const art = new THREE.Mesh(
  new THREE.PlaneGeometry(0.68, 0.55),
  artMat
);

art.position.set(0, 1.57, 0.57);
person.add(art);

// ===================================================
// REALISTIC GLB AVATAR LOADER
// ===================================================

const AVATAR_URL = new URL(
  "../assets/models/avatar/jcn-avatar.glb",
  import.meta.url
).href;

const gltfLoader = new GLTFLoader();

let avatarRoot = null;
let avatarIsLoading = false;

const avatarStatus = $("avatarStatus");
const avatarUpload = $("avatarUpload");
const reloadAvatar = $("reloadAvatar");

if (!avatarStatus || !avatarUpload || !reloadAvatar) {
  throw new Error(
    "Missing avatarStatus, avatarUpload or reloadAvatar."
  );
}

avatarStatus.textContent = "Checking for jcn-avatar.glb…";

function disposeAvatar() {
  if (!avatarRoot) return;

  scene.remove(avatarRoot);

  avatarRoot.traverse(obj => {
    if (!obj.isMesh) return;

    obj.geometry?.dispose();

    const materials = Array.isArray(obj.material)
      ? obj.material
      : [obj.material];

    for (const material of materials) {
      if (!material) continue;

      for (const prop of [
        "map", "normalMap", "roughnessMap",
        "metalnessMap", "emissiveMap", "aoMap"
      ]) {
        material[prop]?.dispose();
      }

      material.dispose();
    }
  });

  avatarRoot = null;
}

function showDemo(message = "Demo mannequin active.") {
  disposeAvatar();

  person.visible = true;

  camera.position.set(0, 1.5, 6.8);
  controls.target.set(0, 1, 0);
  controls.update();

  avatarStatus.textContent = message;
}

function fitAvatar(rawScene) {
  const bbox = new THREE.Box3().setFromObject(rawScene);

  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());

  const longest = Math.max(size.x, size.y, size.z);

  if (!Number.isFinite(longest) || longest <= 0.0001) {
    throw new Error("GLB has no visible geometry.");
  }

  const fitted = new THREE.Group();

  rawScene.position.sub(center);
  rawScene.scale.setScalar(3.5 / longest);

  fitted.add(rawScene);
  fitted.position.y = 0.6;

  return fitted;
}

function frameAvatar() {
  if (!avatarRoot) return;

  const el = $("viewer");
  const width = el.clientWidth;
  const height = el.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  avatarRoot.updateMatrixWorld(true);

  const bbox = new THREE.Box3().setFromObject(avatarRoot);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());

  const values = [
    size.x, size.y, size.z,
    center.x, center.y, center.z
  ];

  if (!values.every(Number.isFinite)) {
    throw new Error("Invalid avatar bounding box.");
  }

  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(
    Math.tan(vfov / 2) * camera.aspect
  );

  const verticalDistance =
    (size.y / 2) / Math.tan(vfov / 2);

  const horizontalDistance =
    (size.x / 2) / Math.tan(hfov / 2);

  const distance =
    Math.max(verticalDistance, horizontalDistance, 2) *
    1.25 + size.z / 2;

  controls.target.copy(center);

  camera.position.set(
    center.x,
    center.y,
    center.z + distance
  );

  camera.near = Math.max(0.01, distance / 100);
  camera.far = Math.max(100, distance * 20);
  camera.updateProjectionMatrix();

  controls.minDistance = 0.8;
  controls.maxDistance = Math.max(12, distance * 4);
  controls.update();
}

// ===================================================
// FRESH BINARY FETCH + GLB VALIDATION
// ===================================================

async function getFreshProjectAvatarBlobUrl(sourceUrl) {
  const freshUrl = new URL(sourceUrl, window.location.href);

  freshUrl.searchParams.set(
    "jcn_cache_bust",
    String(Date.now())
  );

  const response = await fetch(freshUrl.href, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `GLB download failed: HTTP ${response.status}`
    );
  }

  const data = await response.arrayBuffer();
  const length = data.byteLength;

  if (length < 20) {
    throw new Error(
      `Incomplete GLB response: ${length} bytes`
    );
  }

  const view = new DataView(data);

  const magic = String.fromCharCode(
    ...new Uint8Array(data, 0, 4)
  );

  const version = view.getUint32(4, true);
  const declaredLength = view.getUint32(8, true);

  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);

  if (magic !== "glTF" || version !== 2) {
    throw new Error(
      `Invalid GLB header: ${magic}, version ${version}`
    );
  }

  if (declaredLength !== length) {
    throw new Error(
      `GLB length mismatch: actual ${length}, ` +
      `declared ${declaredLength}`
    );
  }

  if (
    jsonType !== 0x4e4f534a ||
    jsonLength < 2 ||
    20 + jsonLength > length
  ) {
    throw new Error(
      `Invalid GLB JSON chunk: ${jsonLength} bytes`
    );
  }

  const secondChunkOffset = 20 + jsonLength;

  if (secondChunkOffset < length) {
    if (secondChunkOffset + 8 > length) {
      throw new Error("Incomplete binary chunk header.");
    }

    const binaryLength = view.getUint32(
      secondChunkOffset,
      true
    );

    if (secondChunkOffset + 8 + binaryLength > length) {
      throw new Error(
        `Incomplete GLB binary chunk: ${binaryLength} bytes`
      );
    }
  }

  console.info(
    `[JCN Avatar] Fresh GLB downloaded: ` +
    `${length} bytes; header OK.`
  );

  avatarStatus.textContent =
    `Downloaded ${(length / 1048576).toFixed(1)} MB; ` +
    "loading realistic avatar…";

  const blob = new Blob([data], {
    type: "model/gltf-binary"
  });

  return URL.createObjectURL(blob);
}

// ===================================================
// LOAD REALISTIC AVATAR
// ===================================================

async function loadAvatar(
  url,
  label,
  { projectFile = false } = {}
) {
  if (avatarIsLoading) return;

  avatarIsLoading = true;
  avatarStatus.textContent = `Loading ${label}…`;

  let freshObjectUrl = null;

  try {
    if (projectFile) {
      freshObjectUrl =
        await getFreshProjectAvatarBlobUrl(url);
    }

    const gltf = await gltfLoader.loadAsync(
      freshObjectUrl || url
    );

    const root = fitAvatar(gltf.scene);

    disposeAvatar();

    avatarRoot = root;
    scene.add(root);

    person.visible = false;

    studioSetupAvatar(gltf.scene);
    syncAvatarSize();
    studioApplyBodyPreview();
    studioUpdateDesign();

    try {
      frameAvatar();
    } catch (error) {
      console.warn("Camera framing fallback:", error);

      camera.position.set(0, 1.5, 7.5);
      controls.target.set(0, 0.6, 0);
      controls.update();
    }

    avatarStatus.textContent =
      `${label} loaded! Drag to rotate 360°.`;

    window.dispatchEvent(new CustomEvent(
      "jcn:avatar-ready",
      { detail: { label } }
    ));
  } catch (error) {
    console.error("JCN avatar load failed:", error);

    if (!avatarRoot) {
      showDemo(
        "Realistic avatar unavailable: " + error.message
      );
    } else {
      avatarStatus.textContent =
        "Could not replace avatar: " + error.message;
    }
  } finally {
    if (freshObjectUrl) {
      URL.revokeObjectURL(freshObjectUrl);
    }

    avatarIsLoading = false;
  }
}

function syncAvatarSize() {
  if (!avatarRoot) return;

  const index = SIZES.findIndex(
    item => item.size === $("selectedSize").value
  );

  const factor = index >= 0
    ? 1 + (index - 2) * 0.025
    : 1;

  avatarRoot.scale.set(factor, 1, factor);
}

function updateShape() {
  const index = SIZES.findIndex(
    item => item.size === $("selectedSize").value
  );

  const factor = index >= 0
    ? 0.86 + index * 0.052
    : 1;

  torso.scale.set(factor, 1, factor);
  sleeves[0].position.x = -0.7 * factor;
  sleeves[1].position.x = 0.7 * factor;
  art.position.z = 0.59 * factor;

  syncAvatarSize();
}

reloadAvatar.onclick = () => {
  loadAvatar(
    AVATAR_URL,
    "jcn-avatar.glb",
    { projectFile: true }
  );
};

avatarUpload.onchange = async event => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (
    !file.name.toLowerCase().endsWith(".glb") ||
    file.size > 75 * 1024 * 1024
  ) {
    avatarStatus.textContent =
      "Choose a GLB file smaller than 75 MB.";
    return;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    await loadAvatar(objectUrl, file.name);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

// ===================================================
// SHIRT COLOR AND ARTWORK
// ===================================================

$("shirtColor").oninput = event => {
  shirtMat.color.set(event.target.value);
};

$("selectedSize").onchange = updateShape;

function drawArt() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 384;

  const ctx = canvas.getContext("2d");

  const finish = () => {
    if (artMat.map) artMat.map.dispose();

    artMat.map = new THREE.CanvasTexture(canvas);
    artMat.needsUpdate = true;
  };

  const title = $("printText").value.trim();

  const putText = () => {
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.font = "bold 42px Arial";

    ctx.fillText(title.slice(0, 25), 256, 330, 470);
    finish();
  };

  if (state.logoUrl) {
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 156, 40, 200, 220);
      putText();
    };

    img.src = state.logoUrl;
  } else {
    putText();
  }
}

$("printText").addEventListener("input", drawArt);

$("logo").onchange = event => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (
    !/^image\/(png|jpeg|webp)$/.test(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    $("saveStatus").textContent =
      "Logo must be JPG, PNG, or WEBP under 5 MB.";
    return;
  }

  if (state.logoUrl) URL.revokeObjectURL(state.logoUrl);

  state.logoUrl = URL.createObjectURL(file);

  $("artPreview").src = state.logoUrl;
  $("artPreview").hidden = false;

  drawArt();
};

// ===================================================
// VIEWER CONTROLS
// ===================================================

$("resetView").onclick = () => {
  if (avatarRoot) {
    try {
      frameAvatar();
    } catch (error) {
      console.warn("Reset view fallback:", error);
    }
  } else {
    camera.position.set(0, 1.5, 6.8);
    controls.target.set(0, 1, 0);
    controls.update();
  }
};

let previousViewerAspect = 0;

const resizeObserver = new ResizeObserver(() => {
  const el = $("viewer");

  const width = el.clientWidth;
  const height = el.clientHeight;

  if (!width || !height) return;

  const nextAspect = width / height;

  camera.aspect = nextAspect;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

  if (
    avatarRoot &&
    Math.abs(previousViewerAspect - nextAspect) > 0.025
  ) {
    try {
      frameAvatar();
    } catch (error) {
      console.warn("Resize framing fallback:", error);
    }
  }

  previousViewerAspect = nextAspect;
});

resizeObserver.observe($("viewer"));

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ===================================================
// START VIEWER AND AUTO-LOAD GLB
// ===================================================

updateShape();
drawArt();
animate();

loadAvatar(
  AVATAR_URL,
  "jcn-avatar.glb",
  { projectFile: true }
);

// ===================================================
// SAVE BODYFIT DESIGN
// ===================================================

$("save").onclick = async () => {
  const target = $("saveStatus");

  const token = localStorage.getItem("customerToken");

  if (!token) {
    target.textContent =
      "Log in as a customer before saving.";
    return;
  }

  const body = {
    size: $("selectedSize").value,
    shirt_color: $("shirtColor").value,
    print_text: $("printText").value.trim(),
    fit: $("fit").value,
    height_cm: Number($("heightCm").value),
    recommendation: state.estimate
  };

  try {
    const response = await fetch(
      "/api/customer/bodyfit-designs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Save failed");
    }

    target.textContent =
      "Saved successfully. Design ID: " + data.id;
  } catch (error) {
    target.textContent =
      "Unable to save: " + error.message;
  }
};

// ===================================================
// JCN PERSONAL FIT STUDIO BRIDGE
// ===================================================

let studioClothing = null;
let studioBodyMorphs = [];
let studioActiveScene = null;
let studioFrontPlane = null;
let studioBackPlane = null;

let studioDesiredDesign = {
  color: "#161616",
  frontText: "",
  backText: "",
  frontImage: null,
  backImage: null,
  frontSize: "none",
  backSize: "none"
};

const studioTint = new THREE.Color("#161616");

function studioSetupAvatar(rawScene) {
  studioActiveScene = rawScene;
  studioClothing = null;
  studioBodyMorphs = [];
  studioFrontPlane = null;
  studioBackPlane = null;

  rawScene.traverse(obj => {
    if (!obj.isMesh) return;

    const materialName = Array.isArray(obj.material)
      ? obj.material.map(m => m?.name || "").join(" ")
      : obj.material?.name || "";

    const name =
      `${obj.name} ${materialName}`.toLowerCase();

    const isClothing =
      /casualsuit|clothes|garment|shirt/.test(name);

    const isBody =
      /base\.|_base|human\.body|body_mesh/.test(name) ||
      (name.includes("base") && !isClothing);

    if (isClothing || isBody) {
      obj.geometry = obj.geometry.clone();

      const attr = obj.geometry.getAttribute("position");

      if (attr) {
        studioBodyMorphs.push({
          mesh: obj,
          original: new Float32Array(attr.array),
          attr
        });
      }
    }

    if (isClothing && !studioClothing) {
      studioClothing = obj;

      const originals = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];

      const newMaterials = originals.map(material => {
        const copy = material.clone();
        const originalBeforeCompile = copy.onBeforeCompile;

        copy.onBeforeCompile = shader => {
          if (originalBeforeCompile) {
            originalBeforeCompile(shader);
          }

          shader.uniforms.jcnShirtTint = {
            value: studioTint
          };

          shader.vertexShader = shader.vertexShader
            .replace(
              "#include <common>",
              "#include <common>\nvarying float vJcnLocalHeight;"
            )
            .replace(
              "#include <begin_vertex>",
              "#include <begin_vertex>\nvJcnLocalHeight = position.y;"
            );

          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              "#include <common>\nvarying float vJcnLocalHeight;\nuniform vec3 jcnShirtTint;"
            )
            .replace(
              "#include <color_fragment>",
              "#include <color_fragment>\nfloat shirtMask = smoothstep(0.82, 0.94, vJcnLocalHeight);\ndiffuseColor.rgb = mix(diffuseColor.rgb, jcnShirtTint, shirtMask * 0.96);"
            );
        };

        copy.customProgramCacheKey =
          () => "JCNStudioShirtTintV2";

        copy.needsUpdate = true;

        return copy;
      });

      obj.material = Array.isArray(obj.material)
        ? newMaterials
        : newMaterials[0];
    }
  });

  // These print-plane positions are approximate for
  // the existing MakeHuman casualsuit model.
  function createPrintPlane(side) {
    const canvas = document.createElement("canvas");

    canvas.width = 512;
    canvas.height = 512;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.30),
      material
    );

    mesh.position.set(
      0,
      1.18,
      side === "front" ? 0.195 : -0.139
    );

    if (side === "back") {
      mesh.rotation.y = Math.PI;
    }

    mesh.visible = false;
    mesh.renderOrder = 30;

    rawScene.add(mesh);

    return { mesh, texture, canvas };
  }

  studioFrontPlane = createPrintPlane("front");
  studioBackPlane = createPrintPlane("back");
}

// ===================================================
// BODY PROPORTION PREVIEW (APPROXIMATION ONLY)
// ===================================================

function studioApplyBodyPreview() {
  if (!avatarRoot) return;

  const chest = Number($("manualChest").value);
  const recommendedWidth =
    state.estimate?.targetWidth || 58.42;

  const chestFactor =
    chest >= 50 && chest <= 180
      ? THREE.MathUtils.clamp(chest / 96, 0.88, 1.14)
      : THREE.MathUtils.clamp(
          recommendedWidth / 58.42,
          0.93,
          1.08
        );

  const depthFactor =
    1 + (chestFactor - 1) * 0.65;

  for (const {
    mesh,
    original,
    attr
  } of studioBodyMorphs) {
    for (let i = 0; i < attr.count; i++) {
      const y = original[i * 3 + 1];

      const start = THREE.MathUtils.smoothstep(
        y, 0.69, 0.96
      );

      const end = 1 - THREE.MathUtils.smoothstep(
        y, 1.36, 1.54
      );

      const influence = start * end;

      attr.array[i * 3] =
        original[i * 3] *
        (1 + (chestFactor - 1) * influence);

      attr.array[i * 3 + 1] =
        original[i * 3 + 1];

      attr.array[i * 3 + 2] =
        original[i * 3 + 2] *
        (1 + (depthFactor - 1) * influence);
    }

    attr.needsUpdate = true;

    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  }

  const height = Number($("heightCm").value) || 165;

  avatarRoot.scale.y = THREE.MathUtils.clamp(
    height / 165,
    0.84,
    1.16
  );
}

// ===================================================
// LIVE FRONT / BACK PRINT
// ===================================================

async function studioPaintPlane(
  side,
  text,
  imageUrl,
  sizeKey
) {
  const target = side === "front"
    ? studioFrontPlane
    : studioBackPlane;

  if (!target) return;

  const { canvas, texture, mesh } = target;
  const ctx = canvas.getContext("2d");

  const hasText = Boolean(String(text || "").trim());
  const hasImage = Boolean(imageUrl);

  mesh.visible =
    (hasText || hasImage) && sizeKey !== "none";

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sizeMap = {
    A6: 0.50,
    A5: 0.72,
    A4: 0.93,
    A3: 1.18
  };

  const factor = sizeMap[sizeKey] || 0.72;

  mesh.scale.set(factor, factor, 1);

  if (!mesh.visible) {
    texture.needsUpdate = true;
    return;
  }

  if (hasImage) {
    try {
      const img = new Image();

      img.src = imageUrl;
      await img.decode();

      const ratio = Math.min(
        350 / img.width,
        310 / img.height
      );

      const width = img.width * ratio;
      const height = img.height * ratio;

      ctx.drawImage(
        img,
        (512 - width) / 2,
        30,
        width,
        height
      );
    } catch (error) {
      console.warn("Logo preview failed:", error);
    }
  }

  if (hasText) {
    ctx.font = "bold 46px Arial";
    ctx.fillStyle = "#191919";
    ctx.strokeStyle = "#fefefe";
    ctx.lineWidth = 4;
    ctx.textAlign = "center";

    const value = String(text).slice(0, 25);

    ctx.strokeText(value, 256, 420, 455);
    ctx.fillText(value, 256, 420, 455);
  }

  texture.needsUpdate = true;
}

function studioUpdateDesign() {
  if (!avatarRoot) return;

  studioTint.set(
    studioDesiredDesign.color || "#161616"
  );

  if (studioClothing) {
    const materials = Array.isArray(studioClothing.material)
      ? studioClothing.material
      : [studioClothing.material];

    materials.forEach(material => {
      material.needsUpdate = true;
    });
  }

  studioPaintPlane(
    "front",
    studioDesiredDesign.frontText,
    studioDesiredDesign.frontImage,
    studioDesiredDesign.frontSize
  );

  studioPaintPlane(
    "back",
    studioDesiredDesign.backText,
    studioDesiredDesign.backImage,
    studioDesiredDesign.backSize
  );
}

// ===================================================
// PUBLIC CONTROLS FOR THE PERSONAL FIT STUDIO
// ===================================================

window.JCNBodyFitStudio = {
  setGarmentDesign(data) {
    studioDesiredDesign = {
      ...studioDesiredDesign,
      ...data
    };

    studioUpdateDesign();
  },

  applyBodyPreview() {
    studioApplyBodyPreview();
  },

  setView(side) {
    const target = controls.target.clone();

    const radius = Math.max(
      2,
      camera.position.distanceTo(target)
    );

    const sign = side === "back" ? -1 : 1;

    camera.position.set(
      target.x,
      target.y,
      target.z + sign * radius
    );

    controls.update();
  },

  toggleAutoRotate() {
    controls.autoRotate = !controls.autoRotate;
    controls.autoRotateSpeed = 1.3;

    return controls.autoRotate;
  },

  zoom(factor) {
    const offset = camera.position
      .clone()
      .sub(controls.target)
      .multiplyScalar(factor);

    offset.clampLength(
      controls.minDistance || 0.5,
      controls.maxDistance || 40
    );

    camera.position
      .copy(controls.target)
      .add(offset);

    controls.update();
  },

  frame() {
    frameAvatar();
  },

  getEstimate() {
    return state.estimate
      ? { ...state.estimate }
      : null;
  }
};

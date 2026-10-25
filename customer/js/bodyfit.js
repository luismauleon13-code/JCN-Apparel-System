import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const $ = id => document.getElementById(id);
const SIZES = [{ size: 'XS', width: 53.34, length: 68.58 }, { size: 'S', width: 55.88, length: 71.12 }, { size: 'M', width: 58.42, length: 73.66 }, { size: 'L', width: 60.96, length: 76.2 }, { size: 'XL', width: 63.5, length: 78.74 }, { size: '2XL', width: 66.04, length: 81.28 }, { size: '3XL', width: 68.58, length: 83.82 }]; // Defaults from JCN chart: inches converted to cm. Replace from actual product table.
const state = { pose: null, poseResult: null, stream: null, front: null, side: null, photo: null, photoUrl: null, logoUrl: null, estimate: null, rotation: 0 };
const video = $('camera'), overlay = $('overlay'), status = $('status');
function say(msg) { status.textContent = msg; }

async function poseEngine() {
  if (state.pose) return state.pose;

  const { PoseLandmarker, FilesetResolver } =
    await import("../assets/mediapipe/vision_bundle.mjs");

  const files = await FilesetResolver.forVisionTasks(
    new URL("../assets/mediapipe/wasm", import.meta.url)
      .href
  );

  state.pose = await PoseLandmarker.createFromOptions(
    files,
    {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "CPU"
      },
      runningMode: "IMAGE",
      numPoses: 1
    }
  );

  return state.pose;
}
function detected(frame) {
  const lm = frame?.landmarks?.[0];
  return Boolean(lm && [11, 12, 23, 24].every(i =>
    (lm[i]?.visibility ?? 0) >= 0.55 &&
    lm[i].x > 0.04 && lm[i].x < 0.96 &&
    lm[i].y > 0.04 && lm[i].y < 0.96
  ));
}
function captureFrame() { const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0); return c; }
function landmarks(frame) { const lm = frame.landmarks?.[0]; if (!lm) return null; return lm; }
function draw(lm) {
  const w = video.videoWidth, h = video.videoHeight;
  overlay.width = w; overlay.height = h;
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!lm) return;
  ctx.fillStyle = '#e5bd55'; ctx.strokeStyle = '#e5bd55'; ctx.lineWidth = 3;
  for (const [a, b] of [[11,12], [11,23], [12,24], [23,24]]) {
    if (!lm[a] || !lm[b]) continue;
    ctx.beginPath(); ctx.moveTo(lm[a].x*w,lm[a].y*h);
    ctx.lineTo(lm[b].x*w,lm[b].y*h); ctx.stroke();
  }
  for (const i of [11,12,23,24]) {
    if (!lm[i]) continue;
    ctx.beginPath(); ctx.arc(lm[i].x*w,lm[i].y*h,5,0,Math.PI*2); ctx.fill();
  }
}
// Automatic capture: 2 seconds stable detection, then a 5-second countdown.
// Pose orientation checks are heuristics, not guaranteed front/side classification.
let busy = false, tick = 0;
const scan = { enabled: true, phase: 'front', stableSince: 0, countdownSince: 0, lastGood: 0, frameNumber: 0, nextPhaseAfter: 0 };
const stableMs = 2000, countdownMs = 5000;
const scanPanel = document.createElement('div');
scanPanel.id = 'autoScanPanel';
scanPanel.style.cssText = 'margin:12px 0;padding:14px;border:1px solid #785f2b;border-radius:12px;background:#211d16;color:#f1d17c;font:14px Arial,sans-serif;line-height:1.6';
scanPanel.innerHTML = `<label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="autoScanToggle" checked> Automatic front / side capture</label><div id="autoScanMessage" role="status" aria-live="polite">Ready for front scan.</div><strong id="autoScanCountdown" style="display:block;font-size:34px;text-align:center"></strong><button type="button" id="retakeScan" style="padding:9px 15px;border-radius:7px;border:0;background:#e5bd55;color:#17130b;cursor:pointer">Retake both scans</button>`;
$('stopCamera').parentElement.insertAdjacentElement('afterend',scanPanel);
const scanMessage = $('autoScanMessage'), scanCountdown = $('autoScanCountdown');
function resetTimer() { scan.stableSince = 0; scan.countdownSince = 0; scanCountdown.textContent = ''; }
function setPhase(which) { scan.phase = which; resetTimer(); scanMessage.textContent = which === 'front' ? 'Face the camera: show your shoulders through hips.' : which === 'side' ? 'Turn sideways (90°): show your shoulders through hips.' : 'Both scans captured! Review the estimated size.'; }
function classifyPose(lm) {
  if (!lm || ![11,12,23,24].every(i =>
    (lm[i]?.visibility ?? 0) >= 0.55 &&
    lm[i].x > .04 && lm[i].x < .96 && lm[i].y > .04 && lm[i].y < .96
  )) return 'missing';
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return 'unknown';
  const shoulderWidth = Math.abs(lm[11].x - lm[12].x) * w;
  const hipWidth = Math.abs(lm[23].x - lm[24].x) * w;
  const torsoHeight = ((Math.abs(lm[11].y-lm[23].y) + Math.abs(lm[12].y-lm[24].y))/2) * h;
  if (torsoHeight < 30) return 'unknown';
  const ratio = shoulderWidth / torsoHeight;
  const hipRatio = hipWidth / torsoHeight;
  // Experimental 2D orientation only. May need calibration for individual cameras.
  if (ratio >= .48 && hipRatio >= .24) return 'front';
  if (ratio <= .34 && hipRatio <= .32) return 'side';
  return 'unknown';
}
function renderScanMessage(message, seconds = '') { scanMessage.textContent = message; scanCountdown.textContent = seconds; }
function autoScan(result, now) {
  if (!scan.enabled || !state.stream || scan.phase === 'done' || now < scan.nextPhaseAfter) return;
  const orient = classifyPose(landmarks(result));
  const desired = scan.phase;
  if (orient !== desired) {
    resetTimer();
    renderScanMessage(orient === 'missing' || orient === 'edges' ? 'Move back: keep both shoulders and both hips inside the frame.' : orient === 'unknown' ? `Position unclear. ${desired === 'front' ? 'Face the camera directly.' : 'Turn 90° sideways.'}` : `Detected ${orient} view. Please show your ${desired} view.`);
    return;
  }
  if (!scan.stableSince) scan.stableSince = now;
  const stableElapsed = now - scan.stableSince;
  if (stableElapsed < stableMs) { renderScanMessage(`Hold still for ${Math.ceil((stableMs-stableElapsed)/1000)}s to begin capture.`); return; }
  if (!scan.countdownSince) scan.countdownSince = now;
  const left = Math.max(0, Math.ceil((countdownMs-(now-scan.countdownSince))/1000));
  if (left > 0) { renderScanMessage(`Hold your ${desired} pose. Capturing automatically…`, String(left)); return; }
  resetTimer();
  // Save the video frame and pose result from the same instant.
  const frame = captureFrame();
  state[desired] = { frame, result };
  if (desired === 'front') {
    setPhase('side');
    scan.nextPhaseAfter = now + 1500;
    say('Front captured automatically. Turn 90° sideways and wait for the next countdown.');
  } else {
    setPhase('done');
    say('Front and side captured automatically. Size recommendation updated.');
    recommend();
  }
}
async function frameLoop() {
  if (!state.stream) return;
  requestAnimationFrame(frameLoop);
  if (busy || performance.now() - tick < 160 || video.readyState < 2) return;
  tick = performance.now(); busy = true;
  try {
    const engine = await poseEngine();
    const f = engine.detect(video);
    state.poseResult = f;
    draw(landmarks(f));
    $('cameraState').textContent = detected(f) ? 'Body landmarks found' : 'Show shoulders through hips';
    autoScan(f, performance.now());
  } catch (e) {
    $('cameraState').textContent = 'Pose model unavailable';
    renderScanMessage(`Pose detection error: ${e.message}`);
  } finally { busy = false; }
}
$('autoScanToggle').onchange = e => { scan.enabled = e.target.checked; resetTimer(); scanMessage.textContent = scan.enabled ? 'Automatic scanning enabled.' : 'Auto capture disabled. Use manual Capture front / side buttons.'; };
$('retakeScan').onclick = () => { state.front = null; state.side = null; state.estimate = null; scan.nextPhaseAfter = 0; setPhase('front'); $('sizeValue').textContent = '—'; $('confidence').textContent = 'Awaiting scan'; $('measurements').textContent = 'No new scan yet.'; say('Ready to retake. Face forward and keep shoulders and hips visible.'); };
$('startCamera').onclick = async () => {
  if (state.stream) return say('Camera is already running.');
  try {
    say('Loading pose model…'); await poseEngine();
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = state.stream; await video.play();
    $('front').disabled = false; $('side').disabled = false;
    scan.nextPhaseAfter = 0; setPhase(state.front ? 'side' : 'front');
    say('Auto capture is ready. Move back and stand still.'); frameLoop();
  } catch (e) { say('Camera unavailable: ' + e.message + '. Use an uploaded photo instead.'); }
};
function stop() {
  state.stream?.getTracks().forEach(t => t.stop()); state.stream = null;
  video.srcObject = null; resetTimer();
  $('front').disabled = true; $('side').disabled = true;
  $('cameraState').textContent = 'Camera off';
  overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
}
$('stopCamera').onclick = stop; window.addEventListener('pagehide', stop);
async function take(which) {
  try {
    if (!state.stream || video.readyState < 2) return say('Start the camera first.');
    const frame = captureFrame();
    const result = (await poseEngine()).detect(frame);
    if (!detected(result)) return say('Upper body not found. Include both shoulders and hips in frame.');
    if (classifyPose(landmarks(result)) !== which) return say(`Please face ${which === 'front' ? 'forward' : 'sideways'} before capturing.`);
    state[which] = { frame, result };
    if (which === 'front') { state.side = null; setPhase('side'); say('Front captured. Turn sideways for side capture.'); }
    else { setPhase('done'); say('Side captured. Recommendation updated.'); }
    recommend();
  } catch (e) { say('Capture error: ' + e.message); }
}
$('front').onclick = () => take('front'); $('side').onclick = () => take('side');
$('photo').onchange = async e => { const file = e.target.files[0]; if (!file) return; if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) return say('Choose a JPG, PNG, or WEBP under 8 MB.'); try { if (state.photoUrl) URL.revokeObjectURL(state.photoUrl); state.photoUrl = URL.createObjectURL(file); const img = new Image(); img.src = state.photoUrl; await img.decode(); const result = (await poseEngine()).detect(img); if (!detected(result)) return say('Shoulders and hips not detected in uploaded image.'); state.front = { frame: img, result }; $('photoPreview').src = state.photoUrl; $('photoPreview').hidden = false; say('Uploaded front photo analyzed locally. Add side capture or manual measurements for improved size selection.'); recommend(); } catch (err) { say('Photo analysis error: ' + err.message); } };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function recommend() {
  const height = Number($('heightCm').value);
  const chest = Number($('manualChest').value);
  const width = Number($('manualWidth').value);
  const fit = $('fit').value;
  if (!Number.isFinite(height) || height < 110 || height > 230) {
    say('Enter a valid height from 110–230 cm.'); return;
  }
  let target, quality, note, method;
  if (width >= 30 && width <= 100) {
    target = width + (fit === 'loose' ? 3 : fit === 'slim' ? -1 : 0);
    quality = 'Manual garment width — compare size chart';
    note = 'Uses your measured T-shirt width; not a camera measurement.';
    method = 'manual_shirt_width';
  } else if (chest >= 50 && chest <= 180) {
    target = chest / 2 + (fit === 'loose' ? 11 : fit === 'slim' ? 5 : 8);
    quality = 'Manual chest — check preferred fit';
    note = 'Chest circumference / 2 plus approximate wearing ease.';
    method = 'manual_chest';
  } else if (state.front) {
    const lm = landmarks(state.front.result);
    if (!lm || !detected(state.front.result)) {
      say('Front shoulders and hips not visible. Retake front scan.'); return;
    }
    // Uncalibrated proportion heuristic: NO absolute chest/shoulder dimensions
    // can be recovered from 2D photos and user height alone.
    const shoulderSpan = Math.abs(lm[11].x - lm[12].x);
    const torsoSpan = (Math.hypot(lm[11].x-lm[23].x, lm[11].y-lm[23].y) +
                       Math.hypot(lm[12].x-lm[24].x, lm[12].y-lm[24].y)) / 2;
    if (torsoSpan < 0.08) { say('Torso not clear. Retake front capture.'); return; }
    // Correct image aspect ratio before comparing horizontal/vertical offsets.
    const aspect = state.front.frame.width / state.front.frame.height ||
                   state.front.frame.videoWidth / state.front.frame.videoHeight || 1;
    const sh = shoulderSpan * aspect;
    const torso = (Math.hypot((lm[11].x-lm[23].x)*aspect, lm[11].y-lm[23].y) +
                   Math.hypot((lm[12].x-lm[24].x)*aspect, lm[12].y-lm[24].y)) / 2;
    const proportion = sh / Math.max(torso, 0.01);
    // Prototype mapping based on relative torso shape, deliberately bounded.
    // Not validated against real measurements: always mark very low confidence.
    target = Math.max(53.34, Math.min(68.58,
      58.42 + (proportion - 1.15) * 8 +
      (fit === 'loose' ? 3 : fit === 'slim' ? -1 : 0)));
    quality = 'Very low confidence — uncalibrated camera estimate';
    note = `Front shoulder-to-torso ratio ${proportion.toFixed(2)} (relative image geometry only). ` +
      'Height and side photo do not establish chest circumference. Measure chest or a fitting T-shirt to verify.';
    method = 'pose_heuristic_upper_body';
  } else {
    say('Enter manual measurements or capture/upload a front upper-body image.');
    return;
  }
  const selected = SIZES.find(s => s.width >= target) || SIZES[SIZES.length - 1];
  state.estimate = {
    size: selected.size, targetWidth: Math.round(target * 10) / 10,
    confidence: quality, heightCm: height, method,
    frontCaptured: Boolean(state.front), sideCaptured: Boolean(state.side)
  };
  $('sizeValue').textContent = selected.size;
  $('confidence').textContent = quality;
  $('measurements').textContent = note +
    ` Suggested garment width ≥ ${target.toFixed(1)} cm; JCN ${selected.size}: ${selected.width.toFixed(1)} cm. ` +
    'Sizing chart is a starter example; verify actual product sizes.';
  $('selectedSize').value = selected.size;
  updateShape();
}
$('estimate').onclick = recommend;['heightCm', 'fit', 'manualChest', 'manualWidth'].forEach(id => $(id).addEventListener('change', () => { if (state.front || $('manualChest').value || $('manualWidth').value) recommend(); }));
// JCN 360-degree avatar integration. Existing geometric model remains a safe fallback.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#151517');
const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
camera.position.set(0, 1.5, 6.8);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('viewer').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4036, 2.3));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(3, 7, 8); scene.add(light);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.0, 0);
controls.minDistance = 1.5;
controls.maxDistance = 12;
controls.enablePan = false;
// A self-contained fallback allows your professor to use the demo before any .glb exists.
const skin = new THREE.MeshStandardMaterial({ color: 0xc89473, roughness: .88 });
const shirtMat = new THREE.MeshStandardMaterial({ color: $('shirtColor').value, roughness: .86, side: THREE.DoubleSide });
const person = new THREE.Group(); scene.add(person);
function oval(rx, ry, rz, y, material) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), material);
  m.scale.set(rx, ry, rz); m.position.y = y; person.add(m); return m;
}
oval(.23, .3, .22, 2.71, skin); oval(.14, .14, .14, 2.34, skin);
oval(.39, .63, .21, .24, skin);
for (const x of [-.22, .22]) {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.14, .12, 1.3, 16), skin);
  leg.position.set(x, -.75, 0); person.add(leg);
}
const torso = new THREE.Mesh(new THREE.CylinderGeometry(.55, .48, 1.2, 8, 1), shirtMat);
torso.position.y = 1.49; person.add(torso);
const sleeves = [];
for (const x of [-1, 1]) {
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.24, .21, .55, 12), shirtMat);
  sleeve.rotation.z = x * .7; sleeve.position.set(x * .7, 1.86, 0);
  person.add(sleeve); sleeves.push(sleeve);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.13, .11, .82, 16), skin);
  arm.rotation.z = x * .13; arm.position.set(x * .78, 1.12, 0); person.add(arm);
}
const artMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
const art = new THREE.Mesh(new THREE.PlaneGeometry(.68, .55), artMat);
art.position.set(0, 1.57, .57); person.add(art);

// .glb model loader: normalized to a predictable viewing space, never overwrites camera/sizing logic.
const AVATAR_URL = new URL('../assets/models/avatar/jcn-avatar.glb', import.meta.url).href;
const gltfLoader = new GLTFLoader();
let avatarRoot = null;
let avatarIsLoading = false;
// These controls already exist in customer/html/bodyfit-customization.html.
const avatarStatus = $('avatarStatus');
const avatarUpload = $('avatarUpload');
const reloadAvatar = $('reloadAvatar');
if (!avatarStatus || !avatarUpload || !reloadAvatar) {
  throw new Error('Missing avatarStatus, avatarUpload or reloadAvatar in BodyFit HTML.');
}
avatarStatus.textContent = 'Checking for jcn-avatar.glb…';
const disposeAvatar = () => {
  if (!avatarRoot) return;
  scene.remove(avatarRoot);
  avatarRoot.traverse(obj => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!material) continue;
        for (const prop of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
          material[prop]?.dispose();
        }
        material.dispose();
      }
    }
  });
  avatarRoot = null;
};
function showDemo(message = 'Demo mannequin active. Export a Blender .glb to replace it.') {
  disposeAvatar();
  person.visible = true;
  camera.position.set(0, 1.5, 6.8);
  controls.target.set(0, 1, 0); controls.update();
  avatarStatus.textContent = message;
}
function fitAvatar(rawScene) {
  // Preserve geometry/materials and fit any Blender coordinate scale into the viewer.
  const bbox = new THREE.Box3().setFromObject(rawScene);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longest) || longest <= .0001) throw Error('The .glb has no visible geometry.');
  const fitted = new THREE.Group();
  rawScene.position.sub(center);
  const scale = 3.5 / longest;
  rawScene.scale.setScalar(scale);
  fitted.add(rawScene);
  fitted.position.y = 0.6;
  return fitted;
}
async function loadAvatar(url, label) {
  if (avatarIsLoading) return;
  avatarIsLoading = true;
  avatarStatus.textContent = 'Loading ' + label + '…';
  try {
    const gltf = await gltfLoader.loadAsync(url);
    const root = fitAvatar(gltf.scene);
    disposeAvatar();
    avatarRoot = root;
    scene.add(root);
    person.visible = false;
    camera.position.set(0, 1.0, 6.6);
    controls.target.set(0, .6, 0); controls.update();
    avatarStatus.textContent = label + ' loaded! Drag the model to rotate 360°.';
    syncAvatarSize();
  } catch (e) {
    // Missing jcn-avatar.glb is expected until a Blender export is provided.
    if (!avatarRoot) showDemo('Blender avatar not found or unreadable. Demo mannequin is ready. (' + e.message + ')');
    else avatarStatus.textContent = 'Could not replace avatar: ' + e.message;
  } finally { avatarIsLoading = false; }
}
function syncAvatarSize() {
  if (!avatarRoot) return;
  const idx = SIZES.findIndex(s => s.size === $('selectedSize').value);
  const factor = idx >= 0 ? 1 + (idx - 2) * .025 : 1;
  // DEMO ONLY: uniform X/Z scaling is visual approximation, not a body scan or clothing fit simulation.
  avatarRoot.scale.set(factor, 1, factor);
}
function updateShape() {
  const size = $('selectedSize').value;
  const idx = SIZES.findIndex(s => s.size === size);
  const scale = idx >= 0 ? .86 + idx * .052 : 1;
  torso.scale.set(scale, 1, scale);
  sleeves[0].position.x = -.7 * scale;
  sleeves[1].position.x = .7 * scale;
  art.position.z = .59 * scale;
  syncAvatarSize();
}
reloadAvatar.onclick = () => loadAvatar(AVATAR_URL + '?v=' + Date.now(), 'jcn-avatar.glb');
avatarUpload.onchange = async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb') || file.size > 75 * 1024 * 1024) {
    avatarStatus.textContent = 'Select a .glb file smaller than 75 MB.'; return;
  }
  const nextUrl = URL.createObjectURL(file);
  try { await loadAvatar(nextUrl, file.name); }
  finally { URL.revokeObjectURL(nextUrl); } 
};
$('shirtColor').oninput = e => {
  shirtMat.color.set(e.target.value);
  // External Blender model materials are preserved. To recolor its T-shirt, export a separately named/material-assigned mesh in a later phase.
};
$('selectedSize').onchange = updateShape;
function drawArt() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384;
  const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 512, 384);
  const finish = () => { if (artMat.map) artMat.map.dispose(); artMat.map = new THREE.CanvasTexture(c); artMat.needsUpdate = true; };
  const title = $('printText').value.trim();
  const putText = () => { ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = 'bold 42px Arial'; ctx.fillText(title.slice(0,25), 256, 330, 470); finish(); };
  if (state.logoUrl) {
    const im = new Image();
    im.onload = () => { ctx.drawImage(im,156,40,200,220); putText(); };
    im.src = state.logoUrl;
  } else putText();
}
$('printText').addEventListener('input', drawArt);
$('logo').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 5e6) {
    $('saveStatus').textContent = 'Logo must be JPG, PNG, or WEBP under 5MB.'; return;
  }
  if (state.logoUrl) URL.revokeObjectURL(state.logoUrl);
  state.logoUrl = URL.createObjectURL(f);
  $('artPreview').src = state.logoUrl; $('artPreview').hidden = false; drawArt();
};
$('resetView').onclick = () => {
  if (avatarRoot) { camera.position.set(0, 1, 6.6); controls.target.set(0, .6, 0); }
  else { camera.position.set(0, 1.5, 6.8); controls.target.set(0, 1, 0); }
  controls.update();
};
const resizeObserver = new ResizeObserver(() => {
  const el = $('viewer'); const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
});
resizeObserver.observe($('viewer'));
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
updateShape(); drawArt(); animate();
loadAvatar(AVATAR_URL, 'jcn-avatar.glb');
$('save').onclick = async () => { const target = $('saveStatus'); const token = localStorage.getItem('customerToken'); if (!token) { target.textContent = 'Log in as a customer before saving.'; return; } const body = { size: $('selectedSize').value, shirt_color: $('shirtColor').value, print_text: $('printText').value.trim(), fit: $('fit').value, height_cm: Number($('heightCm').value), recommendation: state.estimate }; try { const res = await fetch('http://localhost:5000/api/customer/bodyfit-designs', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw Error(data.message || 'Save failed'); target.textContent = 'Saved successfully. Design ID: ' + data.id; } catch (e) { target.textContent = 'Unable to save: ' + e.message; } };

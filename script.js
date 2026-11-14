"use strict";

const STORAGE_KEY = "teleprompter-settings-v1";

const elements = {
  app: document.getElementById("app"),
  editor: document.getElementById("scriptEditor"),
  readingText: document.getElementById("readingText"),
  viewport: document.getElementById("prompterViewport"),
  readingProgressValue: document.getElementById("readingProgressValue"),
  readingProgressFill: document.getElementById("readingProgressFill"),
  playBtn: document.getElementById("playBtn"),
  resetBtn: document.getElementById("resetBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  speedSlider: document.getElementById("speedSlider"),
  fontSlider: document.getElementById("fontSlider"),
  speedValue: document.getElementById("speedValue"),
  fontValue: document.getElementById("fontValue"),
  mirrorHBtn: document.getElementById("mirrorHBtn"),
  mirrorVBtn: document.getElementById("mirrorVBtn"),
  timerValue: document.getElementById("timerValue"),
  progressValue: document.getElementById("progressValue"),
  progressFill: document.getElementById("progressFill"),
  progressTrack: document.querySelector(".progress-track"),
  saveStatus: document.getElementById("saveStatus"),
  cameraBtn: document.getElementById("cameraBtn"),
  cameraPanel: document.getElementById("cameraPanel"),
  cameraCloseBtn: document.getElementById("cameraCloseBtn"),
  cameraPreview: document.getElementById("cameraPreview"),
  cameraResizeHandle: document.getElementById("cameraResizeHandle"),
  cameraSelect: document.getElementById("cameraSelect"),
  formatSelect: document.getElementById("formatSelect"),
  switchCameraBtn: document.getElementById("switchCameraBtn"),
  libraryBtn: document.getElementById("libraryBtn"),
  recordBtn: document.getElementById("recordBtn"),
  recordButtonText: document.getElementById("recordButtonText"),
  cameraStatus: document.getElementById("cameraStatus"),
  recordingsList: document.getElementById("recordingsList"),
  recordingCount: document.getElementById("recordingCount")
};

const CAMERA_POSITION_KEY = "teleprompter-camera-position-v1";
const CAMERA_SIZE_KEY = "teleprompter-camera-size-v1";
const CAMERA_FORMAT_KEY = "teleprompter-camera-format-v1";

const defaultSettings = {
  script: elements.editor.value,
  speed: 1,
  fontSize: 64,
  mirrorH: false,
  mirrorV: false
};

let settings = { ...defaultSettings };
let isPlaying = false;
let elapsedSeconds = 0;
let lastFrameTime = 0;
let timerAccumulator = 0;
let saveTimer = 0;
let animationFrame = 0;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && typeof saved === "object") settings = { ...defaultSettings, ...saved };
} catch (_) {}

elements.editor.value = typeof settings.script === "string" ? settings.script : defaultSettings.script;
elements.speedSlider.value = String(settings.speed);
elements.fontSlider.value = String(settings.fontSize);
elements.mirrorHBtn.setAttribute("aria-pressed", String(Boolean(settings.mirrorH)));
elements.mirrorVBtn.setAttribute("aria-pressed", String(Boolean(settings.mirrorV)));

function saveSettings() {
  window.clearTimeout(saveTimer);
  elements.saveStatus.textContent = "Saving…";
  saveTimer = window.setTimeout(() => {
    settings.script = elements.editor.value;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      elements.saveStatus.textContent = "Saved";
    } catch (_) {
      elements.saveStatus.textContent = "Storage unavailable";
    }
  }, 250);
}

function updateRangeProgress(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const percent = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--range-progress", `${percent}%`);
}

function renderScript() {
  elements.readingText.textContent = elements.editor.value || "Your script is empty.";
  updateProgress();
}

function applyDisplaySettings() {
  settings.speed = Number(elements.speedSlider.value);
  settings.fontSize = Number(elements.fontSlider.value);
  settings.mirrorH = elements.mirrorHBtn.getAttribute("aria-pressed") === "true";
  settings.mirrorV = elements.mirrorVBtn.getAttribute("aria-pressed") === "true";

  elements.speedValue.textContent = `${settings.speed.toFixed(2).replace(/0$/, "").replace(/\.$/, "")}×`;
  elements.fontValue.textContent = `${settings.fontSize} px`;
  elements.readingText.style.fontSize = `${settings.fontSize}px`;
  elements.readingText.style.transform = `scale(${settings.mirrorH ? -1 : 1}, ${settings.mirrorV ? -1 : 1})`;
  updateRangeProgress(elements.speedSlider);
  updateRangeProgress(elements.fontSlider);
  saveSettings();
  updateProgress();
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateTimer() {
  elements.timerValue.textContent = formatTime(elapsedSeconds);
}

function setCameraStatus(message, detail = message) {
  elements.cameraStatus.textContent = message;
  elements.cameraStatus.title = detail;
}

function updateProgress() {
  const max = Math.max(0, elements.viewport.scrollHeight - elements.viewport.clientHeight);
  const percentage = max > 0 ? Math.min(100, Math.max(0, (elements.viewport.scrollTop / max) * 100)) : 0;
  const rounded = Math.round(percentage);
  elements.progressValue.textContent = `${rounded}%`;
  elements.progressFill.style.width = `${percentage}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(rounded));
  elements.readingProgressValue.textContent = `${rounded}%`;
  elements.readingProgressFill.style.width = `${percentage}%`;
}

function setPlaying(nextPlaying) {
  isPlaying = nextPlaying;
  elements.playBtn.classList.toggle("playing", isPlaying);
  elements.playBtn.setAttribute("aria-label", isPlaying ? "Pause teleprompter" : "Start teleprompter");
  if (isPlaying) {
    lastFrameTime = performance.now();
    timerAccumulator = 0;
    animationFrame = requestAnimationFrame(scrollFrame);
  } else {
    cancelAnimationFrame(animationFrame);
  }
}

function scrollFrame(timestamp) {
  if (!isPlaying) return;
  const delta = Math.min(100, timestamp - lastFrameTime);
  lastFrameTime = timestamp;
  const basePixelsPerSecond = 34;
  const max = elements.viewport.scrollHeight - elements.viewport.clientHeight;

  if (max > 0) {
    elements.viewport.scrollTop += basePixelsPerSecond * settings.speed * (delta / 1000);
    updateProgress();
  }

  timerAccumulator += delta;
  if (timerAccumulator >= 1000) {
    const wholeSeconds = Math.floor(timerAccumulator / 1000);
    elapsedSeconds += wholeSeconds;
    timerAccumulator -= wholeSeconds * 1000;
    updateTimer();
  }

  if (elements.viewport.scrollTop >= max && max > 0) {
    setPlaying(false);
  } else {
    animationFrame = requestAnimationFrame(scrollFrame);
  }
}

function resetPrompter() {
  setPlaying(false);
  elements.viewport.scrollTop = 0;
  elapsedSeconds = 0;
  timerAccumulator = 0;
  updateTimer();
  updateProgress();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await elements.app.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_) {}
}

elements.editor.addEventListener("input", () => {
  renderScript();
  saveSettings();
});
elements.speedSlider.addEventListener("input", applyDisplaySettings);
elements.fontSlider.addEventListener("input", applyDisplaySettings);
elements.viewport.addEventListener("scroll", updateProgress, { passive: true });
elements.playBtn.addEventListener("click", () => setPlaying(!isPlaying));
elements.resetBtn.addEventListener("click", resetPrompter);
elements.fullscreenBtn.addEventListener("click", toggleFullscreen);

function toggleMirror(button) {
  const next = button.getAttribute("aria-pressed") !== "true";
  button.setAttribute("aria-pressed", String(next));
  applyDisplaySettings();
}
elements.mirrorHBtn.addEventListener("click", () => toggleMirror(elements.mirrorHBtn));
elements.mirrorVBtn.addEventListener("click", () => toggleMirror(elements.mirrorVBtn));
elements.cameraBtn.addEventListener("click", () => {
  elements.cameraPanel.hidden = false;
  elements.app.classList.add("camera-open");
  window.requestAnimationFrame(restoreCameraPosition);
  startCamera();
  renderRecordings();
});
elements.cameraCloseBtn.addEventListener("click", () => {
  stopCamera();
  elements.cameraPanel.hidden = true;
  elements.cameraPanel.classList.remove("library-open");
  elements.app.classList.remove("camera-open");
});
elements.cameraSelect.addEventListener("change", startCamera);
elements.formatSelect.addEventListener("change", () => {
  try {
    localStorage.setItem(CAMERA_FORMAT_KEY, elements.formatSelect.value);
  } catch (_) {}
});
elements.switchCameraBtn.addEventListener("click", () => {
  useEnvironmentCamera = !useEnvironmentCamera;
  elements.cameraSelect.value = "";
  startCamera();
});
elements.libraryBtn.addEventListener("click", () => {
  const isExpanded = elements.cameraPanel.classList.toggle("library-open");
  if (isExpanded) {
    elements.cameraPanel.style.width = "";
    elements.cameraPanel.style.height = "";
  } else {
    try {
      const size = JSON.parse(localStorage.getItem(CAMERA_SIZE_KEY));
      if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
        applyCameraSize(size);
      }
    } catch (_) {}
  }
  renderRecordings();
  window.requestAnimationFrame(restoreCameraPosition);
});
elements.recordBtn.addEventListener("click", toggleRecording);
const cameraHeading = elements.cameraPanel.querySelector(".camera-heading");
let cameraDrag = null;

function applyCameraPosition(position) {
  if (!position) return;
  const x = Math.max(8, Math.min(window.innerWidth - elements.cameraPanel.offsetWidth - 8, position.x));
  const y = Math.max(52, Math.min(window.innerHeight - elements.cameraPanel.offsetHeight - 8, position.y));
  elements.cameraPanel.style.left = `${x}px`;
  elements.cameraPanel.style.top = `${y}px`;
  elements.cameraPanel.style.right = "auto";
  elements.cameraPanel.style.bottom = "auto";
}

function applyCameraSize(size) {
  if (!size || elements.cameraPanel.classList.contains("library-open")) return;
  const rect = elements.cameraPanel.getBoundingClientRect();
  const mobile = window.matchMedia("(max-width: 620px)").matches;
  const minWidth = mobile ? 140 : 240;
  const minHeight = mobile ? 132 : 260;
  const maxWidth = Math.max(minWidth, window.innerWidth - 16);
  const maxHeight = Math.max(minHeight, window.innerHeight - 60);
  const width = Math.max(minWidth, Math.min(maxWidth, size.width));
  const height = Math.max(minHeight, Math.min(maxHeight, size.height));
  elements.cameraPanel.style.width = `${width}px`;
  elements.cameraPanel.style.height = `${height}px`;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left));
  const top = Math.max(52, Math.min(window.innerHeight - height - 8, rect.top));
  elements.cameraPanel.style.left = `${left}px`;
  elements.cameraPanel.style.top = `${top}px`;
  elements.cameraPanel.style.right = "auto";
  elements.cameraPanel.style.bottom = "auto";
}

function restoreCameraPosition() {
  try {
    const size = JSON.parse(localStorage.getItem(CAMERA_SIZE_KEY));
    if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
      applyCameraSize(size);
    }
    const position = JSON.parse(localStorage.getItem(CAMERA_POSITION_KEY));
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
      applyCameraPosition(position);
    }
  } catch (_) {}
}

cameraHeading.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  const rect = elements.cameraPanel.getBoundingRect?.() || elements.cameraPanel.getBoundingClientRect();
  cameraDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  elements.cameraPanel.setPointerCapture(event.pointerId);
});

elements.cameraPanel.addEventListener("pointermove", (event) => {
  if (!cameraDrag || event.pointerId !== cameraDrag.pointerId) return;
  const x = event.clientX - cameraDrag.offsetX;
  const y = event.clientY - cameraDrag.offsetY;
  applyCameraPosition({ x, y });
});

function finishCameraDrag(event) {
  if (!cameraDrag || event.pointerId !== cameraDrag.pointerId) return;
  cameraDrag = null;
  const rect = elements.cameraPanel.getBoundingClientRect();
  try {
    localStorage.setItem(CAMERA_POSITION_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
  } catch (_) {}
}
elements.cameraPanel.addEventListener("pointerup", finishCameraDrag);
elements.cameraPanel.addEventListener("pointercancel", finishCameraDrag);
let cameraResize = null;
elements.cameraResizeHandle.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const rect = elements.cameraPanel.getBoundingClientRect();
  cameraResize = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    width: rect.width,
    height: rect.height
  };
  elements.cameraResizeHandle.setPointerCapture(event.pointerId);
});
elements.cameraResizeHandle.addEventListener("pointermove", (event) => {
  if (!cameraResize || event.pointerId !== cameraResize.pointerId) return;
  applyCameraSize({
    width: cameraResize.width + event.clientX - cameraResize.startX,
    height: cameraResize.height + event.clientY - cameraResize.startY
  });
});
function finishCameraResize(event) {
  if (!cameraResize || event.pointerId !== cameraResize.pointerId) return;
  cameraResize = null;
  const rect = elements.cameraPanel.getBoundingClientRect();
  try {
    localStorage.setItem(CAMERA_SIZE_KEY, JSON.stringify({ width: rect.width, height: rect.height }));
    localStorage.setItem(CAMERA_POSITION_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
  } catch (_) {}
}
elements.cameraResizeHandle.addEventListener("pointerup", finishCameraResize);
elements.cameraResizeHandle.addEventListener("pointercancel", finishCameraResize);
elements.cameraResizeHandle.addEventListener("keydown", (event) => {
  const steps = event.shiftKey ? 40 : 16;
  const delta = {
    ArrowRight: { width: steps, height: 0 },
    ArrowLeft: { width: -steps, height: 0 },
    ArrowDown: { width: 0, height: steps },
    ArrowUp: { width: 0, height: -steps }
  }[event.key];
  if (!delta) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = elements.cameraPanel.getBoundingClientRect();
  applyCameraSize({ width: rect.width + delta.width, height: rect.height + delta.height });
  const resized = elements.cameraPanel.getBoundingClientRect();
  try {
    localStorage.setItem(CAMERA_SIZE_KEY, JSON.stringify({ width: resized.width, height: resized.height }));
    localStorage.setItem(CAMERA_POSITION_KEY, JSON.stringify({ x: resized.left, y: resized.top }));
  } catch (_) {}
});
window.addEventListener("resize", () => {
  if (!elements.cameraPanel.hidden) restoreCameraPosition();
});

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    if (event.key === "Escape") event.target.blur();
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    setPlaying(!isPlaying);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setPlaying(false);
    elements.viewport.scrollTop -= 48;
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    setPlaying(false);
    elements.viewport.scrollTop += 48;
  } else if (event.key.toLowerCase() === "r") {
    resetPrompter();
  } else if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  } else if (event.key === "Escape" && isPlaying) {
    setPlaying(false);
  }
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = Boolean(document.fullscreenElement);
  elements.fullscreenBtn.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  elements.fullscreenBtn.title = isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)";
  window.setTimeout(updateProgress, 50);
});

window.addEventListener("resize", updateProgress);
window.addEventListener("beforeunload", () => {
  settings.script = elements.editor.value;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
});

let cameraStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let useEnvironmentCamera = false;
let recordingHasAudio = false;

const savedFormat = localStorage.getItem(CAMERA_FORMAT_KEY);
if (savedFormat && ["mp4", "webm", "mov"].includes(savedFormat)) {
  elements.formatSelect.value = savedFormat;
} else {
  elements.formatSelect.value = "mp4";
  try { localStorage.setItem(CAMERA_FORMAT_KEY, "mp4"); } catch (_) {}
}

function openIndexedDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("teleprompter-recordings", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("videos")) {
        database.createObjectStore("videos", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveRecording(blob, duration, format, hasAudio) {
  const database = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("videos", "readwrite");
    transaction.objectStore("videos").add({
      blob,
      duration,
      createdAt: new Date().toISOString(),
      type: blob.type,
      format,
      hasAudio
    });
    transaction.oncomplete = () => {
      database.close();
      renderRecordings();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Storage transaction failed"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Storage transaction was aborted"));
    };
  });
}

async function getRecordings() {
  const database = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("videos", "readonly");
    const request = transaction.objectStore("videos").getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecording(id) {
  const database = await openIndexedDb();
  const transaction = database.transaction("videos", "readwrite");
  transaction.objectStore("videos").delete(id);
  transaction.oncomplete = () => {
    database.close();
    renderRecordings();
  };
}

async function renderRecordings() {
  try {
    const recordings = await getRecordings();
    elements.recordingCount.textContent = String(recordings.length);
    elements.recordingsList.replaceChildren();
    recordings.forEach((recording) => {
      const row = document.createElement("div");
      row.className = "recording-item";
      const name = document.createElement("span");
      const date = new Date(recording.createdAt);
      const format = getRecordingFormat(recording);
      const audioLabel = recording.hasAudio === false ? " · no audio" : " · audio";
      name.textContent = `${date.toLocaleString()} - ${formatTime(Math.round(recording.duration || 0))} · ${format.toUpperCase()}${audioLabel}`;
      const download = document.createElement("button");
      download.type = "button";
      download.textContent = isMobileShareSupported() ? "Save" : "Download";
      download.title = isMobileShareSupported() ? "Save to gallery or another app" : "Download recording";
      download.addEventListener("click", () => saveOrShareRecording(recording));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.title = "Delete recording";
      remove.addEventListener("click", () => deleteRecording(recording.id));
      row.append(name, download, remove);
      elements.recordingsList.append(row);
    });
  } catch (_) {
    elements.recordingCount.textContent = "Unavailable";
  }
}

function downloadRecording(recording) {
  const extension = getRecordingFormat(recording);
  const url = URL.createObjectURL(recording.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `teleprompter-${recording.createdAt.replace(/[:.]/g, "-")}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function getRecordingFormat(recording) {
  const mimeType = recording.blob.type.toLowerCase();
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  return recording.format === "mov" ? "mp4" : recording.format || "webm";
}

function isMobileShareSupported() {
  return Boolean(navigator.share && navigator.canShare && window.matchMedia("(max-width: 620px)").matches);
}

async function saveOrShareRecording(recording) {
  const extension = getRecordingFormat(recording);
  const fileType = recording.blob.type || (extension === "mp4" ? "video/mp4" : "video/webm");
  const file = new File([recording.blob], `teleprompter-${Date.now()}.${extension}`, { type: fileType });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Teleprompter recording",
        text: "Save this recording to Photos or Gallery"
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  downloadRecording(recording);
}

async function loadCameraDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");
  elements.cameraSelect.replaceChildren(new Option("Default camera", ""));
  cameras.forEach((camera, index) => {
    elements.cameraSelect.append(new Option(camera.label || `Camera ${index + 1}`, camera.deviceId));
  });
}

async function startCamera() {
  if (!window.isSecureContext && location.hostname !== "localhost") {
    setCameraStatus("HTTPS required", "Camera access requires HTTPS, or localhost.");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus("Camera unsupported", "Camera is not supported in this browser.");
    return;
  }
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  setCameraStatus("Requesting access…");
  const constraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: elements.cameraSelect.value
      ? { deviceId: { exact: elements.cameraSelect.value }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: useEnvironmentCamera ? "environment" : "user", width: { ideal: 1280 }, height: { ideal: 720 } }
  };
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    elements.cameraPreview.srcObject = cameraStream;
    const hasAudio = cameraStream.getAudioTracks().some((track) => track.readyState === "live");
    elements.recordBtn.disabled = !hasAudio;
    setCameraStatus(hasAudio ? "Ready · mic on" : "Microphone unavailable", hasAudio
      ? "Camera and microphone are ready."
      : "Microphone unavailable; check browser permissions.");
    await loadCameraDevices();
  } catch (error) {
    const message = error.name === "NotAllowedError"
      ? "Permission denied"
      : error.name === "NotFoundError"
        ? "Device not found"
        : "Camera unavailable";
    const detail = error.name === "NotAllowedError"
      ? "Allow camera and microphone access in browser settings."
      : error.name === "NotFoundError"
        ? "Camera or microphone not found."
        : "Unable to open camera and microphone.";
    setCameraStatus(message, detail);
  }
}

function stopCamera() {
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  elements.cameraPreview.srcObject = null;
  elements.recordBtn.disabled = true;
  setCameraStatus("Camera is off");
}

async function toggleRecording() {
  if (!cameraStream || !cameraStream.getVideoTracks().length) return;
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  if (typeof MediaRecorder === "undefined") {
    setCameraStatus("Recording unsupported", "Recording is not supported in this browser.");
    return;
  }
  recordedChunks = [];
  const preferredFormat = elements.formatSelect.value;
  const typeCandidates = preferredFormat === "mp4" || preferredFormat === "mov"
    ? ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"]
    : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const supportedType = typeCandidates.find((type) => MediaRecorder.isTypeSupported(type));
  const liveAudioTracks = cameraStream.getAudioTracks().filter((track) => track.readyState === "live" && track.enabled);
  if (liveAudioTracks.length === 0) {
    setCameraStatus("No microphone", "Microphone track unavailable; allow mic access and reopen camera.");
    elements.recordBtn.disabled = true;
    return;
  }
  recordingHasAudio = true;
  try {
    mediaRecorder = new MediaRecorder(cameraStream, {
      ...(supportedType ? { mimeType: supportedType } : {}),
      audioBitsPerSecond: 128000
    });
  } catch (_) {
    setCameraStatus("Recording unsupported", "Recording is not supported in this browser.");
    return;
  }
  const startedAt = Date.now();
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    const duration = (Date.now() - startedAt) / 1000;
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
    const actualFormat = blob.type.includes("mp4") ? "mp4" : "webm";
    const hasAudio = recordingHasAudio;
    recordedChunks = [];
    elements.recordBtn.classList.remove("recording");
    elements.recordButtonText.textContent = "Record";
    setCameraStatus("Saving…");
    try {
      await saveRecording(blob, duration, actualFormat, hasAudio);
      const detail = !hasAudio
        ? "Recording saved without microphone audio."
        : actualFormat !== "mp4" && preferredFormat !== "webm"
          ? `Saved as WebM with audio (${blob.size.toLocaleString()} bytes). This browser could not record ${preferredFormat.toUpperCase()}.`
          : preferredFormat === "mov" && actualFormat === "mp4"
            ? `MOV is not created by this browser; saved as MP4 with audio (${blob.size.toLocaleString()} bytes).`
            : `Saved ${actualFormat.toUpperCase()} with audio (${blob.size.toLocaleString()} bytes).`;
      setCameraStatus(!hasAudio ? "Saved · no audio" : `Saved ${actualFormat.toUpperCase()} · audio`, detail);
    } catch (error) {
      setCameraStatus("Save failed", `Could not save recording: ${error.message}`);
    }
  };
  mediaRecorder.start(1000);
  elements.recordBtn.classList.add("recording");
  elements.recordButtonText.textContent = "Stop";
  setCameraStatus(`Recording · ${mediaRecorder.mimeType.includes("mp4") ? "MP4" : "WebM"}`);
}

renderScript();
applyDisplaySettings();
updateTimer();
renderRecordings();

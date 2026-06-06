/* =============================================
   SEND.JS — Send Me Art page: canvas, mobile draw, submissions, identity
   ============================================= */

// ─── Submission cooldown ──────────────────────
const SUBMIT_COOLDOWN_MS  = 24 * 60 * 60 * 1000;
const SUBMIT_COOLDOWN_KEY = "last-submit-ts";

function checkSubmitCooldown() {
  const last = parseInt(localStorage.getItem(SUBMIT_COOLDOWN_KEY) || "0", 10);
  const diff = Date.now() - last;
  if (last && diff < SUBMIT_COOLDOWN_MS) {
    const hrs  = Math.floor((SUBMIT_COOLDOWN_MS - diff) / 3600000);
    const mins = Math.ceil(((SUBMIT_COOLDOWN_MS - diff) % 3600000) / 60000);
    const msg  = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} minute${mins !== 1 ? "s" : ""}`;
    showToast(`You already sent something today! Come back in ${msg} ⏳`);
    return false;
  }
  localStorage.setItem(SUBMIT_COOLDOWN_KEY, String(Date.now()));
  return true;
}

// ═══════════════════════════════════════════════
// IDENTITY & VISIBILITY
// ═══════════════════════════════════════════════
function setVisibility(tab, vis, btn) {
  document.querySelectorAll(`#${tab}-visibility-row .vis-btn`).forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const hint = document.getElementById(tab + "-vis-hint");
  if (hint) {
    hint.textContent = vis === "public"
      ? "Everyone can see this on the Wall page"
      : "Only you (admin) can see this";
  }
}

function getVisibility(tab) {
  const btn = document.querySelector(`#${tab}-visibility-row .vis-btn.active`);
  return btn ? btn.dataset.vis : "private";
}

function setIdentityMode(tab, mode, btn) {
  const container = document.getElementById(tab + "-identity");
  container.querySelectorAll(".identity-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const nameInput = document.getElementById(tab + "-name");
  if (mode === "named") {
    nameInput.classList.add("visible");
    setTimeout(() => nameInput.focus(), 50);
  } else {
    nameInput.classList.remove("visible");
    nameInput.value = "";
  }
}

function getSenderName(tab) {
  const btn = document.querySelector(`#${tab}-identity .identity-btn.active`);
  if (!btn || btn.dataset.mode === "anon") return null;
  const val = document.getElementById(tab + "-name").value.trim();
  return val || null;
}

// ═══════════════════════════════════════════════
// SEND TAB SWITCHING
// ═══════════════════════════════════════════════
function showSendTab(tab) {
  document.querySelectorAll(".send-tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".send-tab-content").forEach((c) => c.classList.remove("active"));
  document.querySelector(`.send-tab-btn[data-tab="${tab}"]`).classList.add("active");
  document.getElementById("send-tab-" + tab).classList.add("active");
}

// ═══════════════════════════════════════════════
// CANVAS DRAWING (desktop)
// ═══════════════════════════════════════════════
function setupCanvas() {
  const canvas = document.getElementById("draw-canvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches && e.touches[0]) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x; lastY = pos.y;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, getBrushSize() / 2, 0, Math.PI * 2);
    ctx.fillStyle = eraserActive ? "#ffffff" : getColor();
    ctx.fill();
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = eraserActive ? "#ffffff" : getColor();
    ctx.lineWidth = getBrushSize();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastX = pos.x; lastY = pos.y;
  }

  function stopDraw() { isDrawing = false; }

  canvas.addEventListener("mousedown",  startDraw);
  canvas.addEventListener("mousemove",  draw);
  canvas.addEventListener("mouseup",    stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);
  canvas.addEventListener("touchstart", startDraw,  { passive: false });
  canvas.addEventListener("touchmove",  draw,        { passive: false });
  canvas.addEventListener("touchend",   stopDraw);
}

function getColor()     { return document.getElementById("color-picker").value; }
function getBrushSize() { return parseInt(document.getElementById("brush-size").value, 10) || 6; }

function toggleEraser(btn) {
  eraserActive = !eraserActive;
  btn.classList.toggle("active", eraserActive);
  btn.textContent = eraserActive ? "✏️ Draw" : "🧹 Eraser";
}

function clearCanvas() {
  const canvas = document.getElementById("draw-canvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ═══════════════════════════════════════════════
// CANVAS HELPERS
// ═══════════════════════════════════════════════
function isCanvasBlank(canvas) {
  const ctx = canvas.getContext("2d");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) return false;
  }
  return true;
}

function safeCanvasDataUrl(canvas) {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const MAX_BYTES = 2 * 1024 * 1024;
  if (dataUrl.length > MAX_BYTES) return canvas.toDataURL("image/jpeg", 0.5);
  return dataUrl;
}

// ═══════════════════════════════════════════════
// DRAW MODE (Simple / WigglyPaint)
// ═══════════════════════════════════════════════
let _drawMode = "simple";

function setDrawMode(mode) {
  _drawMode = mode;
  document.getElementById("draw-mode-simple").classList.toggle("hidden", mode !== "simple");
  document.getElementById("draw-mode-wiggly").classList.toggle("hidden", mode !== "wiggly");
  document.getElementById("dmt-simple").classList.toggle("active", mode === "simple");
  document.getElementById("dmt-wiggly").classList.toggle("active", mode === "wiggly");
}

function sendCurrentDrawing() {
  if (_drawMode === "wiggly") {
    const iframe = document.getElementById("wiggly-iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "trigger-submit" }, window.location.origin);
    }
  } else {
    submitDrawing();
  }
}

// WigglyPaint iframe message handler
window.addEventListener("message", async (e) => {
  if (e.origin !== window.location.origin) return;
  if (!e.data || e.data.type !== "wiggly-submit") return;
  const dataUrl = e.data.dataUrl;
  if (!dataUrl) return;
  if (!checkSubmitCooldown()) return;
  const name = getSenderName("draw");
  const vis  = getVisibility("draw");
  try {
    const imageUrl = await _cloudinaryUpload(dataUrl, 'bubz/submissions');
    const entry = {
      id: String(Date.now() + Math.floor(Math.random() * 1000)),
      type: "drawing", data: imageUrl,
      sender: name, timestamp: new Date().toISOString(), requestedVis: vis,
    };
    if (vis === "private") {
      await dbAddPrivate(entry);
      showToast("WigglyPaint sent privately! 🔒✨ Thank you!");
    } else {
      await savePending(entry);
      showToast("WigglyPaint submitted! Waiting for approval 🌐✨");
    }
  } catch {
    localStorage.removeItem(SUBMIT_COOLDOWN_KEY);
    showToast("Failed to send — check your connection and try again 😢");
  }
});

// ═══════════════════════════════════════════════
// SUBMISSIONS
// ═══════════════════════════════════════════════
async function submitDrawing() {
  if (!checkSubmitCooldown()) return;
  const canvas = document.getElementById("draw-canvas");
  if (isCanvasBlank(canvas)) { showToast("Draw something first! 🖌️"); return; }

  const btn = document.getElementById('draw-send-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

  const drawSender = getSenderName("draw");
  if (isBubzName(drawSender)) {
    showBubzNameWarning();
    if (btn) { btn.disabled = false; btn.textContent = 'Send Drawing ✨'; }
    return;
  }

  try {
    const vis = getVisibility("draw");
    const imageUrl = await _cloudinaryUpload(safeCanvasDataUrl(canvas), 'bubz/submissions');
    const entry = {
      id: String(Date.now() + Math.floor(Math.random() * 1000)),
      type: "drawing", data: imageUrl,
      sender: drawSender, timestamp: new Date().toISOString(),
      requestedVis: vis,
    };
    if (vis === "private") {
      await dbAddPrivate(entry);
      showToast("Drawing sent privately! 🔒✨ Thank you!");
    } else {
      await savePending(entry);
      showToast("Drawing submitted! Waiting for approval 🌐✨");
    }
    clearCanvas();
  } catch {
    localStorage.removeItem(SUBMIT_COOLDOWN_KEY);
    showToast("Failed to send — check your connection and try again 😢");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Drawing ✨'; }
  }
}

async function submitMessage() {
  if (!checkSubmitCooldown()) return;
  const ta   = document.getElementById("message-textarea");
  const text = ta.value.trim();
  if (!text) { showToast("Please write something first! 💬"); return; }
  const msgSender = getSenderName("message");
  if (isBubzName(msgSender)) { showBubzNameWarning(); return; }

  const btn = document.querySelector('#send-tab-message .btn-send');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  const vis = getVisibility("message");
  const entry = {
    id: String(Date.now() + Math.floor(Math.random() * 1000)),
    type: "message", data: text,
    sender: msgSender, timestamp: new Date().toISOString(),
    requestedVis: vis,
  };
  try {
    if (vis === "private") {
      await dbAddPrivate(entry);
      showToast("Message sent privately! 🔒✨ Thank you!");
    } else {
      await savePending(entry);
      showToast("Message submitted! Waiting for approval 🌐✨");
    }
    ta.value = "";
  } catch {
    localStorage.removeItem(SUBMIT_COOLDOWN_KEY);
    showToast("Failed to send — check your connection and try again 😢");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Message 💌'; }
  }
}

// ═══════════════════════════════════════════════
// MOBILE DRAW PANEL
// ═══════════════════════════════════════════════
let mobileErasing  = false;
let mobilePainting = false;
let mobileLastX    = 0;
let mobileLastY    = 0;

function openMobileDrawPanel() {
  const panel = document.getElementById("mobile-draw-panel");
  panel.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setupMobileCanvas();
}

function closeMobileDrawPanel() {
  document.getElementById("mobile-draw-panel").classList.add("hidden");
  document.body.style.overflow = "";
}

function setupMobileCanvas() {
  const canvas = document.getElementById("mobile-draw-canvas");
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  updateMobileSizeDot();

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    mobilePainting = true;
    const { x, y } = getPos(e);
    mobileLastX = x; mobileLastY = y;
  }

  function draw(e) {
    e.preventDefault();
    if (!mobilePainting) return;
    const ctx2 = canvas.getContext("2d");
    const { x, y } = getPos(e);
    ctx2.beginPath();
    ctx2.moveTo(mobileLastX, mobileLastY);
    ctx2.lineTo(x, y);
    ctx2.strokeStyle = mobileErasing ? "#fff" : getMobileColor();
    ctx2.lineWidth   = getMobileBrushSize();
    ctx2.lineCap     = "round";
    ctx2.lineJoin    = "round";
    ctx2.stroke();
    mobileLastX = x; mobileLastY = y;
  }

  function stopDraw() { mobilePainting = false; }

  canvas.onmousedown  = startDraw;
  canvas.onmousemove  = draw;
  canvas.onmouseup    = stopDraw;
  canvas.onmouseleave = stopDraw;
  canvas.ontouchstart = startDraw;
  canvas.ontouchmove  = draw;
  canvas.ontouchend   = stopDraw;

  document.getElementById("mdb-size").addEventListener("input", updateMobileSizeDot);
}

function getMobileColor()     { return document.getElementById("mdb-color").value; }
function getMobileBrushSize() { return parseInt(document.getElementById("mdb-size").value, 10); }

function updateMobileSizeDot() {
  const size = getMobileBrushSize();
  const dot  = document.getElementById("mdb-size-dot");
  const px   = Math.max(4, Math.min(size, 32));
  dot.style.width  = px + "px";
  dot.style.height = px + "px";
}

function toggleMobileEraser(btn) {
  mobileErasing = !mobileErasing;
  btn.classList.toggle("active", mobileErasing);
}

function clearMobileCanvas() {
  const canvas = document.getElementById("mobile-draw-canvas");
  const ctx    = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  mobileErasing = false;
  const eraserBtn = document.getElementById("mdb-eraser-btn");
  if (eraserBtn) eraserBtn.classList.remove("active");
}

async function submitMobileDrawing() {
  const canvas = document.getElementById("mobile-draw-canvas");
  if (isCanvasBlank(canvas)) { showToast("Draw something first! 🖌️"); return; }
  if (!checkSubmitCooldown()) return;

  const btn = document.querySelector('.mdb-btn-save');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const imageUrl = await _cloudinaryUpload(safeCanvasDataUrl(canvas), 'bubz/submissions');
    const submission = {
      id: String(Date.now() + Math.floor(Math.random() * 1000)),
      type: "drawing", data: imageUrl,
      sender: null, requestedVis: "private",
      timestamp: new Date().toISOString(),
    };
    await savePending(submission);
    clearMobileCanvas();
    closeMobileDrawPanel();
    showToast("Drawing sent! Waiting for review ✨");
  } catch {
    localStorage.removeItem(SUBMIT_COOLDOWN_KEY);
    showToast("Failed to send — check your connection and try again 😢");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send ✨'; }
  }
}

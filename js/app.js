/* =============================================
   APP.JS — Shared state, utilities, init, age gate, navigation
   Feature modules: js/gallery.js  js/wall.js  js/send.js  js/admin.js
   ============================================= */

// ─── Shared state ─────────────────────────────
let currentFilter    = "all";   // 'all' | 'sfw' | 'nsfw'
let activeTag        = null;    // string | null — lowercase
let allArtworks      = [];      // merged artwork array
let currentArtwork   = null;    // open gallery lightbox
let currentImageIndex = 0;      // carousel position
let currentWallPost  = null;    // open wall lightbox

let logoClickCount   = 0;
let logoClickTimer   = null;
let adminLoggedIn    = false;
let tagFilterOpen    = false;

// Desktop canvas state (used by js/send.js)
let isDrawing  = false;
let eraserActive = false;
let lastX = 0;
let lastY = 0;

// ─── Shared utilities ─────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function timeAgo(iso) {
  if (!iso) return '';
  const sec = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (sec < 60)  return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30)  return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12)   return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function formatCommentDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours(), m = d.getMinutes();
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast"; toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function showLoader() {
  const el = document.getElementById('page-loader');
  if (el) el.classList.remove('hidden');
}
function hideLoader() {
  const el = document.getElementById('page-loader');
  if (el) el.classList.add('hidden');
}

// ─── Shared Cloudinary upload ──────────────────
async function _cloudinaryUpload(fileOrDataUrl, folder) {
  const fd = new FormData();
  fd.append('file',           fileOrDataUrl);
  fd.append('upload_preset',  CLOUDINARY_PRESET);
  fd.append('folder',         folder);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: fd }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!json.secure_url) throw new Error(json.error?.message || 'Upload failed');
  return json.secure_url;
}

// ─── Cloudinary delivery sizing ────────────────
// Originals are 2-3K px; cards render at ~200-400px. Insert an on-the-fly
// transform so the CDN serves an appropriately sized, auto-format image.
// Non-Cloudinary URLs (data:, local assets) pass through untouched.
function cloudinarySized(url, width) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[^/]*\b(w_\d+|f_auto)/.test(url)) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
async function init() {
  document.title = SITE_CONFIG.title;
  document.getElementById("logo-text").textContent = SITE_CONFIG.logoText;
  const aboutTextEl = document.getElementById("about-text");
  if (aboutTextEl) aboutTextEl.textContent = SITE_CONFIG.aboutText;

  localStorage.removeItem("last-submit-ts");

  showLoader();
  await dbInit();

  // Restore admin session if Supabase session still valid
  const { data: { session } } = await _db.auth.getSession();
  if (session?.user) {
    adminLoggedIn = true;
    document.body.classList.add("admin-logged");
  }

  hideLoader();

  // Merge Supabase extras with static data.js artworks
  const baseIds = new Set(artworks.map((a) => String(a.id)));
  const dedupedExtra = _extraArts.filter((a) => !baseIds.has(String(a.id)));
  allArtworks = [...dedupedExtra, ...artworks];

  // Apply saved overrides
  allArtworks.forEach((art) => {
    const ov = _overrides[String(art.id)];
    if (ov) {
      if (ov.title       != null) art.title       = ov.title;
      if (ov.description != null) art.description = ov.description;
      if (ov.image       != null) art.image       = ov.image;
      if (ov.tags        != null) art.tags        = ov.tags;
      if (ov.nsfw        != null) art.nsfw        = ov.nsfw;
    }
  });

  // Age gate
  const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const ageTs    = localStorage.getItem("age-confirmed-ts");
  const sessionOk = sessionStorage.getItem("age-session");
  const expired  = !ageTs || Date.now() - parseInt(ageTs, 10) > 30 * 24 * 60 * 60 * 1000;
  if (!isLocalhost && !sessionOk && expired) showAgeGate();
  else document.getElementById("age-gate").classList.add("hidden");

  AOS.init({ duration: 700, once: true, offset: 50, easing: "ease-out-cubic" });

  renderTagChips();
  renderGallery();

  setupCanvas();
  initDropZone();

  document.getElementById("logo-text").addEventListener("click", onLogoClick);
  initAutoTagSuggest();
}

// ═══════════════════════════════════════════════
// AGE GATE
// ═══════════════════════════════════════════════
function showAgeGate() {
  document.getElementById("age-gate").classList.remove("hidden");
  spawnFloatingEmojis();
}

function spawnFloatingEmojis() {
  const container = document.getElementById("emoji-container");
  const emojis = ["🌸","✨","🎨","💜","🌙","⭐","🦋","💫","🎀","🌺","💖","🌟"];
  container.innerHTML = "";
  for (let i = 0; i < 18; i++) {
    const el = document.createElement("span");
    el.className = "floating-emoji";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left             = Math.random() * 100 + "vw";
    el.style.animationDuration = 8 + Math.random() * 12 + "s";
    el.style.animationDelay   = Math.random() * 10 + "s";
    el.style.fontSize         = 1.2 + Math.random() * 1.5 + "rem";
    container.appendChild(el);
  }
}

function confirmAge(sessionOnly) {
  if (sessionOnly) sessionStorage.setItem("age-session", "1");
  else             localStorage.setItem("age-confirmed-ts", Date.now().toString());
  const gate = document.getElementById("age-gate");
  if (typeof gsap !== 'undefined') {
    gsap.to(gate, { opacity: 0, scale: 0.95, duration: 0.5, ease: "power2.in",
      onComplete: () => gate.classList.add("hidden") });
  } else {
    gate.classList.add("hidden");
  }
}

function leaveGate() { window.location.href = "about:blank"; }

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p)    => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById("page-" + pageId).classList.add("active");
  const btn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if (btn) btn.classList.add("active");
  if (pageId === "wall") renderWall();
}

// ─── Back to top ──────────────────────────────
(function () {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 400);
  }, { passive: true });
})();

// ─── Lightbox keyboard + swipe ────────────────
(function () {
  let tx = 0;
  document.addEventListener("keydown", (e) => {
    const lb = document.getElementById("lightbox");
    if (!lb || !lb.classList.contains("open")) return;
    if (e.key === "ArrowRight") navigateLightbox(1);
    if (e.key === "ArrowLeft")  navigateLightbox(-1);
  });
  document.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend",   (e) => {
    const lb = document.getElementById("lightbox");
    if (!lb || !lb.classList.contains("open")) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) navigateLightbox(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

// ═══════════════════════════════════════════════
// DOM READY — overlay close + escape + init
// ═══════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  init();

  document.getElementById("lightbox").addEventListener("click", function (e) {
    if (e.target === this) closeLightbox();
  });
  document.getElementById("wall-lightbox").addEventListener("click", function (e) {
    if (e.target === this) closeWallPost();
  });
  // Admin panel: no backdrop close — use ✕ button only

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("admin-password-prompt").classList.contains("hidden")) {
      closeAdminPrompt();
    } else if (document.getElementById("admin-panel").classList.contains("open")) {
      // Escape also disabled for admin panel — prevent accidental close
      return;
    } else if (document.getElementById("wall-lightbox").classList.contains("open")) {
      closeWallPost();
    } else if (document.getElementById("lightbox").classList.contains("open")) {
      closeLightbox();
    }
  });
});

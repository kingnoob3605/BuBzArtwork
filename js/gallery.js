/* =============================================
   GALLERY.JS — Filter, lightbox, reactions, emoji picker, comments
   ============================================= */

// ─── Gallery sort ─────────────────────────────
let currentSort = "newest";
function setSortOrder(val) {
  currentSort = val;
  renderGallery();
}

// ═══════════════════════════════════════════════
// GALLERY: FILTER & TAG
// ═══════════════════════════════════════════════
function setFilter(filter, el) {
  currentFilter = filter;
  document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  if (el) el.classList.add("active");
  renderGallery();
}

function setTagFilter(tag, el) {
  const key = tag.toLowerCase();
  if (activeTag === key) {
    activeTag = null;
    document.querySelectorAll(".tag-chip").forEach((c) => c.classList.remove("active"));
  } else {
    activeTag = key;
    document.querySelectorAll(".tag-chip").forEach((c) => c.classList.remove("active"));
    if (el) el.classList.add("active");
  }
  _updateTagActiveBadge();
  renderGallery();
}

function _updateTagActiveBadge() {
  const badge = document.getElementById("tag-active-badge");
  const toggle = document.getElementById("tag-filter-toggle");
  if (!badge) return;
  if (activeTag) {
    badge.textContent = "#" + activeTag;
    badge.classList.add("visible");
    if (toggle) toggle.classList.add("has-active");
  } else {
    badge.classList.remove("visible");
    if (toggle) toggle.classList.remove("has-active");
  }
}

function toggleTagFilter() {
  tagFilterOpen = !tagFilterOpen;
  const chips = document.getElementById("tag-chips");
  const toggle = document.getElementById("tag-filter-toggle");
  if (!chips || !toggle) return;
  if (tagFilterOpen) {
    chips.classList.add("open");
    toggle.classList.add("open");
  } else {
    chips.classList.remove("open");
    toggle.classList.remove("open");
  }
}

function getFilteredArtworks() {
  const hidden = getHiddenArtIds();
  const filtered = allArtworks
    .filter((art) => !hidden.includes(String(art.id)))
    .filter((art) => {
      const passFilter =
        currentFilter === "all" ||
        (currentFilter === "sfw" && !art.nsfw) ||
        (currentFilter === "nsfw" && art.nsfw);
      const passTag = !activeTag || (art.tags && art.tags.some((t) => t.trim().toLowerCase() === activeTag));
      return passFilter && passTag;
    });
  if (currentSort === "oldest") return filtered.slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (currentSort === "az")     return filtered.slice().sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  return filtered;
}

function renderTagChips() {
  const tagMap = new Map();
  allArtworks.forEach((art) =>
    (art.tags || []).forEach((t) => {
      const key = t.trim().toLowerCase();
      if (key && !tagMap.has(key)) tagMap.set(key, key);
    })
  );
  const container = document.getElementById("tag-chips");
  container.innerHTML = "";
  [...tagMap.keys()].sort().forEach((key) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip" + (activeTag === key ? " active" : "");
    chip.textContent = "#" + escHtml(key);
    chip.dataset.tag = key;
    chip.onclick = function () { setTagFilter(key, this); };
    container.appendChild(chip);
  });
  _updateTagActiveBadge();
}

// ═══════════════════════════════════════════════
// GALLERY: RENDER
// ═══════════════════════════════════════════════
function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  const filtered = getFilteredArtworks();
  grid.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.innerHTML = "<span>🎨</span>No artworks to show here!";
    grid.appendChild(empty);
    return;
  }

  filtered.forEach((art, i) => {
    const card = document.createElement("div");
    card.className = "art-card";
    card.setAttribute("data-aos", "fade-up");
    card.setAttribute("data-aos-delay", Math.min(i * 60, 400));

    const tagsHtml = (art.tags || []).map((t) => `<span class="art-tag">#${escHtml(t)}</span>`).join("");

    const nsfwOverlay = art.nsfw
      ? `<div class="nsfw-blur-overlay">
            <span class="nsfw-blur-icon">🔞</span>
            <span class="nsfw-blur-label">NSFW</span>
            <span class="nsfw-blur-hint">Hover to preview</span>
        </div>`
      : "";

    card.setAttribute("data-art-id", art.id);
    const imgs = (art.images && art.images.length > 1) ? art.images : null;
    let imgWrapHtml;
    if (imgs) {
      const shown = imgs.slice(0, 4);
      const extra = imgs.length - 4;
      const gridClass = imgs.length === 2 ? 'multi-img-grid--2' : imgs.length === 3 ? 'multi-img-grid--3' : 'multi-img-grid--4';
      imgWrapHtml = `<div class="art-card-img-wrap multi-img-grid ${gridClass} ${art.nsfw ? 'is-nsfw' : ''}">
        ${shown.map((url, idx) => `<div class="multi-img-cell"${idx === 3 && extra > 0 ? ` data-extra="+${extra + 1}"` : ''}>
          <img src="${escHtml(url)}" alt="${escHtml(art.title)}" loading="lazy">
        </div>`).join('')}
        ${nsfwOverlay}
        <span class="multi-img-badge">📷 ${imgs.length}</span>
      </div>`;
    } else {
      imgWrapHtml = `<div class="art-card-img-wrap ${art.nsfw ? 'is-nsfw' : ''}">
        <img src="${escHtml(art.image)}" alt="${escHtml(art.title)}" loading="lazy">
        ${nsfwOverlay}
      </div>`;
    }
    card.innerHTML = `
        ${imgWrapHtml}
        <div class="art-card-body">
            ${art.nsfw ? '<span class="nsfw-badge">NSFW</span>' : ""}
            <div class="art-card-title">${escHtml(art.title)}</div>
            <div class="art-card-desc">${escHtml(art.description)}</div>
            <div class="art-card-tags">${tagsHtml}</div>
            <div class="card-reactions">${buildCardReactionsHtml(art.id)}</div>
        </div>`;
    card.onclick = () => openLightbox(art.id);
    grid.appendChild(card);
  });

  AOS.refresh();
}

// ═══════════════════════════════════════════════
// LIGHTBOX
// ═══════════════════════════════════════════════
function openLightbox(id) {
  const art = allArtworks.find((a) => a.id === id);
  if (!art) return;
  currentArtwork = art;
  currentImageIndex = 0;

  _lbSetImage(art, 0);

  document.getElementById("lb-title").textContent = art.title;
  document.getElementById("lb-date").textContent = formatDate(art.date);
  document.getElementById("lb-desc").textContent = art.description;

  const nsfw = document.getElementById("lb-nsfw");
  nsfw.style.display = art.nsfw ? "inline-block" : "none";

  const tagsEl = document.getElementById("lb-tags");
  tagsEl.innerHTML = (art.tags || []).map((t) => `<span class="art-tag">#${escHtml(t)}</span>`).join("");

  renderComments(art.id);
  renderReactions(art.id);

  const lb = document.getElementById("lightbox");
  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  gsap.fromTo(".lightbox-inner",
    { y: 40, opacity: 0, scale: 0.97 },
    { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }
  );
}

function _lbSetImage(art, idx) {
  const imgs = (art.images && art.images.length > 1) ? art.images : [art.image];
  const multi = imgs.length > 1;
  const img = document.getElementById("lb-img");
  img.src = imgs[idx] || art.image;
  img.alt = art.title;

  const prev = document.getElementById("lb-prev");
  const next = document.getElementById("lb-next");
  if (prev) prev.style.display = multi ? "flex" : "none";
  if (next) next.style.display = multi ? "flex" : "none";

  const dotsEl = document.getElementById("lb-dots");
  if (dotsEl) {
    if (multi) {
      dotsEl.innerHTML = imgs.map((_, i) =>
        `<span class="lb-dot${i === idx ? ' active' : ''}" onclick="lbNavImage(${i - idx})"></span>`
      ).join('');
      dotsEl.style.display = "flex";
    } else {
      dotsEl.innerHTML = "";
      dotsEl.style.display = "none";
    }
  }
}

function lbNavImage(dir) {
  if (!currentArtwork) return;
  const imgs = (currentArtwork.images && currentArtwork.images.length > 1) ? currentArtwork.images : [currentArtwork.image];
  currentImageIndex = (currentImageIndex + dir + imgs.length) % imgs.length;
  const img = document.getElementById("lb-img");
  img.style.opacity = "0";
  img.style.transform = "scale(0.97)";
  setTimeout(() => {
    _lbSetImage(currentArtwork, currentImageIndex);
    img.style.opacity = "1";
    img.style.transform = "scale(1)";
  }, 120);
}

function closeLightbox() {
  gsap.to(".lightbox-inner", {
    y: 20, opacity: 0, scale: 0.97, duration: 0.25, ease: "power2.in",
    onComplete: () => {
      const lbEl = document.getElementById("lightbox");
      lbEl.classList.remove("open");
      lbEl.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      currentArtwork = null;
      currentImageIndex = 0;
      gsap.set(".lightbox-inner", { y: 0, opacity: 1, scale: 1 });
    },
  });
}

function navigateLightbox(dir) {
  if (!currentArtwork) return;
  const visible = getFilteredArtworks();
  const idx = visible.findIndex((a) => a.id === currentArtwork.id);
  if (idx === -1) return;
  const next = visible[idx + dir];
  if (next) openLightbox(next.id);
}

// ═══════════════════════════════════════════════
// REACTIONS
// ═══════════════════════════════════════════════
const REACTION_EMOJIS = ["❤️", "🔥", "✨", "😍", "🥺"];

function isEmojiAllowed(emoji) {
  return !BANNED_REACTION_EMOJIS.includes(emoji);
}

function _spawnEmojiFloat(btn, emoji) {
  const el = document.createElement('span');
  el.className = 'emoji-float';
  el.textContent = emoji;
  const r = btn.getBoundingClientRect();
  el.style.left = (r.left + r.width / 2 - 14) + 'px';
  el.style.top  = (r.top - 8) + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function _popReactionBtn(btn) {
  btn.classList.remove('reaction-pop');
  void btn.offsetWidth;
  btn.classList.add('reaction-pop');
  btn.addEventListener('animationend', () => btn.classList.remove('reaction-pop'), { once: true });
}

async function addReaction(artId, emoji, triggerBtn) {
  if (!isEmojiAllowed(emoji)) { showToast("That reaction isn't allowed here 🚫"); return; }
  if (triggerBtn) { _popReactionBtn(triggerBtn); _spawnEmojiFloat(triggerBtn, emoji); }
  await dbIncrementReaction(artId, emoji);
  renderReactions(artId);
  const card = document.querySelector(`.art-card[data-art-id="${artId}"]`);
  if (card) {
    const slot = card.querySelector(".card-reactions");
    if (slot) slot.innerHTML = buildCardReactionsHtml(artId);
  }
}

function buildCardReactionsHtml(artId) {
  const data = getReactions(artId);
  return Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([e, count]) => `<span class="card-reaction">${e} <span class="reaction-count">${count}</span></span>`)
    .join("");
}

function renderReactions(artId) {
  const container = document.getElementById("lb-reactions");
  if (!container) return;
  const data = getReactions(artId);
  const usedEmojis = Object.keys(data).filter((e) => data[e] > 0);
  container.innerHTML =
    usedEmojis.map((e) => {
      const count = data[e] || 0;
      return `<button class="reaction-btn has-count" onclick="addReaction(${artId}, '${e}', this)" title="React with ${e}">
          ${e}<span class="reaction-count">${count}</span>
      </button>`;
    }).join("") +
    `<button class="reaction-btn reaction-add-btn" onclick="openEmojiPicker(${artId}, this)" title="Add reaction">＋</button>`;
}

// ═══════════════════════════════════════════════
// EMOJI PICKER
// ═══════════════════════════════════════════════
const EMOJI_PICKER_DATA = {
  "😊 Faces": ["😀","😂","🥰","😍","🤩","😎","🥺","😭","😤","🥹","😇","🤭","🫶","🤔","😏","🙈","🫠","😵","🥴","😈"],
  "❤️ Hearts": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💗","💓","💞","💕","💟","❣️","💔","🫀","💘","💝"],
  "🔥 Hype":   ["🔥","✨","💥","⚡","🌟","🎉","🎊","🏆","👑","💯","🙌","👏","💪","🫡","🤌","🗣️","📣","💫"],
  "🌸 Cute":   ["🌸","🌺","🌼","🌻","🍓","🍒","🧁","🍰","🎀","🦋","🐱","🐰","🐻","🦊","🐼","🌈","🫧","🍭","🩷"],
  "🎨 Art":    ["🎨","🖌️","✏️","🖊️","📝","🖼️","🎭","🎬","📸","🎵","🎶","🪄","🔮","🧿","🌀","🪩","🎠"],
  "💬 Feels":  ["👍","❓","‼️","💢","💬","🗯️","💤","👀","🫣","🤯","😱","🫨","🙏","🤝","🫂","💅","🫙","🧠"],
  "💦 Lewd":   ["🍆","🍑","🍌","💦","🌮","👅","🫦","🍒","🔞","😏","🥵","💋","🩲","🛏️","😈","🌽","🐓","🔥","🫀","🫣","🙈","🌶️","🎯","🍭","🩸"],
  "🎃 Spooky Month": ["🎃","🌙","🔪","🩸","💀","☠️","👁️","🦷","🪓","🗡️","🧟","👹","😱","🕷️","🦇","🌑","🩻","🫀","🧛","👻","⛓️","🔗","🪦","🩹","🌚","🥩","🍖","🦴","🍗","🥓"],
};

const EMOJI_FLAT = Object.values(EMOJI_PICKER_DATA).flat().filter(isEmojiSafe);

function isEmojiSafe(e) {
  return !BANNED_REACTION_EMOJIS.includes(e);
}

let _pickerArtId = null;
let _pickerContext = "art"; // 'art' | 'wall'

function openEmojiPicker(artId, btn, context = "art") {
  closeEmojiPicker();
  _pickerArtId = artId;
  _pickerContext = context;

  const picker = document.createElement("div");
  picker.id = "emoji-picker";
  picker.className = "emoji-picker";
  picker.innerHTML = `
      <div class="ep-search-wrap">
          <input class="ep-search" placeholder="Search emoji…" oninput="filterEmojiPicker(this.value)" autofocus />
      </div>
      <div class="ep-body" id="ep-body">
          ${buildEmojiPickerBody("")}
      </div>`;

  document.body.appendChild(picker);
  const rect = btn.getBoundingClientRect();
  const pickerW = 280;
  let left = rect.left;
  if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
  picker.style.left = left + "px";

  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow >= 240) {
    picker.style.top = rect.bottom + window.scrollY + 6 + "px";
  } else {
    picker.style.top = rect.top + window.scrollY - 6 + "px";
    picker.style.transform = "translateY(-100%)";
  }

  setTimeout(() => document.addEventListener("click", onPickerOutsideClick, { once: true }), 0);
}

function buildEmojiPickerBody(query) {
  const q = query.trim().toLowerCase();
  if (q) {
    const matches = EMOJI_FLAT.filter((e) => e.includes(q));
    if (!matches.length) return `<div class="ep-empty">No results 😕</div>`;
    return `<div class="ep-grid">${matches.map((e) => `<button class="ep-emoji" onclick="pickEmoji('${e}')">${e}</button>`).join("")}</div>`;
  }
  return Object.entries(EMOJI_PICKER_DATA)
    .map(([cat, emojis]) => {
      const safe = emojis.filter(isEmojiSafe);
      if (!safe.length) return "";
      return `<div class="ep-cat-label">${cat}</div>
      <div class="ep-grid">${safe.map((e) => `<button class="ep-emoji" onclick="pickEmoji('${e}')">${e}</button>`).join("")}</div>`;
    }).join("");
}

function filterEmojiPicker(query) {
  const body = document.getElementById("ep-body");
  if (!body) return;
  const isBanned = BANNED_WORDS.some((w) => query.toLowerCase().includes(w.toLowerCase()));
  body.innerHTML = isBanned
    ? `<div class="ep-empty">That search isn't allowed 🚫</div>`
    : buildEmojiPickerBody(query);
}

function pickEmoji(emoji) {
  if (_pickerArtId !== null) {
    if (_pickerContext === "wall") addWallReaction(_pickerArtId, emoji);
    else addReaction(_pickerArtId, emoji);
  }
  closeEmojiPicker();
}

function closeEmojiPicker() {
  const p = document.getElementById("emoji-picker");
  if (p) p.remove();
  document.removeEventListener("click", onPickerOutsideClick);
}

function onPickerOutsideClick(e) {
  const p = document.getElementById("emoji-picker");
  if (p && !p.contains(e.target)) closeEmojiPicker();
}

// ═══════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════
const COMMENT_AVATARS = ['🐰','🦊','🐱','🐸','🌸','⭐','🎀','🍓','🌙','🎨'];
const COMMENT_MAX_CHARS = 300;
const COMMENT_COOLDOWN_MS = 5000;
let _lastCommentTime = 0;

function checkCommentCooldown() {
  const now = Date.now();
  const diff = now - _lastCommentTime;
  if (_lastCommentTime && diff < COMMENT_COOLDOWN_MS) {
    const secs = Math.ceil((COMMENT_COOLDOWN_MS - diff) / 1000);
    showToast(`Please wait ${secs}s before commenting again! ⏳`);
    return false;
  }
  _lastCommentTime = now;
  return true;
}

function renderComments(artId) {
  const list = document.getElementById("comments-list");
  const comments = getComments(artId);
  if (comments.length === 0) {
    list.innerHTML = `<div class="comment-empty">
      <span class="comment-empty-icon">💬</span>
      <span>No comments yet — be the first!</span>
    </div>`;
    return;
  }
  list.innerHTML = comments
    .map((c, i) => {
      const isOwner = !!c.is_owner;
      const avatar = isOwner ? '🎨' : COMMENT_AVATARS[i % COMMENT_AVATARS.length];
      const ownerClass = isOwner ? ' comment-item--owner' : '';
      const ownerBadge = isOwner ? `<span class="comment-owner-badge">👑 BuBz</span>` : '';
      const delBtn = adminLoggedIn
        ? `<button class="comment-delete" onclick="deleteComment(${JSON.stringify(artId)}, '${c.id}')" title="Delete">✕</button>`
        : '';
      return `
        <div class="comment-item${ownerClass}">
          <div class="comment-avatar">${avatar}</div>
          <div class="comment-bubble">
            ${ownerBadge}
            <div class="comment-text">${escHtml(c.text)}</div>
            <div class="comment-foot">
              <span class="comment-meta">${escHtml(formatCommentDate(c.date))}</span>
              ${delBtn}
            </div>
          </div>
        </div>`;
    }).join("");
  list.scrollTop = list.scrollHeight;
}

async function deleteComment(artId, commentId) {
  if (!adminLoggedIn) return;
  if (!confirm("Delete this comment?")) return;
  await dbDeleteComment(commentId);
  renderComments(artId);
}

function isBubzName(name) {
  return name && /bubz/i.test(name.trim());
}

function showBubzNameWarning() {
  showToast("nah bro you ain't slick 💀 that name's taken, pick another one lol");
}

function isBannedLocal(text) {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((w) => {
    const escaped = w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(lower);
  });
}

function isBanned(text) {
  if (isBannedLocal(text)) return true;
  return BANNED_REACTION_EMOJIS.some((e) => text.includes(e));
}

function showCommentWarning(msg) {
  const el = document.getElementById("comment-warning");
  el.textContent = msg;
  el.classList.add("visible");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("visible"), 3500);
}

function showXPopup() {
  const existing = document.getElementById("sassy-popup");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "sassy-popup";
  el.className = "sassy-popup";
  el.innerHTML = `
      <div class="sassy-popup-inner">
          <span class="sassy-popup-emoji">🐦</span>
          <div class="sassy-popup-text">
              <strong>Yeah... no!</strong>
              <span>Sorry, this app is only for gooning but I rarely post there.</span>
          </div>
          <button class="sassy-popup-close" onclick="this.closest('.sassy-popup').remove()">✕</button>
      </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 4000);
}

function showSassyBannedPopup() {
  const existing = document.getElementById("sassy-popup");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "sassy-popup";
  el.className = "sassy-popup";
  el.innerHTML = `
      <div class="sassy-popup-inner">
          <span class="sassy-popup-emoji">🙄</span>
          <div class="sassy-popup-text">
              <strong>Come on, really?</strong>
              <span>Get your negative feedback somewhere else.</span>
          </div>
          <button class="sassy-popup-close" onclick="this.closest('.sassy-popup').remove()">✕</button>
      </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 4000);
}

async function postComment() {
  if (!currentArtwork) return;
  const input = document.getElementById("comment-input");
  const text = input.value.trim();
  if (!text) return;

  if (text.length > COMMENT_MAX_CHARS) {
    showToast(`Comments must be ${COMMENT_MAX_CHARS} characters or less! ✏️`);
    return;
  }

  if (!checkCommentCooldown()) return;

  if (isBanned(text)) {
    showSassyBannedPopup();
    input.value = "";
    updateCommentCounter(input);
    return;
  }

  await dbAddComment(currentArtwork.id, text, adminLoggedIn);
  input.value = "";
  updateCommentCounter(input);
  renderComments(currentArtwork.id);
  const postBtn = document.getElementById('btn-post-comment');
  if (postBtn) {
    postBtn.classList.remove('btn-pulse');
    void postBtn.offsetWidth;
    postBtn.classList.add('btn-pulse');
    postBtn.addEventListener('animationend', () => postBtn.classList.remove('btn-pulse'), { once: true });
  }
}

function updateCommentCounter(input) {
  const counter = document.getElementById("comment-char-counter");
  if (!counter) return;
  const len = input.value.length;
  counter.textContent = `${len}/${COMMENT_MAX_CHARS}`;
  counter.classList.toggle("over", len > COMMENT_MAX_CHARS);
}

function updateMsgCounter(textarea) {
  const counter = document.getElementById("msg-char-counter");
  if (!counter) return;
  const len = textarea.value.length;
  const max = parseInt(textarea.maxLength) || 500;
  counter.textContent = `${len}/${max}`;
  counter.classList.toggle("over", len >= max);
}

function onCommentKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); }
}

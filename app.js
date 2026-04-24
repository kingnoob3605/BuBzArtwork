/* =============================================
   APP.JS — Art Gallery Application
   ============================================= */

// ─── State ────────────────────────────────────
let currentFilter   = 'all';   // 'all' | 'sfw' | 'nsfw'
let activeTag       = null;    // string | null
let allArtworks     = [];      // merged artworks array
let currentArtwork  = null;    // open lightbox artwork

let logoClickCount  = 0;
let logoClickTimer  = null;
let adminLoggedIn   = false;

// Canvas state
let isDrawing       = false;
let eraserActive    = false;
let lastX           = 0;
let lastY           = 0;

// ─── Utility: escape HTML to prevent XSS ──────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── Utility: format date ─────────────────────
function formatDate(str) {
    if (!str) return '';
    const [y, m, d] = str.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function formatCommentDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const h = d.getHours(), m = d.getMinutes();
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ─── Utility: show toast ──────────────────────
function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─── Init ─────────────────────────────────────
async function init() {
    document.title = SITE_CONFIG.title;
    document.getElementById('logo-text').textContent = SITE_CONFIG.logoText;
    const aboutTextEl = document.getElementById('about-text');
    if (aboutTextEl) aboutTextEl.textContent = SITE_CONFIG.aboutText;

    // Load all data from Supabase into in-memory cache
    await dbInit();

    // Merge extra artworks from Supabase cache (dedup by id, prepend)
    const baseIds = new Set(artworks.map(a => String(a.id)));
    const dedupedExtra = _extraArts.filter(a => !baseIds.has(String(a.id)));
    allArtworks = [...dedupedExtra, ...artworks];

    // Apply saved overrides (title / desc / image / tags / nsfw)
    allArtworks.forEach(art => {
        const ov = _overrides[String(art.id)];
        if (ov) {
            if (ov.title       !== undefined && ov.title       !== null) art.title       = ov.title;
            if (ov.description !== undefined && ov.description !== null) art.description = ov.description;
            if (ov.image       !== undefined && ov.image       !== null) art.image       = ov.image;
            if (ov.tags        !== undefined && ov.tags        !== null) art.tags        = ov.tags;
            if (ov.nsfw        !== undefined && ov.nsfw        !== null) art.nsfw        = ov.nsfw;
        }
    });

    // Age gate — check expiry (30 days) and session flag (stays in localStorage — per-user)
    const ageTs = localStorage.getItem('age-confirmed-ts');
    const sessionOk = sessionStorage.getItem('age-session');
    const expired = !ageTs || (Date.now() - parseInt(ageTs, 10)) > 30 * 24 * 60 * 60 * 1000;
    if (!sessionOk && expired) {
        showAgeGate();
    } else {
        document.getElementById('age-gate').classList.add('hidden');
    }

    // AOS
    AOS.init({ duration: 700, once: true, offset: 50, easing: 'ease-out-cubic' });

    // Gallery
    renderTagChips();
    renderGallery();

    // Canvas setup
    setupCanvas();

    // Logo click counter for admin
    document.getElementById('logo-text').addEventListener('click', onLogoClick);
}

// ═══════════════════════════════════════════════
// AGE GATE
// ═══════════════════════════════════════════════
function showAgeGate() {
    const gate = document.getElementById('age-gate');
    gate.classList.remove('hidden');
    spawnFloatingEmojis();
}

function spawnFloatingEmojis() {
    const container = document.getElementById('emoji-container');
    const emojis = ['🌸','✨','🎨','💜','🌙','⭐','🦋','💫','🎀','🌺','💖','🌟'];
    container.innerHTML = '';
    for (let i = 0; i < 18; i++) {
        const el = document.createElement('span');
        el.className = 'floating-emoji';
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDuration = (8 + Math.random() * 12) + 's';
        el.style.animationDelay = (Math.random() * 10) + 's';
        el.style.fontSize = (1.2 + Math.random() * 1.5) + 'rem';
        container.appendChild(el);
    }
}

function confirmAge(sessionOnly) {
    if (sessionOnly) {
        sessionStorage.setItem('age-session', '1');
    } else {
        localStorage.setItem('age-confirmed-ts', Date.now().toString());
    }
    const gate = document.getElementById('age-gate');
    gsap.to(gate, {
        opacity: 0, scale: 0.95, duration: 0.5, ease: 'power2.in',
        onComplete: () => gate.classList.add('hidden')
    });
}

function leaveGate() {
    window.location.href = 'about:blank';
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    const btn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
    if (btn) btn.classList.add('active');
    if (pageId === 'wall') renderWall();
}

// ═══════════════════════════════════════════════
// GALLERY: FILTER & TAG
// ═══════════════════════════════════════════════
function setFilter(filter, el) {
    currentFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    renderGallery();
}

function setTagFilter(tag, el) {
    if (activeTag === tag) {
        activeTag = null;
        document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
    } else {
        activeTag = tag;
        document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');
    }
    renderGallery();
}

function getFilteredArtworks() {
    const hidden = getHiddenArtIds(); // returns string array from db.js cache
    const filtered = allArtworks.filter(art => !hidden.includes(String(art.id))).filter(art => {
        const passFilter =
            currentFilter === 'all' ||
            (currentFilter === 'sfw'  && !art.nsfw) ||
            (currentFilter === 'nsfw' &&  art.nsfw);
        const passTag = !activeTag || (art.tags && art.tags.includes(activeTag));
        return passFilter && passTag;
    });
    if (currentSort === 'oldest') {
        return filtered.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
    if (currentSort === 'az') {
        return filtered.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    return filtered; // 'newest' = default allArtworks order (prepended newest first)
}

function renderTagChips() {
    const tagSet = new Set();
    allArtworks.forEach(art => (art.tags || []).forEach(t => tagSet.add(t)));
    const container = document.getElementById('tag-chips');
    container.innerHTML = '';
    tagSet.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip' + (activeTag === tag ? ' active' : '');
        chip.textContent = '#' + escHtml(tag);
        chip.onclick = function() { setTagFilter(tag, this); };
        container.appendChild(chip);
    });
}

// ═══════════════════════════════════════════════
// GALLERY: RENDER
// ═══════════════════════════════════════════════
function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    const filtered = getFilteredArtworks();
    grid.innerHTML = '';

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'gallery-empty';
        empty.innerHTML = '<span>🎨</span>No artworks to show here!';
        grid.appendChild(empty);
        return;
    }

    filtered.forEach((art, i) => {
        const card = document.createElement('div');
        card.className = 'art-card';
        card.setAttribute('data-aos', 'fade-up');
        card.setAttribute('data-aos-delay', Math.min(i * 60, 400));

        const tagsHtml = (art.tags || [])
            .map(t => `<span class="art-tag">#${escHtml(t)}</span>`)
            .join('');

        const nsfwOverlay = art.nsfw ? `
            <div class="nsfw-blur-overlay">
                <span class="nsfw-blur-icon">🔞</span>
                <span class="nsfw-blur-label">NSFW</span>
                <span class="nsfw-blur-hint">Hover to preview</span>
            </div>` : '';

        card.setAttribute('data-art-id', art.id);
        card.innerHTML = `
            <div class="art-card-img-wrap ${art.nsfw ? 'is-nsfw' : ''}">
                <img src="${escHtml(art.image)}" alt="${escHtml(art.title)}" loading="lazy">
                ${nsfwOverlay}
            </div>
            <div class="art-card-body">
                ${art.nsfw ? '<span class="nsfw-badge">NSFW</span>' : ''}
                <div class="art-card-title">${escHtml(art.title)}</div>
                <div class="art-card-desc">${escHtml(art.description)}</div>
                <div class="art-card-tags">${tagsHtml}</div>
                <div class="card-reactions">${buildCardReactionsHtml(art.id)}</div>
            </div>
        `;
        card.onclick = () => openLightbox(art.id);
        grid.appendChild(card);
    });

    AOS.refresh();
}

// ═══════════════════════════════════════════════
// LIGHTBOX
// ═══════════════════════════════════════════════
function openLightbox(id) {
    const art = allArtworks.find(a => a.id === id);
    if (!art) return;
    currentArtwork = art;

    document.getElementById('lb-img').src = art.image;
    document.getElementById('lb-img').alt = art.title;
    document.getElementById('lb-title').textContent = art.title;
    document.getElementById('lb-date').textContent = formatDate(art.date);
    document.getElementById('lb-desc').textContent = art.description;

    const nsfw = document.getElementById('lb-nsfw');
    nsfw.style.display = art.nsfw ? 'inline-block' : 'none';

    const tagsEl = document.getElementById('lb-tags');
    tagsEl.innerHTML = (art.tags || [])
        .map(t => `<span class="art-tag">#${escHtml(t)}</span>`)
        .join('');

    renderComments(art.id);
    renderReactions(art.id);

    const lb = document.getElementById('lightbox');
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';

    gsap.fromTo('.lightbox-inner',
        { y: 40, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' }
    );
}

function closeLightbox() {
    gsap.to('.lightbox-inner', {
        y: 20, opacity: 0, scale: 0.97, duration: 0.25, ease: 'power2.in',
        onComplete: () => {
            document.getElementById('lightbox').classList.remove('open');
            document.body.style.overflow = '';
            currentArtwork = null;
            gsap.set('.lightbox-inner', { y: 0, opacity: 1, scale: 1 });
        }
    });
}

// ═══════════════════════════════════════════════
// REACTIONS
// ═══════════════════════════════════════════════
const REACTION_EMOJIS = ['❤️','🔥','✨','😍','🥺'];

// getReactions / saveReactions are now provided by db.js (synchronous cache reads)

function isEmojiAllowed(emoji) {
    return !BANNED_REACTION_EMOJIS.includes(emoji);
}

async function addReaction(artId, emoji) {
    if (!isEmojiAllowed(emoji)) {
        showToast('That reaction isn\'t allowed here 🚫');
        return;
    }
    await dbIncrementReaction(artId, emoji);
    renderReactions(artId);
    // Also refresh the card in the gallery
    const card = document.querySelector(`.art-card[data-art-id="${artId}"]`);
    if (card) {
        const slot = card.querySelector('.card-reactions');
        if (slot) slot.innerHTML = buildCardReactionsHtml(artId);
    }
}

function buildCardReactionsHtml(artId) {
    const data = getReactions(artId);
    return Object.entries(data)
        .filter(([, count]) => count > 0)
        .map(([e, count]) => `<span class="card-reaction">${e} <span class="reaction-count">${count}</span></span>`)
        .join('');
}

// Emoji picker data — browseable categories + search
const EMOJI_PICKER_DATA = {
    '😊 Faces':      ['😀','😂','🥰','😍','🤩','😎','🥺','😭','😤','🥹','😇','🤭','🫶','🤔','😏','🙈','🫠','😵','🥴','😈'],
    '❤️ Hearts':     ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💗','💓','💞','💕','💟','❣️','💔','🫀','💘','💝'],
    '🔥 Hype':       ['🔥','✨','💥','⚡','🌟','🎉','🎊','🏆','👑','💯','🙌','👏','💪','🫡','🤌','🗣️','📣','💫'],
    '🌸 Cute':       ['🌸','🌺','🌼','🌻','🍓','🍒','🧁','🍰','🎀','🦋','🐱','🐰','🐻','🦊','🐼','🌈','🫧','🍭','🩷'],
    '🎨 Art':        ['🎨','🖌️','✏️','🖊️','📝','🖼️','🎭','🎬','📸','🎵','🎶','🪄','🔮','🧿','🌀','🪩','🎠'],
    '💬 Feels':      ['👍','❓','‼️','💢','💬','🗯️','💤','👀','🫣','🤯','😱','🫨','🙏','🤝','🫂','💅','🫙','🧠'],
    '💦 Lewd':       ['🍆','🍑','🍌','💦','🌮','👅','🫦','🍒','🔞','😏','🥵','💋','🩲','🛏️','😈','🌽','🐓','🔥','🫀','🫣','🙈','🌶️','🎯','🍭','🩸'],
    '🎃 Spooky Month':['🎃','🌙','🔪','🩸','💀','☠️','👁️','🦷','🪓','🗡️','🧟','👹','😱','🕷️','🦇','🌑','🩻','🫀','🧛','👻','⛓️','🔗','🪦','🩹','🌚','🥩','🍖','🦴','🍗','🥓'],
};

const EMOJI_FLAT = Object.values(EMOJI_PICKER_DATA).flat().filter(isEmojiSafe);

function isEmojiSafe(e) {
    return !BANNED_REACTION_EMOJIS.includes(e);
}

let _pickerArtId   = null;
let _pickerContext = 'art'; // 'art' | 'wall'

function renderReactions(artId) {
    const container = document.getElementById('lb-reactions');
    if (!container) return;
    const data = getReactions(artId);

    // Only show emojis that have actually been reacted with
    const usedEmojis = Object.keys(data).filter(e => data[e] > 0);

    container.innerHTML = usedEmojis.map(e => {
        const count = data[e] || 0;
        return `<button class="reaction-btn has-count" onclick="addReaction(${artId}, '${e}')" title="React with ${e}">
            ${e}<span class="reaction-count">${count}</span>
        </button>`;
    }).join('') + `<button class="reaction-btn reaction-add-btn" onclick="openEmojiPicker(${artId}, this)" title="Add reaction">＋</button>`;
}

function openEmojiPicker(artId, btn, context = 'art') {
    closeEmojiPicker();
    _pickerArtId   = artId;
    _pickerContext = context;

    const picker = document.createElement('div');
    picker.id = 'emoji-picker';
    picker.className = 'emoji-picker';
    picker.innerHTML = `
        <div class="ep-search-wrap">
            <input class="ep-search" placeholder="Search emoji…" oninput="filterEmojiPicker(this.value)" autofocus />
        </div>
        <div class="ep-body" id="ep-body">
            ${buildEmojiPickerBody('')}
        </div>
    `;

    // Position near the + button
    document.body.appendChild(picker);
    const rect = btn.getBoundingClientRect();
    const pickerW = 280;
    let left = rect.left;
    if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
    picker.style.left = left + 'px';

    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow >= 240) {
        picker.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    } else {
        picker.style.top = (rect.top + window.scrollY - 6) + 'px';
        picker.style.transform = 'translateY(-100%)';
    }

    setTimeout(() => document.addEventListener('click', onPickerOutsideClick, { once: true }), 0);
}

function buildEmojiPickerBody(query) {
    const q = query.trim().toLowerCase();
    if (q) {
        const matches = EMOJI_FLAT.filter(e => e.includes(q));
        if (!matches.length) return `<div class="ep-empty">No results 😕</div>`;
        return `<div class="ep-grid">${matches.map(e => `<button class="ep-emoji" onclick="pickEmoji('${e}')">${e}</button>`).join('')}</div>`;
    }
    return Object.entries(EMOJI_PICKER_DATA).map(([cat, emojis]) => {
        const safe = emojis.filter(isEmojiSafe);
        if (!safe.length) return '';
        return `<div class="ep-cat-label">${cat}</div>
        <div class="ep-grid">${safe.map(e => `<button class="ep-emoji" onclick="pickEmoji('${e}')">${e}</button>`).join('')}</div>`;
    }).join('');
}

function filterEmojiPicker(query) {
    const body = document.getElementById('ep-body');
    if (!body) return;
    const isBanned = BANNED_WORDS.some(w => query.toLowerCase().includes(w.toLowerCase()));
    body.innerHTML = isBanned
        ? `<div class="ep-empty">That search isn't allowed 🚫</div>`
        : buildEmojiPickerBody(query);
}

function pickEmoji(emoji) {
    if (_pickerArtId !== null) {
        if (_pickerContext === 'wall') addWallReaction(_pickerArtId, emoji);
        else addReaction(_pickerArtId, emoji);
    }
    closeEmojiPicker();
}

function closeEmojiPicker() {
    const p = document.getElementById('emoji-picker');
    if (p) p.remove();
    document.removeEventListener('click', onPickerOutsideClick);
}

function onPickerOutsideClick(e) {
    const p = document.getElementById('emoji-picker');
    if (p && !p.contains(e.target)) closeEmojiPicker();
}

// ═══════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════
// getComments is now provided by db.js (synchronous cache read)

function renderComments(artId) {
    const list = document.getElementById('comments-list');
    const comments = getComments(artId);
    if (comments.length === 0) {
        list.innerHTML = '<span class="comment-no">No comments yet, be the first! ✨</span>';
        return;
    }
    list.innerHTML = comments.map(c => `
        <div class="comment-item">
            <div class="comment-top">
                <div class="comment-meta">${escHtml(formatCommentDate(c.date))}</div>
                ${adminLoggedIn ? `<button class="comment-delete" onclick="deleteComment(${JSON.stringify(artId)}, '${c.id}')" title="Delete comment">🗑</button>` : ''}
            </div>
            <div>${escHtml(c.text)}</div>
        </div>
    `).join('');
    list.scrollTop = list.scrollHeight;
}

async function deleteComment(artId, commentId) {
    if (!confirm('Delete this comment?')) return;
    await dbDeleteComment(commentId);
    renderComments(artId);
}

function isBannedLocal(text) {
    const lower = text.toLowerCase();
    return BANNED_WORDS.some(w => {
        const escaped = w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`).test(lower);
    });
}

function isBanned(text) {
    if (isBannedLocal(text)) return true;
    return BANNED_REACTION_EMOJIS.some(e => text.includes(e));
}

function showCommentWarning(msg) {
    const el = document.getElementById('comment-warning');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 3500);
}

function showXPopup() {
    const existing = document.getElementById('sassy-popup');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'sassy-popup';
    el.className = 'sassy-popup';
    el.innerHTML = `
        <div class="sassy-popup-inner">
            <span class="sassy-popup-emoji">🐦</span>
            <div class="sassy-popup-text">
                <strong>Heads up!</strong>
                <span>Sorry, this app is only for gooning but I rarely post there.</span>
            </div>
            <button class="sassy-popup-close" onclick="this.closest('.sassy-popup').remove()">✕</button>
        </div>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
    }, 4000);
}

function showSassyBannedPopup() {
    // Remove any existing one first
    const existing = document.getElementById('sassy-popup');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'sassy-popup';
    el.className = 'sassy-popup';
    el.innerHTML = `
        <div class="sassy-popup-inner">
            <span class="sassy-popup-emoji">🙄</span>
            <div class="sassy-popup-text">
                <strong>Come on, really?</strong>
                <span>Get your negative feedback somewhere else.</span>
            </div>
            <button class="sassy-popup-close" onclick="this.closest('.sassy-popup').remove()">✕</button>
        </div>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
    }, 4000);
}

async function postComment() {
    if (!currentArtwork) return;
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text) return;

    if (text.length > COMMENT_MAX_CHARS) {
        showToast(`Comments must be ${COMMENT_MAX_CHARS} characters or less! ✏️`);
        return;
    }

    if (!checkCommentCooldown()) return;

    if (isBanned(text)) {
        showSassyBannedPopup();
        input.value = '';
        updateCommentCounter(input);
        return;
    }

    await dbAddComment(currentArtwork.id, text);
    input.value = '';
    updateCommentCounter(input);
    renderComments(currentArtwork.id);
}

function updateCommentCounter(input) {
    const counter = document.getElementById('comment-char-counter');
    if (!counter) return;
    const len = input.value.length;
    counter.textContent = `${len}/${COMMENT_MAX_CHARS}`;
    counter.classList.toggle('over', len > COMMENT_MAX_CHARS);
}

function onCommentKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        postComment();
    }
}

// ═══════════════════════════════════════════════
// SEND ME ART PAGE — IDENTITY (anon vs named)
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// VISIBILITY TOGGLE (Public / Private)
// ═══════════════════════════════════════════════
function setVisibility(tab, vis, btn) {
    document.querySelectorAll(`#${tab}-visibility-row .vis-btn`)
        .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const hint = document.getElementById(tab + '-vis-hint');
    if (hint) {
        hint.textContent = vis === 'public'
            ? 'Everyone can see this on the Wall page'
            : 'Only you (admin) can see this';
    }
}

function getVisibility(tab) {
    const btn = document.querySelector(`#${tab}-visibility-row .vis-btn.active`);
    return btn ? btn.dataset.vis : 'private';
}

// ═══════════════════════════════════════════════
// WALL PAGE
// ═══════════════════════════════════════════════
let wallFilter = 'all';

// getPublicPosts / getPending / getSubmissions / savePending / removePending / savePublicPosts
// are now provided by db.js (synchronous cache reads, async writes)

async function approveToWall(id) {
    const item = _pending.find(p => p.id === id);
    if (!item) return;
    await removePending(id);
    await dbAddPublicPost(item);
    renderPending();
    renderWall();
    updatePendingBadge();
    showToast('✅ Approved! Now on the Wall!');
}
async function approvePrivateToWall(id) {
    const item = _inbox.find(p => p.id === id);
    if (!item) return;
    await dbDeletePrivate(id);
    await dbAddPublicPost({ ...item, requestedVis: 'public' });
    renderSubmissions();
    renderWall();
    showToast('✅ Moved to Wall!');
}
async function approvePrivate(id) {
    const item = _pending.find(p => p.id === id);
    if (!item) return;
    await removePending(id);
    await dbAddPrivate(item);
    renderPending();
    updatePendingBadge();
    showToast('🔒 Kept as private submission.');
}
async function deletePending(id) {
    await removePending(id);
    renderPending();
    updatePendingBadge();
    showToast('🗑 Submission deleted.');
}
async function deletePrivateSub(id) {
    await dbDeletePrivate(id);
    renderSubmissions();
    showToast('🗑 Submission deleted.');
}

function setWallFilter(filter, el) {
    wallFilter = filter;
    document.querySelectorAll('.wall-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    renderWall();
}

// getWallReactions is now provided by db.js (synchronous cache read)

async function addWallReaction(postId, emoji) {
    if (!isEmojiAllowed(emoji)) { showToast('That reaction isn\'t allowed here 🚫'); return; }
    await dbIncrementWallReaction(postId, emoji);
    renderWallReactions(postId);
}
function renderWallReactions(postId) {
    const container = document.getElementById('wall-reactions-' + postId);
    if (!container) return;
    container.innerHTML = buildWallReactionsHtml(postId);
}

function renderWall() {
    const grid = document.getElementById('wall-grid');
    if (!grid) return;
    let posts = getPublicPosts().slice().reverse();
    if (wallFilter !== 'all') posts = posts.filter(p => p.type === wallFilter);

    if (posts.length === 0) {
        grid.innerHTML = '<div class="wall-empty"><span>🌸</span><p>No public posts yet! Be the first to share something! ✨</p></div>';
        return;
    }

    grid.innerHTML = posts.map(post => {
        const sender = post.sender
            ? `<span class="wall-sender">✏️ ${escHtml(post.sender)}</span>`
            : `<span class="wall-sender anon">🙈 Anonymous</span>`;
        const date = formatCommentDate(post.timestamp);
        const reactionsHtml = buildWallReactionsHtml(post.id);

        const footer = `<div class="wall-card-footer">
                    <span class="wall-type-badge">${post.type === 'drawing' ? '🎨 Drawing' : '💬 Message'}</span>
                    ${sender}
                    <span class="wall-date">${escHtml(date)}</span>
                </div>
                <div class="wall-reactions-row" id="wall-reactions-${post.id}">
                    ${reactionsHtml}
                </div>`;

        if (post.type === 'drawing') {
            return `<div class="wall-card">
                <div class="wall-card-img"><img src="${post.data}" alt="Drawing" loading="lazy"></div>
                ${footer}
            </div>`;
        } else {
            return `<div class="wall-card">
                <div class="wall-card-text">${escHtml(post.data)}</div>
                ${footer}
            </div>`;
        }
    }).join('');
}

function buildWallReactionsHtml(postId) {
    const data = getWallReactions(postId);
    const used = Object.keys(data).filter(e => data[e] > 0);
    return used.map(e =>
        `<button class="reaction-btn has-count wall-reaction-btn" onclick="addWallReaction('${postId}','${escHtml(e)}')" title="React with ${escHtml(e)}">
            ${escHtml(e)}<span class="reaction-count">${data[e]}</span>
        </button>`
    ).join('') + `<button class="reaction-btn reaction-add-btn wall-reaction-btn" onclick="openEmojiPicker('${postId}',this,'wall')" title="Add reaction">＋</button>`;
}

async function deletePublicPost(id) {
    if (!confirm('Delete this public post?')) return;
    await dbDeletePublicPost(id);
    renderWall();
}

function setIdentityMode(tab, mode, btn) {
    const container = document.getElementById(tab + '-identity');
    container.querySelectorAll('.identity-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const nameInput = document.getElementById(tab + '-name');
    if (mode === 'named') {
        nameInput.classList.add('visible');
        setTimeout(() => nameInput.focus(), 50);
    } else {
        nameInput.classList.remove('visible');
        nameInput.value = '';
    }
}

function getSenderName(tab) {
    const btn = document.querySelector(`#${tab}-identity .identity-btn.active`);
    if (!btn || btn.dataset.mode === 'anon') return null;
    const val = document.getElementById(tab + '-name').value.trim();
    return val || null;
}



// ═══════════════════════════════════════════════
// SEND ME ART PAGE — TAB SWITCHING
// ═══════════════════════════════════════════════
function showSendTab(tab) {
    document.querySelectorAll('.send-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.send-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.send-tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('send-tab-' + tab).classList.add('active');
}

// ═══════════════════════════════════════════════
// CANVAS DRAWING
// ═══════════════════════════════════════════════
function setupCanvas() {
    const canvas = document.getElementById('draw-canvas');
    const ctx    = canvas.getContext('2d');

    // Fill with white on init
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches && e.touches[0]) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top)  * scaleY
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY
        };
    }

    function startDraw(e) {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
        // Dot for click without drag
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, getBrushSize() / 2, 0, Math.PI * 2);
        ctx.fillStyle = eraserActive ? '#ffffff' : getColor();
        ctx.fill();
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = eraserActive ? '#ffffff' : getColor();
        ctx.lineWidth   = getBrushSize();
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
    }

    function stopDraw(e) {
        isDrawing = false;
    }

    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove',  draw,      { passive: false });
    canvas.addEventListener('touchend',   stopDraw);
}

function getColor()     { return document.getElementById('color-picker').value; }
function getBrushSize() { return parseInt(document.getElementById('brush-size').value, 10) || 6; }

function toggleEraser(btn) {
    eraserActive = !eraserActive;
    btn.classList.toggle('active', eraserActive);
    btn.textContent = eraserActive ? '✏️ Draw' : '🧹 Eraser';
}

function clearCanvas() {
    const canvas = document.getElementById('draw-canvas');
    const ctx    = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ═══════════════════════════════════════════════
// SUBMISSIONS
// ═══════════════════════════════════════════════
// getSubmissions is now provided by db.js (synchronous cache read)

function isCanvasBlank(canvas) {
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Blank = every pixel is white (255,255,255,255) or fully transparent
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] === 0) continue; // transparent — skip
        if (pixels[i] !== 255 || pixels[i+1] !== 255 || pixels[i+2] !== 255) return false;
    }
    return true;
}

function safeCanvasDataUrl(canvas) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // JPEG keeps size small
    const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap
    if (dataUrl.length > MAX_BYTES) {
        // Re-export at lower quality if too large
        return canvas.toDataURL('image/jpeg', 0.5);
    }
    return dataUrl;
}

// ─── Submission cooldown: 1 per day (localStorage so it survives refresh) ───
const SUBMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const SUBMIT_COOLDOWN_KEY = 'last-submit-ts';

function checkSubmitCooldown() {
    const last = parseInt(localStorage.getItem(SUBMIT_COOLDOWN_KEY) || '0', 10);
    const diff = Date.now() - last;
    if (last && diff < SUBMIT_COOLDOWN_MS) {
        const hrs  = Math.floor((SUBMIT_COOLDOWN_MS - diff) / 3600000);
        const mins = Math.ceil(((SUBMIT_COOLDOWN_MS - diff) % 3600000) / 60000);
        const msg  = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} minute${mins !== 1 ? 's' : ''}`;
        showToast(`You already sent something today! Come back in ${msg} ⏳`);
        return false;
    }
    localStorage.setItem(SUBMIT_COOLDOWN_KEY, String(Date.now()));
    return true;
}

// ─── Comment cooldown: 60 seconds (in-memory, resets on refresh) ─────────
let _lastCommentTime = 0;
const COMMENT_COOLDOWN_MS = 60000;
const COMMENT_MAX_CHARS = 300;

function checkCommentCooldown() {
    const now  = Date.now();
    const diff = now - _lastCommentTime;
    if (_lastCommentTime && diff < COMMENT_COOLDOWN_MS) {
        const secs = Math.ceil((COMMENT_COOLDOWN_MS - diff) / 1000);
        showToast(`Please wait ${secs}s before commenting again! ⏳`);
        return false;
    }
    _lastCommentTime = now;
    return true;
}

async function submitDrawing() {
    if (!checkSubmitCooldown()) return;
    const canvas = document.getElementById('draw-canvas');
    if (isCanvasBlank(canvas)) { showToast('Draw something first! 🖌️'); return; }

    const dataUrl = safeCanvasDataUrl(canvas);
    const name = getSenderName('draw');
    const vis  = getVisibility('draw');
    const entry = {
        id: String(Date.now() + Math.floor(Math.random() * 1000)),
        type: 'drawing', data: dataUrl, sender: name,
        timestamp: new Date().toISOString(), requestedVis: vis
    };

    await savePending(entry);
    if (vis === 'public') {
        showToast('Drawing submitted! Waiting for approval 🌐✨');
    } else {
        showToast('Drawing sent privately! 🔒✨ Thank you!');
    }
    clearCanvas();
}

async function submitMessage() {
    if (!checkSubmitCooldown()) return;
    const ta = document.getElementById('message-textarea');
    const text = ta.value.trim();
    if (!text) { showToast('Please write something first! 💬'); return; }

    const name = getSenderName('message');
    const vis  = getVisibility('message');
    const entry = {
        id: String(Date.now() + Math.floor(Math.random() * 1000)),
        type: 'message', data: text, sender: name,
        timestamp: new Date().toISOString(), requestedVis: vis
    };

    await savePending(entry);
    if (vis === 'public') {
        showToast('Message submitted! Waiting for approval 🌐✨');
    } else {
        showToast('Message sent privately! 🔒✨ Thank you!');
    }
    ta.value = '';
}

// ═══════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════
function onLogoClick() {
    logoClickCount++;
    clearTimeout(logoClickTimer);
    if (logoClickCount >= 5) {
        logoClickCount = 0;
        openAdminPrompt();
    } else {
        logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 2000);
    }
}

function openAdminPrompt() {
    const prompt = document.getElementById('admin-password-prompt');
    prompt.classList.remove('hidden');
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-error').textContent = '';
    setTimeout(() => document.getElementById('pw-input').focus(), 50);
}

function closeAdminPrompt() {
    document.getElementById('admin-password-prompt').classList.add('hidden');
}

async function submitPassword() {
    const val = document.getElementById('pw-input').value;
    const errEl = document.getElementById('pw-error');
    errEl.textContent = 'Checking…';
    const { data, error } = await _db.auth.signInWithPassword({
        email: 'depamaylo.angelo360@gmail.com',
        password: val
    });
    if (error || !data.user) {
        errEl.textContent = 'Wrong password!';
        document.getElementById('pw-input').value = '';
        document.getElementById('pw-input').focus();
        return;
    }
    // Reload cache with authenticated session to access admin-only tables
    await dbInit();
    closeAdminPrompt();
    adminLoggedIn = true;
    document.body.classList.add('admin-logged');
    openAdmin();
}

function onPasswordKeydown(e) {
    if (e.key === 'Enter') submitPassword();
}

function openAdmin() {
    showAdminTab('pending');   // open to pending first so they see what needs review
    updatePendingBadge();
    checkStorageUsage();
    const panel = document.getElementById('admin-panel');
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
    gsap.fromTo('.admin-inner',
        { y: 40, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' }
    );
}

function closeAdmin() {
    gsap.to('.admin-inner', {
        y: 20, opacity: 0, scale: 0.97, duration: 0.25, ease: 'power2.in',
        onComplete: () => {
            document.getElementById('admin-panel').classList.remove('open');
            document.body.style.overflow = '';
            gsap.set('.admin-inner', { y: 0, opacity: 1, scale: 1 });
        }
    });
}

function updatePendingBadge() {
    const badge = document.getElementById('pending-badge');
    if (!badge) return;
    const count = getPending().length;
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.admin-tab-btn[data-tab="${tab}"]`);
    if (btn) btn.classList.add('active');
    const content = document.getElementById('admin-tab-' + tab);
    if (content) content.classList.add('active');

    if (tab === 'pending')     renderPending();
    if (tab === 'submissions') renderSubmissions();
    if (tab === 'my-art')      renderAdminArtList();
    updatePendingBadge();
}

// ── My Art tab ────────────────────────────────
// getArtOverrides / getHiddenArtIds are now provided by db.js (synchronous cache reads)

function renderAdminArtList() {
    const list = document.getElementById('admin-art-list');
    const hidden = getHiddenArtIds(); // string array from db.js cache
    const visible = allArtworks.filter(a => !hidden.includes(String(a.id)));

    if (!visible.length) {
        list.innerHTML = '<div class="no-submissions">No artworks yet! Add some above 🎨</div>';
        return;
    }

    list.innerHTML = visible.map(art => {
        const comments  = getComments(art.id);
        const reactions = getReactions(art.id);
        const reactionSummary = Object.entries(reactions)
            .filter(([, c]) => c > 0)
            .map(([e, c]) => `${e}${c}`).join(' ');
        const tags = (art.tags || []).join(', ');
        const isExtra = !artworks.find(a => a.id === art.id); // from data.js?

        return `
        <div class="mai-card" id="manage-${art.id}">
            <!-- ── Header row ── -->
            <div class="mai-header">
                <img class="mai-thumb" src="${escHtml(art.image)}" alt="${escHtml(art.title)}" onerror="this.style.opacity=0.3">
                <div class="mai-info">
                    <div class="mai-title">
                        ${escHtml(art.title)}
                        ${art.nsfw ? '<span class="nsfw-badge">NSFW</span>' : ''}
                        ${isExtra ? '' : '<span class="mai-badge-static" title="Defined in data.js">data.js</span>'}
                    </div>
                    <div class="mai-meta">
                        <span>📅 ${escHtml(art.date)}</span>
                        <span class="mai-comment-count" id="mai-ccount-${art.id}">💬 ${comments.length}</span>
                        ${reactionSummary ? `<span>${reactionSummary}</span>` : ''}
                    </div>
                    ${(art.tags||[]).length ? `<div class="mai-tags">${(art.tags||[]).map(t=>`<span class="art-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
                </div>
                <div class="mai-actions">
                    <button class="mai-btn" onclick="maiToggle(${art.id},'comments')" title="Comments">💬</button>
                    <button class="mai-btn" onclick="maiToggle(${art.id},'edit')" title="Edit">✏️</button>
                    <button class="mai-btn mai-btn-del" onclick="deleteArtwork(${art.id})" title="Delete artwork">🗑</button>
                </div>
            </div>

            <!-- ── Comments panel ── -->
            <div class="mai-panel hidden" id="mai-comments-${art.id}">
                <div class="mai-panel-label">💬 Comments (${comments.length})</div>
                <div class="mai-comments-list" id="mai-clist-${art.id}">
                    ${renderManageComments(art.id)}
                </div>
            </div>

            <!-- ── Edit panel ── -->
            <div class="mai-panel hidden" id="mai-edit-${art.id}">
                <div class="mai-panel-label">✏️ Edit Artwork</div>
                <div class="mai-edit-form">
                    <input  class="manage-input"    id="edit-title-${art.id}" value="${escHtml(art.title)}" placeholder="Title *">
                    <textarea class="manage-textarea" id="edit-desc-${art.id}" placeholder="Description">${escHtml(art.description||'')}</textarea>
                    <input  class="manage-input"    id="edit-image-${art.id}" value="${escHtml(art.image||'')}" placeholder="Image URL">
                    <input  class="manage-input"    id="edit-tags-${art.id}"  value="${escHtml(tags)}"  placeholder="Tags (comma separated)">
                    <label class="form-checkbox-row" style="margin:0.25rem 0">
                        <input type="checkbox" id="edit-nsfw-${art.id}" ${art.nsfw ? 'checked' : ''}> Mark as NSFW
                    </label>
                    <div class="mai-edit-actions">
                        <button class="sub-btn sub-btn-approve" onclick="saveArtEdit(${art.id})">Save ✨</button>
                        <button class="manage-btn-cancel" onclick="maiToggle(${art.id},'edit')">Cancel</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function maiToggle(artId, panel) {
    const panels = ['comments', 'edit'];
    panels.forEach(p => {
        const el = document.getElementById(`mai-${p}-${artId}`);
        if (el) {
            if (p === panel) el.classList.toggle('hidden');
            else el.classList.add('hidden');
        }
    });
}

function renderManageComments(artId) {
    const comments = getComments(artId);
    if (!comments.length) return '<span class="comment-no" style="padding:0.5rem 0;display:block">No comments yet.</span>';
    return comments.map(c => `
        <div class="mai-comment-item">
            <div class="mai-comment-text">${escHtml(c.text)}</div>
            <div class="mai-comment-foot">
                <span class="comment-meta">${escHtml(formatCommentDate(c.date))}</span>
                <button class="sub-btn sub-btn-delete" style="padding:0.2rem 0.6rem;font-size:0.72rem" onclick="deleteManageComment(${JSON.stringify(artId)},'${c.id}')">🗑 Delete</button>
            </div>
        </div>`).join('');
}

async function deleteManageComment(artId, commentId) {
    await dbDeleteComment(commentId);
    // Refresh only the comment list, not the whole panel
    const cl = document.getElementById(`mai-clist-${artId}`);
    if (cl) cl.innerHTML = renderManageComments(artId);
    const cc = document.getElementById(`mai-ccount-${artId}`);
    if (cc) cc.textContent = `💬 ${getComments(artId).length}`;
    // Refresh lightbox comments if open
    if (currentArtwork && String(currentArtwork.id) === String(artId)) renderComments(artId);
}

async function deleteArtwork(artId) {
    if (!confirm('Remove this artwork from the gallery?')) return;
    const isExtra = !artworks.find(a => String(a.id) === String(artId));
    if (isExtra) {
        await dbDeleteExtraArtwork(artId);
    } else {
        await dbHideArt(artId);
    }
    allArtworks = allArtworks.filter(a => String(a.id) !== String(artId));
    renderGallery();
    renderTagChips();
    renderAdminArtList();
    showToast('Artwork removed from gallery.');
}

// toggleManageComments / toggleManageEdit kept as aliases for compatibility
function toggleManageComments(artId) { maiToggle(artId, 'comments'); }
function toggleManageEdit(artId)     { maiToggle(artId, 'edit'); }

async function saveArtEdit(artId) {
    const title   = document.getElementById(`edit-title-${artId}`).value.trim();
    const desc    = document.getElementById(`edit-desc-${artId}`).value.trim();
    const image   = document.getElementById(`edit-image-${artId}`)?.value.trim();
    const tagsRaw = document.getElementById(`edit-tags-${artId}`)?.value.trim();
    const nsfw    = document.getElementById(`edit-nsfw-${artId}`)?.checked;

    if (!title) { showToast('Title cannot be empty!'); return; }
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const changes = { title, description: desc, image: image || '', tags, nsfw };

    // Save override for data.js artworks (or extra artworks) — covers title/desc/image/tags/nsfw
    await dbSaveArtOverride(artId, changes);

    // Apply to live array immediately
    const art = allArtworks.find(a => String(a.id) === String(artId));
    if (art) {
        art.title = title; art.description = desc;
        if (image) art.image = image;
        art.tags = tags; art.nsfw = nsfw;
    }

    // Also update the extra_artworks table if it's a custom (non-data.js) artwork
    const isExtra = !artworks.find(a => String(a.id) === String(artId));
    if (isExtra) {
        await dbUpdateExtraArtwork(artId, changes);
    }

    renderGallery();
    renderTagChips();
    renderAdminArtList();
    showToast('Artwork updated! ✨');
}

// ── Add Art ────────────────────────────────────
async function submitNewArt() {
    const title   = document.getElementById('new-title').value.trim();
    const desc    = document.getElementById('new-desc').value.trim();
    const image   = document.getElementById('new-image').value.trim();
    const tagsRaw = document.getElementById('new-tags').value.trim();
    const nsfw    = document.getElementById('new-nsfw').checked;

    if (!title || !image) {
        showToast('Title and Image URL are required!');
        return;
    }

    const tags  = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const newId = String(Date.now() + Math.floor(Math.random() * 1000));
    const newArt = { id: newId, title, description: desc, image, tags, nsfw, date: new Date().toISOString().split('T')[0] };

    // Save to Supabase and add to live cache
    await dbAddExtraArtwork(newArt);
    allArtworks.unshift(newArt);
    renderTagChips();
    renderGallery();

    // Clear form
    document.getElementById('new-title').value  = '';
    document.getElementById('new-desc').value   = '';
    document.getElementById('new-image').value  = '';
    document.getElementById('new-tags').value   = '';
    document.getElementById('new-nsfw').checked = false;

    showToast('Artwork added! 🎨');
}

// ── Submissions view ───────────────────────────
// shared helpers for submission rendering
function _subTypeBadge(s) {
    return s.type === 'drawing' ? '🎨 Drawing' : '💬 Message';
}
function _subSender(s) {
    return s.sender
        ? `<span class="submission-sender">✏️ ${escHtml(s.sender)}</span>`
        : `<span class="submission-sender anon">🙈 Anonymous</span>`;
}
function _subContent(s) {
    return s.type === 'drawing'
        ? `<img src="${s.data}" class="sub-img" alt="drawing">`
        : `<p class="sub-text">${escHtml(s.data)}</p>`;
}

function renderPending() {
    const list = document.getElementById('pending-list');
    if (!list) return;
    const pending = getPending().slice().reverse();
    updatePendingBadge();

    if (!pending.length) {
        list.innerHTML = '<div class="no-submissions">✅ Nothing pending, you\'re all caught up!</div>';
        return;
    }

    list.innerHTML = pending.map(s => {
        const reqBadge = s.requestedVis === 'public'
            ? `<span class="sub-vis-badge pub">🌐 Wants Public</span>`
            : `<span class="sub-vis-badge priv">🔒 Private</span>`;
        return `<div class="submission-item submission-pending">
            <div class="submission-meta">
                ${reqBadge}
                <span class="submission-type-badge">${_subTypeBadge(s)}</span>
                ${_subSender(s)}
                <span>${escHtml(formatCommentDate(s.timestamp))}</span>
            </div>
            ${_subContent(s)}
            <div class="sub-actions">
                <button class="sub-btn sub-btn-approve" onclick="approveToWall('${s.id}')">✅ Approve → Wall</button>
                <button class="sub-btn sub-btn-private" onclick="approvePrivate('${s.id}')">🔒 Keep Private</button>
                <button class="sub-btn sub-btn-delete" onclick="deletePending('${s.id}')">🗑 Delete</button>
            </div>
        </div>`;
    }).join('');
}

function renderSubmissions() {
    const list = document.getElementById('submissions-list');
    if (!list) return;
    const publicPosts = getPublicPosts().slice().reverse();
    const privateSubs = getSubmissions().slice().reverse();

    if (!publicPosts.length && !privateSubs.length) {
        list.innerHTML = '<div class="no-submissions">No approved submissions yet! 🌸</div>';
        return;
    }

    let html = '';

    if (publicPosts.length) {
        html += `<div class="submissions-section-label">🌐 Public Wall (${publicPosts.length})</div>`;
        html += publicPosts.map(s => `
            <div class="submission-item">
                <div class="submission-meta">
                    <span class="sub-vis-badge pub">🌐 Public</span>
                    <span class="submission-type-badge">${_subTypeBadge(s)}</span>
                    ${_subSender(s)}
                    <span>${escHtml(formatCommentDate(s.timestamp))}</span>
                </div>
                ${_subContent(s)}
                <div class="sub-actions">
                    <button class="sub-btn sub-btn-delete" onclick="deletePublicPost('${s.id}');renderSubmissions()">🗑 Delete from Wall</button>
                </div>
            </div>`).join('');
    }

    if (privateSubs.length) {
        html += `<div class="submissions-section-label">🔒 Private Inbox (${privateSubs.length})</div>`;
        html += privateSubs.map(s => `
            <div class="submission-item">
                <div class="submission-meta">
                    <span class="sub-vis-badge priv">🔒 Private</span>
                    <span class="submission-type-badge">${_subTypeBadge(s)}</span>
                    ${_subSender(s)}
                    <span>${escHtml(formatCommentDate(s.timestamp))}</span>
                </div>
                ${_subContent(s)}
                <div class="sub-actions">
                    <button class="sub-btn sub-btn-approve" onclick="approvePrivateToWall('${s.id}')">✅ Move → Wall</button>
                    <button class="sub-btn sub-btn-delete" onclick="deletePrivateSub('${s.id}')">🗑 Delete</button>
                </div>
            </div>`).join('');
    }

    list.innerHTML = html;
}

// ═══════════════════════════════════════════════
// MOBILE DRAW PANEL
// ═══════════════════════════════════════════════
let mobileErasing = false;
let mobilePainting = false;
let mobileLastX = 0;
let mobileLastY = 0;

let _drawMode = 'simple';

function setDrawMode(mode) {
    _drawMode = mode;
    document.getElementById('draw-mode-simple').classList.toggle('hidden', mode !== 'simple');
    document.getElementById('draw-mode-wiggly').classList.toggle('hidden', mode !== 'wiggly');
    document.getElementById('dmt-simple').classList.toggle('active', mode === 'simple');
    document.getElementById('dmt-wiggly').classList.toggle('active', mode === 'wiggly');
}

function sendCurrentDrawing() {
    if (_drawMode === 'wiggly') {
        const iframe = document.getElementById('wiggly-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'trigger-submit' }, '*');
        }
    } else {
        submitDrawing();
    }
}

window.addEventListener('message', async e => {
    if (!e.data || e.data.type !== 'wiggly-submit') return;
    const dataUrl = e.data.dataUrl;
    if (!dataUrl) return;
    if (!checkSubmitCooldown()) return;
    const name = getSenderName('draw');
    const vis  = getVisibility('draw');
    const entry = {
        id: String(Date.now() + Math.floor(Math.random() * 1000)),
        type: 'drawing',
        data: dataUrl,
        sender: name,
        timestamp: new Date().toISOString(),
        requestedVis: vis
    };
    await savePending(entry);
    if (vis === 'public') {
        showToast('WigglyPaint submitted! Waiting for approval 🌐✨');
    } else {
        showToast('WigglyPaint sent privately! 🔒✨ Thank you!');
    }
});

function openMobileDrawPanel() {
    const panel = document.getElementById('mobile-draw-panel');
    panel.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setupMobileCanvas();
}

function closeMobileDrawPanel() {
    const panel = document.getElementById('mobile-draw-panel');
    panel.classList.add('hidden');
    document.body.style.overflow = '';
}

function setupMobileCanvas() {
    const canvas = document.getElementById('mobile-draw-canvas');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    updateMobileSizeDot();

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
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
        const ctx = canvas.getContext('2d');
        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(mobileLastX, mobileLastY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = mobileErasing ? '#fff' : getMobileColor();
        ctx.lineWidth = getMobileBrushSize();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        mobileLastX = x; mobileLastY = y;
    }

    function stopDraw(e) { mobilePainting = false; }

    canvas.onmousedown = startDraw;
    canvas.onmousemove = draw;
    canvas.onmouseup = stopDraw;
    canvas.onmouseleave = stopDraw;
    canvas.ontouchstart = startDraw;
    canvas.ontouchmove = draw;
    canvas.ontouchend = stopDraw;

    document.getElementById('mdb-size').addEventListener('input', updateMobileSizeDot);
}

function getMobileColor() {
    return document.getElementById('mdb-color').value;
}

function getMobileBrushSize() {
    return parseInt(document.getElementById('mdb-size').value, 10);
}

function updateMobileSizeDot() {
    const size = getMobileBrushSize();
    const dot = document.getElementById('mdb-size-dot');
    const px = Math.max(4, Math.min(size, 32));
    dot.style.width = px + 'px';
    dot.style.height = px + 'px';
}

function toggleMobileEraser(btn) {
    mobileErasing = !mobileErasing;
    btn.classList.toggle('active', mobileErasing);
}

function clearMobileCanvas() {
    const canvas = document.getElementById('mobile-draw-canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    mobileErasing = false;
    const eraserBtn = document.getElementById('mdb-eraser-btn');
    if (eraserBtn) eraserBtn.classList.remove('active');
}

async function submitMobileDrawing() {
    const canvas = document.getElementById('mobile-draw-canvas');
    if (isCanvasBlank(canvas)) { showToast('Draw something first! 🖌️'); return; }
    if (!checkSubmitCooldown()) return;
    const dataUrl = safeCanvasDataUrl(canvas);
    const nameEl = document.getElementById('sender-name');
    const name = nameEl ? nameEl.value.trim() : '';
    const submission = {
        id: String(Date.now() + Math.floor(Math.random() * 1000)),
        type: 'drawing',
        data: dataUrl,
        sender: name || null,
        requestedVis: 'private',
        timestamp: new Date().toISOString()
    };
    await savePending(submission);
    clearMobileCanvas();
    closeMobileDrawPanel();
    showToast('Drawing sent! Waiting for review ✨');
}

// ═══════════════════════════════════════════════
// OVERLAY CLICK TO CLOSE
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Lightbox overlay close
    document.getElementById('lightbox').addEventListener('click', function(e) {
        if (e.target === this) closeLightbox();
    });

    // Admin panel overlay close
    document.getElementById('admin-panel').addEventListener('click', function(e) {
        if (e.target === this) closeAdmin();
    });

    // Escape key — close only the topmost open overlay
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!document.getElementById('admin-password-prompt').classList.contains('hidden')) {
            closeAdminPrompt();
        } else if (document.getElementById('admin-panel').classList.contains('open')) {
            closeAdmin();
        } else if (document.getElementById('lightbox').classList.contains('open')) {
            closeLightbox();
        }
    });
});

// ═══════════════════════════════════════════════
// GALLERY SORT
// ═══════════════════════════════════════════════
let currentSort = 'newest';
function setSortOrder(val) { currentSort = val; renderGallery(); }

// ═══════════════════════════════════════════════
// BACK TO TOP
// ═══════════════════════════════════════════════
(function() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
})();

// ═══════════════════════════════════════════════
// LIGHTBOX: KEYBOARD + SWIPE
// ═══════════════════════════════════════════════
(function() {
    let tx = 0;
    document.addEventListener('keydown', e => {
        const lb = document.getElementById('lightbox');
        if (!lb || !lb.classList.contains('open')) return;
        if (e.key === 'ArrowRight') navigateLightbox(1);
        if (e.key === 'ArrowLeft')  navigateLightbox(-1);
    });
    document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', e => {
        const lb = document.getElementById('lightbox');
        if (!lb || !lb.classList.contains('open')) return;
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 50) navigateLightbox(dx < 0 ? 1 : -1);
    }, { passive: true });
})();

function navigateLightbox(dir) {
    if (!currentArtwork) return;
    const visible = getFilteredArtworks();
    const idx = visible.findIndex(a => a.id === currentArtwork.id);
    if (idx === -1) return;
    const next = visible[idx + dir];
    if (next) openLightbox(next.id);
}

// ═══════════════════════════════════════════════
// ADMIN: EXPORT BACKUP
// ═══════════════════════════════════════════════
function exportData() {
    // Build per-art comment and reaction maps from in-memory cache
    const commentMap = {};
    for (const [k, v] of Object.entries(_comments)) {
        if (v.length) commentMap['comments-' + k] = v;
    }
    const reactionMap = {};
    for (const [k, v] of Object.entries(_reactions)) {
        if (Object.keys(v).length) reactionMap['reactions-' + k] = v;
    }
    const wallRxnMap = {};
    for (const [k, v] of Object.entries(_wallRxns)) {
        if (Object.keys(v).length) wallRxnMap['wall-reactions-' + k] = v;
    }

    const backup = {
        exportedAt: new Date().toISOString(),
        data: {
            'public-posts':           _publicPosts,
            'pending-submissions':    _pending,
            'anonymous-submissions':  _inbox,
            'extra-artworks':         _extraArts,
            'art-overrides':          _overrides,
            'hidden-art-ids':         _hiddenIds,
            ...commentMap,
            ...reactionMap,
            ...wallRxnMap,
        }
    };

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    a.download = `bubbles-gallery-backup-${Date.now()}.json`;
    a.click();
    showToast('Backup downloaded! 💾');
}

// ═══════════════════════════════════════════════
// ADMIN: STORAGE WARNING (Supabase — no local limit)
// ═══════════════════════════════════════════════
function checkStorageUsage() {
    const existing = document.querySelector('.storage-warning');
    if (existing) existing.remove();
    // Data is now stored in Supabase — no localStorage size limit to worry about.
}

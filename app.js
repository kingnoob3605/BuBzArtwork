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
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h}:${String(m).padStart(2,'0')}`;
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
function init() {
    document.title = SITE_CONFIG.title;
    document.getElementById('logo-text').textContent = SITE_CONFIG.logoText;
    const aboutTextEl = document.getElementById('about-text');
    if (aboutTextEl) aboutTextEl.textContent = SITE_CONFIG.aboutText;

    // Merge extra artworks from localStorage (dedup by id, prepend)
    const extra = JSON.parse(localStorage.getItem('extra-artworks') || '[]');
    const baseIds = new Set(artworks.map(a => a.id));
    const dedupedExtra = extra.filter(a => !baseIds.has(a.id));
    allArtworks = [...dedupedExtra, ...artworks];

    // Apply saved title/description overrides
    const overrides = getArtOverrides();
    allArtworks.forEach(art => {
        if (overrides[art.id]) {
            if (overrides[art.id].title)       art.title       = overrides[art.id].title;
            if (overrides[art.id].description) art.description = overrides[art.id].description;
        }
    });

    // Age gate — check expiry (30 days) and session flag
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
    return allArtworks.filter(art => {
        const passFilter =
            currentFilter === 'all' ||
            (currentFilter === 'sfw'  && !art.nsfw) ||
            (currentFilter === 'nsfw' &&  art.nsfw);
        const passTag = !activeTag || (art.tags && art.tags.includes(activeTag));
        return passFilter && passTag;
    });
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

function getReactions(artId) {
    return JSON.parse(localStorage.getItem('reactions-' + artId) || '{}');
}

function saveReactions(artId, data) {
    localStorage.setItem('reactions-' + artId, JSON.stringify(data));
}

function addReaction(artId, emoji) {
    const data = getReactions(artId);
    data[emoji] = (data[emoji] || 0) + 1;
    saveReactions(artId, data);
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
    return REACTION_EMOJIS
        .filter(e => data[e] > 0)
        .map(e => `<span class="card-reaction">${e} <span class="reaction-count">${data[e]}</span></span>`)
        .join('');
}

function renderReactions(artId) {
    const container = document.getElementById('lb-reactions');
    if (!container) return;
    const data = getReactions(artId);
    container.innerHTML = REACTION_EMOJIS.map(e => {
        const count = data[e] || 0;
        return `<button class="reaction-btn ${count > 0 ? 'has-count' : ''}" onclick="addReaction(${artId}, '${e}')" title="React with ${e}">
            ${e}<span class="reaction-count">${count > 0 ? count : ''}</span>
        </button>`;
    }).join('');
}

// ═══════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════
function getComments(artId) {
    return JSON.parse(localStorage.getItem('comments-' + artId) || '[]');
}

function saveComments(artId, comments) {
    localStorage.setItem('comments-' + artId, JSON.stringify(comments));
}

function renderComments(artId) {
    const list = document.getElementById('comments-list');
    const comments = getComments(artId);
    if (comments.length === 0) {
        list.innerHTML = '<span class="comment-no">No comments yet — be the first! ✨</span>';
        return;
    }
    list.innerHTML = comments.map((c, i) => `
        <div class="comment-item">
            <div class="comment-top">
                <div class="comment-meta">${escHtml(formatCommentDate(c.date))}</div>
                ${adminLoggedIn ? `<button class="comment-delete" onclick="deleteComment(${artId}, ${i})" title="Delete comment">🗑</button>` : ''}
            </div>
            <div>${escHtml(c.text)}</div>
        </div>
    `).join('');
    list.scrollTop = list.scrollHeight;
}

function deleteComment(artId, index) {
    if (!confirm('Delete this comment?')) return;
    const comments = getComments(artId);
    comments.splice(index, 1);
    saveComments(artId, comments);
    renderComments(artId);
}

function isBanned(text) {
    const lower = text.toLowerCase();
    return BANNED_WORDS.some(w => {
        const escaped = w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`).test(lower);
    });
}

function showCommentWarning(msg) {
    const el = document.getElementById('comment-warning');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 3500);
}

function postComment() {
    if (!currentArtwork) return;
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text) return;

    if (isBanned(text)) {
        showCommentWarning('⚠️ Your comment was flagged and could not be posted.');
        input.value = '';
        return;
    }

    const comments = getComments(currentArtwork.id);
    comments.push({ text, date: new Date().toISOString() });
    saveComments(currentArtwork.id, comments);
    input.value = '';
    renderComments(currentArtwork.id);
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

function getPublicPosts() {
    return JSON.parse(localStorage.getItem('public-posts') || '[]');
}
function savePublicPosts(posts) {
    localStorage.setItem('public-posts', JSON.stringify(posts));
}

function setWallFilter(filter, el) {
    wallFilter = filter;
    document.querySelectorAll('.wall-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    renderWall();
}

function renderWall() {
    const grid = document.getElementById('wall-grid');
    if (!grid) return;
    let posts = getPublicPosts().slice().reverse();
    if (wallFilter !== 'all') posts = posts.filter(p => p.type === wallFilter);

    if (posts.length === 0) {
        grid.innerHTML = '<div class="wall-empty"><span>🌸</span><p>No public posts yet — be the first to share something! ✨</p></div>';
        return;
    }

    grid.innerHTML = posts.map(post => {
        const sender = post.sender
            ? `<span class="wall-sender">✏️ ${escHtml(post.sender)}</span>`
            : `<span class="wall-sender anon">🙈 Anonymous</span>`;
        const date = formatCommentDate(post.timestamp);
        const deleteBtn = adminLoggedIn
            ? `<button class="comment-delete" onclick="deletePublicPost('${post.id}')" title="Delete">🗑</button>`
            : '';

        if (post.type === 'drawing') {
            return `<div class="wall-card">
                <div class="wall-card-img"><img src="${post.data}" alt="Drawing" loading="lazy"></div>
                <div class="wall-card-footer">
                    <span class="wall-type-badge">🎨 Drawing</span>
                    ${sender}
                    <span class="wall-date">${escHtml(date)}</span>
                    ${deleteBtn}
                </div>
            </div>`;
        } else {
            return `<div class="wall-card">
                <div class="wall-card-text">${escHtml(post.data)}</div>
                <div class="wall-card-footer">
                    <span class="wall-type-badge">💬 Message</span>
                    ${sender}
                    <span class="wall-date">${escHtml(date)}</span>
                    ${deleteBtn}
                </div>
            </div>`;
        }
    }).join('');
}

function deletePublicPost(id) {
    if (!confirm('Delete this public post?')) return;
    const posts = getPublicPosts().filter(p => p.id !== id);
    savePublicPosts(posts);
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
function getSubmissions() {
    return JSON.parse(localStorage.getItem('anonymous-submissions') || '[]');
}

function saveSubmission(submission) {
    const subs = getSubmissions();
    subs.push(submission);
    localStorage.setItem('anonymous-submissions', JSON.stringify(subs));
}

function submitDrawing() {
    const canvas = document.getElementById('draw-canvas');
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const isBlank = pixels.every((v, i) => (i % 4 === 3) ? v === 255 : v === 255);
    if (isBlank) { showToast('Draw something first! 🖌️'); return; }

    const dataUrl = canvas.toDataURL('image/png');
    const name = getSenderName('draw');
    const vis  = getVisibility('draw');
    const entry = { type: 'drawing', data: dataUrl, sender: name, timestamp: new Date().toISOString() };

    if (vis === 'public') {
        const posts = getPublicPosts();
        posts.push({ ...entry, id: String(Date.now() + Math.floor(Math.random() * 1000)) });
        savePublicPosts(posts);
        showToast('Drawing posted on the Wall! 🌐✨');
    } else {
        saveSubmission(entry);
        showToast('Drawing sent privately! 🔒✨ Thank you!');
    }
    clearCanvas();
}

function submitMessage() {
    const ta = document.getElementById('message-textarea');
    const text = ta.value.trim();
    if (!text) { showToast('Please write something first! 💬'); return; }

    if (isBanned(text)) {
        showCommentWarning('⚠️ Your message was flagged and could not be posted.');
        return;
    }

    const name = getSenderName('message');
    const vis  = getVisibility('message');
    const entry = { type: 'message', data: text, sender: name, timestamp: new Date().toISOString() };

    if (vis === 'public') {
        const posts = getPublicPosts();
        posts.push({ ...entry, id: String(Date.now() + Math.floor(Math.random() * 1000)) });
        savePublicPosts(posts);
        showToast('Message posted on the Wall! 🌐✨');
    } else {
        saveSubmission(entry);
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

function submitPassword() {
    const val = document.getElementById('pw-input').value;
    if (val === SITE_CONFIG.adminPassword) {
        closeAdminPrompt();
        adminLoggedIn = true;
        openAdmin();
    } else {
        document.getElementById('pw-error').textContent = 'Wrong password!';
        document.getElementById('pw-input').value = '';
        document.getElementById('pw-input').focus();
    }
}

function onPasswordKeydown(e) {
    if (e.key === 'Enter') submitPassword();
}

function openAdmin() {
    showAdminTab('add-art');
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

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.admin-tab-btn[data-tab="${tab}"]`);
    if (btn) btn.classList.add('active');
    const content = document.getElementById('admin-tab-' + tab);
    if (content) content.classList.add('active');

    if (tab === 'submissions') renderSubmissions();
    if (tab === 'my-art') renderAdminArtList();
}

// ── My Art tab ────────────────────────────────
function renderAdminArtList() {
    const list = document.getElementById('admin-art-list');
    if (!allArtworks.length) {
        list.innerHTML = '<div class="no-submissions">No artworks yet! 🌸</div>';
        return;
    }

    list.innerHTML = allArtworks.map(art => {
        const overrides = getArtOverrides();
        const o = overrides[art.id] || {};
        const title = o.title || art.title;
        const desc  = o.description || art.description;
        const comments = getComments(art.id);
        const reactions = getReactions(art.id);
        const reactionSummary = REACTION_EMOJIS
            .filter(e => reactions[e] > 0)
            .map(e => `${e}${reactions[e]}`).join(' ');

        return `
        <div class="manage-art-item" id="manage-${art.id}">
            <div class="manage-art-row">
                <img class="manage-art-thumb" src="${escHtml(art.image)}" alt="${escHtml(title)}">
                <div class="manage-art-info">
                    <div class="manage-art-title">
                        ${escHtml(title)}
                        ${art.nsfw ? '<span class="nsfw-badge">NSFW</span>' : ''}
                    </div>
                    <div class="manage-art-meta">
                        <span>📅 ${escHtml(art.date)}</span>
                        <span>💬 ${comments.length} comment${comments.length !== 1 ? 's' : ''}</span>
                        ${reactionSummary ? `<span>${reactionSummary}</span>` : ''}
                    </div>
                </div>
                <div class="manage-art-btns">
                    <button class="manage-btn" onclick="toggleManageComments(${art.id})">💬</button>
                    <button class="manage-btn" onclick="toggleManageEdit(${art.id})">✏️</button>
                </div>
            </div>

            <!-- Inline comments -->
            <div class="manage-comments hidden" id="manage-comments-${art.id}">
                <div class="manage-section-label">Comments</div>
                <div class="manage-comments-list" id="manage-comments-list-${art.id}">
                    ${renderManageComments(art.id)}
                </div>
            </div>

            <!-- Inline edit form -->
            <div class="manage-edit hidden" id="manage-edit-${art.id}">
                <div class="manage-section-label">Edit</div>
                <div class="manage-edit-form">
                    <input type="text" class="manage-input" id="edit-title-${art.id}"
                        value="${escHtml(title)}" placeholder="Title">
                    <textarea class="manage-textarea" id="edit-desc-${art.id}"
                        placeholder="Description">${escHtml(desc)}</textarea>
                    <div class="manage-edit-actions">
                        <button class="btn-submit" onclick="saveArtEdit(${art.id})">Save ✨</button>
                        <button class="manage-btn-cancel" onclick="toggleManageEdit(${art.id})">Cancel</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderManageComments(artId) {
    const comments = getComments(artId);
    if (!comments.length) return '<span class="comment-no">No comments yet.</span>';
    return comments.map((c, i) => `
        <div class="manage-comment-item">
            <div class="manage-comment-text">${escHtml(c.text)}</div>
            <div class="manage-comment-foot">
                <span class="comment-meta">${escHtml(formatCommentDate(c.date))}</span>
                <button class="comment-delete" onclick="deleteManageComment(${artId}, ${i})" title="Delete">🗑</button>
            </div>
        </div>`).join('');
}

function deleteManageComment(artId, index) {
    if (!confirm('Delete this comment?')) return;
    const comments = getComments(artId);
    comments.splice(index, 1);
    saveComments(artId, comments);
    document.getElementById(`manage-comments-list-${artId}`).innerHTML = renderManageComments(artId);
    // Update meta count
    renderAdminArtList();
}

function toggleManageComments(artId) {
    const el = document.getElementById(`manage-comments-${artId}`);
    const editEl = document.getElementById(`manage-edit-${artId}`);
    editEl.classList.add('hidden');
    el.classList.toggle('hidden');
}

function toggleManageEdit(artId) {
    const el = document.getElementById(`manage-edit-${artId}`);
    const commentsEl = document.getElementById(`manage-comments-${artId}`);
    commentsEl.classList.add('hidden');
    el.classList.toggle('hidden');
}

function getArtOverrides() {
    return JSON.parse(localStorage.getItem('art-overrides') || '{}');
}

function saveArtEdit(artId) {
    const title = document.getElementById(`edit-title-${artId}`).value.trim();
    const desc  = document.getElementById(`edit-desc-${artId}`).value.trim();
    if (!title) { showToast('Title cannot be empty!'); return; }

    const overrides = getArtOverrides();
    overrides[artId] = { title, description: desc };
    localStorage.setItem('art-overrides', JSON.stringify(overrides));

    // Apply to live allArtworks array
    const art = allArtworks.find(a => a.id === artId);
    if (art) { art.title = title; art.description = desc; }

    renderGallery();
    renderAdminArtList();
    showToast('Artwork updated! ✨');
}

// ── Add Art ────────────────────────────────────
function submitNewArt() {
    const title   = document.getElementById('new-title').value.trim();
    const desc    = document.getElementById('new-desc').value.trim();
    const image   = document.getElementById('new-image').value.trim();
    const tagsRaw = document.getElementById('new-tags').value.trim();
    const nsfw    = document.getElementById('new-nsfw').checked;

    if (!title || !image) {
        showToast('Title and Image URL are required!');
        return;
    }

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const newArt = { id: newId, title, description: desc, image, tags, nsfw, date: new Date().toISOString().split('T')[0] };

    // Save to localStorage
    const extra = JSON.parse(localStorage.getItem('extra-artworks') || '[]');
    extra.push(newArt);
    localStorage.setItem('extra-artworks', JSON.stringify(extra));

    // Add to live array & re-render
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
function renderSubmissions() {
    const list = document.getElementById('submissions-list');

    const privateSubs = getSubmissions().slice().reverse();
    const publicPosts  = getPublicPosts().slice().reverse();

    if (privateSubs.length === 0 && publicPosts.length === 0) {
        list.innerHTML = '<div class="no-submissions">No submissions yet! 🌸</div>';
        return;
    }

    function renderItem(s, isPublic) {
        const date = formatCommentDate(s.timestamp);
        const senderLabel = s.sender
            ? `<span class="submission-sender">✏️ ${escHtml(s.sender)}</span>`
            : `<span class="submission-sender anon">🙈 Anonymous</span>`;
        const visiBadge = isPublic
            ? `<span class="submission-type-badge" style="background:rgba(60,200,100,0.18);color:#80ffaa;border-color:rgba(60,200,100,0.3)">🌐 Public</span>`
            : `<span class="submission-type-badge" style="background:rgba(239,116,92,0.15);color:var(--accent)">🔒 Private</span>`;
        const deleteBtn = isPublic
            ? `<button class="comment-delete" style="opacity:0.6" onclick="deletePublicPost('${s.id}');renderSubmissions();" title="Delete">🗑</button>`
            : '';
        const typeBadge = `<span class="submission-type-badge">${s.type === 'drawing' ? '🎨 Drawing' : '💬 Message'}</span>`;
        const content = s.type === 'drawing'
            ? `<img src="${s.data}" alt="Drawing submission">`
            : `<p>${escHtml(s.data)}</p>`;
        return `<div class="submission-item">
            <div class="submission-meta">
                ${visiBadge} ${typeBadge} ${senderLabel}
                <span>${escHtml(date)}</span>
                ${deleteBtn}
            </div>
            ${content}
        </div>`;
    }

    let html = '';
    if (publicPosts.length > 0) {
        html += `<div class="submissions-section-label">🌐 Public Wall Posts (${publicPosts.length})</div>`;
        html += publicPosts.map(s => renderItem(s, true)).join('');
    }
    if (privateSubs.length > 0) {
        html += `<div class="submissions-section-label">🔒 Private Submissions (${privateSubs.length})</div>`;
        html += privateSubs.map(s => renderItem(s, false)).join('');
    }
    list.innerHTML = html;
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

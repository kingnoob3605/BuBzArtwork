/* =============================================
   ADMIN.JS — Admin panel, art management, submissions, auto-suggest
   ============================================= */

// ═══════════════════════════════════════════════
// ADMIN AUTH
// ═══════════════════════════════════════════════
function onLogoClick() {
  logoClickCount++;
  clearTimeout(logoClickTimer);
  if (logoClickCount >= 5) {
    logoClickCount = 0;
    if (adminLoggedIn) openAdmin();
    else openAdminPrompt();
  } else {
    logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 2000);
  }
}

function openAdminPrompt() {
  const prompt = document.getElementById("admin-password-prompt");
  prompt.classList.remove("hidden");
  document.getElementById("pw-input").value = "";
  document.getElementById("pw-error").textContent = "";
  setTimeout(() => document.getElementById("pw-input").focus(), 50);
}

function closeAdminPrompt() {
  document.getElementById("admin-password-prompt").classList.add("hidden");
}

async function submitPassword() {
  const val   = document.getElementById("pw-input").value;
  const errEl = document.getElementById("pw-error");
  errEl.textContent = "Checking…";
  const { data, error } = await _db.auth.signInWithPassword({ email: ADMIN_EMAIL, password: val });
  if (error || !data.user) {
    errEl.textContent = "Wrong email or password!";
    document.getElementById("pw-input").value = "";
    document.getElementById("pw-input").focus();
    return;
  }
  await dbInit();
  closeAdminPrompt();
  adminLoggedIn = true;
  document.body.classList.add("admin-logged");
  openAdmin();
}

function onPasswordKeydown(e) {
  if (e.key === "Enter") submitPassword();
}

// ═══════════════════════════════════════════════
// ADMIN PANEL OPEN/CLOSE
// ═══════════════════════════════════════════════
function openAdmin() {
  showAdminTab("pending");
  updatePendingBadge();
  checkStorageUsage();
  const panel = document.getElementById("admin-panel");
  panel.classList.add("open");
  document.body.style.overflow = "hidden";
  gsap.fromTo(".admin-inner",
    { y: 40, opacity: 0, scale: 0.97 },
    { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }
  );
}

function closeAdmin() {
  gsap.to(".admin-inner", {
    y: 20, opacity: 0, scale: 0.97, duration: 0.25, ease: "power2.in",
    onComplete: () => {
      document.getElementById("admin-panel").classList.remove("open");
      document.body.style.overflow = "";
      gsap.set(".admin-inner", { y: 0, opacity: 1, scale: 1 });
    },
  });
}

function updatePendingBadge() {
  const badge = document.getElementById("pending-badge");
  if (!badge) return;
  const count = getPending().length;
  badge.textContent = count > 0 ? count : "";
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

function showAdminTab(tab) {
  document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".admin-tab-content").forEach((c) => c.classList.remove("active"));
  const btn = document.querySelector(`.admin-tab-btn[data-tab="${tab}"]`);
  if (btn) btn.classList.add("active");
  const content = document.getElementById("admin-tab-" + tab);
  if (content) content.classList.add("active");

  if (tab === "pending")     renderPending();
  if (tab === "submissions") renderSubmissions();
  if (tab === "my-art")      renderAdminArtList();
  if (tab === "wall")        renderAdminWall();
  updatePendingBadge();
}

// ═══════════════════════════════════════════════
// MY ART TAB
// ═══════════════════════════════════════════════
function renderAdminArtList() {
  const list   = document.getElementById("admin-art-list");
  const hidden = getHiddenArtIds();
  const visible = allArtworks.filter((a) => !hidden.includes(String(a.id)));

  if (!visible.length) {
    list.innerHTML = '<div class="no-submissions">No artworks yet! Add some above 🎨</div>';
    return;
  }

  list.innerHTML = visible.map((art) => {
    const comments      = getComments(art.id);
    const reactions     = getReactions(art.id);
    const reactionSummary = Object.entries(reactions).filter(([, c]) => c > 0).map(([e, c]) => `${e}${c}`).join(" ");
    const tags    = (art.tags || []).join(", ");
    const isExtra = !artworks.find((a) => a.id === art.id);

    return `
      <div class="mai-card" id="manage-${art.id}">
          <div class="mai-header">
              <img class="mai-thumb" src="${escHtml(cloudinarySized(art.image, 300))}" alt="${escHtml(art.title)}" onerror="this.style.opacity=0.3">
              <div class="mai-info">
                  <div class="mai-title">
                      ${escHtml(art.title)}
                      ${art.nsfw ? '<span class="nsfw-badge">NSFW</span>' : ""}
                      ${isExtra ? "" : '<span class="mai-badge-static" title="Defined in data.js">data.js</span>'}
                  </div>
                  <div class="mai-meta">
                      <span>📅 ${escHtml(art.date)}</span>
                      <span class="mai-comment-count" id="mai-ccount-${art.id}">💬 ${comments.length}</span>
                      ${reactionSummary ? `<span>${reactionSummary}</span>` : ""}
                  </div>
                  ${(art.tags || []).length ? `<div class="mai-tags">${(art.tags || []).map((t) => `<span class="art-tag">${escHtml(t)}</span>`).join("")}</div>` : ""}
              </div>
              <div class="mai-actions">
                  <button class="mai-btn" onclick="maiToggle(${art.id},'comments')" title="Comments">💬</button>
                  <button class="mai-btn" onclick="maiToggle(${art.id},'edit')" title="Edit">✏️</button>
                  <button class="mai-btn mai-btn-del" onclick="deleteArtwork(${art.id})" title="Delete artwork">🗑</button>
              </div>
          </div>
          <div class="mai-panel hidden" id="mai-comments-${art.id}">
              <div class="mai-panel-label">💬 Comments (${comments.length})</div>
              <div class="mai-comments-list" id="mai-clist-${art.id}">${renderManageComments(art.id)}</div>
          </div>
          <div class="mai-panel hidden" id="mai-edit-${art.id}">
              <div class="mai-panel-label">✏️ Edit Artwork</div>
              <div class="mai-edit-form">
                  <input  class="manage-input"    id="edit-title-${art.id}" value="${escHtml(art.title)}" placeholder="Title *">
                  <textarea class="manage-textarea" id="edit-desc-${art.id}" placeholder="Description">${escHtml(art.description || "")}</textarea>
                  <input  class="manage-input"    id="edit-image-${art.id}" value="${escHtml(art.image || "")}" placeholder="Image URL">
                  <input  class="manage-input"    id="edit-tags-${art.id}"  value="${escHtml(tags)}"  placeholder="Tags (comma separated)">
                  <label class="form-checkbox-row" style="margin:0.25rem 0">
                      <input type="checkbox" id="edit-nsfw-${art.id}" ${art.nsfw ? "checked" : ""}> Mark as NSFW
                  </label>
                  <div class="mai-edit-actions">
                      <button class="sub-btn sub-btn-approve" onclick="saveArtEdit(${art.id})">Save ✨</button>
                      <button class="manage-btn-cancel" onclick="maiToggle(${art.id},'edit')">Cancel</button>
                  </div>
              </div>
          </div>
      </div>`;
  }).join("");
}

function maiToggle(artId, panel) {
  ["comments", "edit"].forEach((p) => {
    const el = document.getElementById(`mai-${p}-${artId}`);
    if (el) {
      if (p === panel) el.classList.toggle("hidden");
      else el.classList.add("hidden");
    }
  });
}

function renderManageComments(artId) {
  const comments = getComments(artId);
  if (!comments.length) return '<span class="comment-no" style="padding:0.5rem 0;display:block">No comments yet.</span>';
  return comments.map((c) => `
      <div class="mai-comment-item">
          <div class="mai-comment-text">${escHtml(c.text)}</div>
          <div class="mai-comment-foot">
              <span class="comment-meta">${escHtml(formatCommentDate(c.date))}</span>
              <button class="sub-btn sub-btn-delete" style="padding:0.2rem 0.6rem;font-size:0.72rem" onclick="deleteManageComment(${JSON.stringify(artId)},'${c.id}')">🗑 Delete</button>
          </div>
      </div>`).join("");
}

async function deleteManageComment(artId, commentId) {
  await dbDeleteComment(commentId);
  const cl = document.getElementById(`mai-clist-${artId}`);
  if (cl) cl.innerHTML = renderManageComments(artId);
  const cc = document.getElementById(`mai-ccount-${artId}`);
  if (cc) cc.textContent = `💬 ${getComments(artId).length}`;
  if (currentArtwork && String(currentArtwork.id) === String(artId)) renderComments(artId);
}

async function deleteArtwork(artId) {
  if (!confirm("Remove this artwork from the gallery?")) return;
  const isExtra = !artworks.find((a) => String(a.id) === String(artId));
  if (isExtra) await dbDeleteExtraArtwork(artId);
  else          await dbHideArt(artId);
  allArtworks = allArtworks.filter((a) => String(a.id) !== String(artId));
  renderGallery();
  renderTagChips();
  renderAdminArtList();
  showToast("Artwork removed from gallery.");
}

// Aliases for backwards compatibility
function toggleManageComments(artId) { maiToggle(artId, "comments"); }
function toggleManageEdit(artId)     { maiToggle(artId, "edit"); }

async function saveArtEdit(artId) {
  const title  = document.getElementById(`edit-title-${artId}`).value.trim();
  const desc   = document.getElementById(`edit-desc-${artId}`).value.trim();
  const image  = document.getElementById(`edit-image-${artId}`)?.value.trim();
  const tagsRaw = document.getElementById(`edit-tags-${artId}`)?.value.trim();
  const nsfw   = document.getElementById(`edit-nsfw-${artId}`)?.checked;

  if (!title) { showToast("Title cannot be empty!"); return; }
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
  const changes = { title, description: desc, image: image || "", tags, nsfw };

  await dbSaveArtOverride(artId, changes);

  const art = allArtworks.find((a) => String(a.id) === String(artId));
  if (art) {
    art.title = title; art.description = desc;
    if (image) art.image = image;
    art.tags = tags; art.nsfw = nsfw;
  }

  const isExtra = !artworks.find((a) => String(a.id) === String(artId));
  if (isExtra) await dbUpdateExtraArtwork(artId, changes);

  renderGallery();
  renderTagChips();
  renderAdminArtList();
  showToast("Artwork updated! ✨");
}

// ═══════════════════════════════════════════════
// ADD ART (upload + URL)
// ═══════════════════════════════════════════════
function initDropZone() {
  const zone = document.getElementById('art-drop-zone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) handleArtFiles(files);
  });
}

function handleArtFileSelect(input) {
  const files = Array.from(input.files);
  if (files.length) handleArtFiles(files);
  input.value = '';
}

async function handleArtFiles(files) {
  const grid   = document.getElementById('art-preview-grid');
  const status = document.getElementById('art-upload-status');
  status.textContent = `Uploading ${files.length} image(s)…`;

  for (const file of files) {
    const card  = document.createElement('div');
    card.className = 'preview-card';
    const thumb = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    thumb.src = objectUrl;
    thumb.onload = () => URL.revokeObjectURL(objectUrl);
    const badge = document.createElement('span');
    badge.className = 'preview-badge';
    badge.textContent = '⏳';
    card.appendChild(thumb);
    card.appendChild(badge);
    grid.appendChild(card);

    try {
      const folder = file.type === 'image/gif' ? 'bubz/gifs' : 'bubz/gallery';
      const url = await _cloudinaryUpload(file, folder);
      const inp = document.createElement('input');
      inp.type = 'url'; inp.className = 'batch-url'; inp.value = url;
      document.getElementById('batch-url-list').appendChild(inp);
      badge.textContent = '✅';
      card.classList.add('done');
    } catch (e) {
      console.error(`[Cloudinary] ❌ Error uploading ${file.name}:`, e);
      badge.textContent = '❌';
      card.classList.add('error');
      card.title = e.message;
    }
  }

  const done   = grid.querySelectorAll('.done').length;
  const failed = grid.querySelectorAll('.error').length;
  status.textContent = failed === 0
    ? `✅ ${done} image(s) ready — fill in the title and hit Add!`
    : `⚠️ ${done} uploaded, ${failed} failed`;
}

function addUrlField() {
  const container = document.getElementById('batch-url-list');
  const inp = document.createElement('input');
  inp.type = 'url'; inp.className = 'batch-url'; inp.placeholder = 'Paste image URL…';
  container.appendChild(inp);
  inp.focus();
}

async function submitNewArt() {
  const title    = document.getElementById('new-title').value.trim();
  const desc     = document.getElementById('new-desc').value.trim();
  const tagsRaw  = document.getElementById('new-tags').value.trim();
  const nsfw     = document.getElementById('new-nsfw').checked;
  const separate = document.getElementById('new-separate')?.checked ?? false;

  const images = Array.from(document.querySelectorAll('.batch-url'))
    .map(i => i.value.trim()).filter(Boolean);

  if (!title)         { showToast('Title is required!'); return; }
  if (!images.length) { showToast('At least one image is required!'); return; }

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
  const date = new Date().toISOString().split('T')[0];

  if (!separate && images.length > 1) {
    const newArt = { id: String(Date.now()), title, description: desc, image: images[0], images, tags, nsfw, date };
    await dbAddExtraArtwork(newArt);
    allArtworks.unshift(newArt);
    showToast(`Artwork added with ${images.length} images! 🎨`);
  } else {
    for (let i = 0; i < images.length; i++) {
      const newArt = {
        id: String(Date.now() + i),
        title: images.length > 1 ? `${title} (${i + 1}/${images.length})` : title,
        description: desc, image: images[i], tags, nsfw, date,
      };
      await dbAddExtraArtwork(newArt);
      allArtworks.unshift(newArt);
    }
    showToast(images.length > 1 ? `${images.length} artworks added! 🎨` : 'Artwork added! 🎨');
  }

  renderTagChips();
  renderGallery();

  document.getElementById('new-title').value = '';
  document.getElementById('new-desc').value  = '';
  document.getElementById('new-tags').value  = '';
  document.getElementById('new-nsfw').checked = false;
  if (document.getElementById('new-separate')) document.getElementById('new-separate').checked = false;
  document.getElementById('batch-url-list').innerHTML = '';
  document.getElementById('paste-url-input').value = '';
  document.getElementById('art-preview-grid').innerHTML = '';
  document.getElementById('art-upload-status').textContent = '';
}

// ═══════════════════════════════════════════════
// POLL CREATION (admin creates polls)
// ═══════════════════════════════════════════════
function addPollOption() {
  const list = document.getElementById('poll-options-list');
  if (!list || list.children.length >= 6) return;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'poll-opt-input';
  inp.placeholder = `Option ${list.children.length + 1}…`; inp.maxLength = 100;
  list.appendChild(inp);
}

async function submitPoll() {
  const question  = (document.getElementById('poll-question')?.value || '').trim();
  const optInputs = [...document.querySelectorAll('.poll-opt-input')];
  const options   = optInputs.map(i => i.value.trim()).filter(Boolean);
  const sender    = (document.getElementById('poll-sender')?.value || '').trim() || 'Bubs';
  const statusEl  = document.getElementById('poll-status');

  if (!question)          { if (statusEl) statusEl.textContent = '⚠️ Question is required.'; return; }
  if (options.length < 2) { if (statusEl) statusEl.textContent = '⚠️ Need at least 2 options.'; return; }

  if (statusEl) statusEl.textContent = 'Posting…';
  const entry = {
    id: String(Date.now()), type: 'poll',
    data: JSON.stringify({ question, options }),
    sender, timestamp: new Date().toISOString(), requestedVis: 'public',
  };
  await dbAddPublicPost(entry);

  document.getElementById('poll-question').value = '';
  document.getElementById('poll-sender').value   = '';
  optInputs.forEach((inp, i) => { inp.value = ''; inp.placeholder = `Option ${i + 1}…`; });
  const list = document.getElementById('poll-options-list');
  while (list.children.length > 2) list.removeChild(list.lastChild);

  if (statusEl) statusEl.textContent = '✅ Poll posted!';
  setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
  renderWall();
}

// ═══════════════════════════════════════════════
// PENDING / INBOX / WALL MANAGEMENT TABS
// ═══════════════════════════════════════════════
function _subTypeBadge(s) {
  if (s.type === "drawing") return "🎨 Drawing";
  if (s.type === "poll")    return "📊 Poll";
  return "💬 Message";
}
function _subSender(s) {
  return s.sender
    ? `<span class="submission-sender">✏️ ${escHtml(s.sender)}</span>`
    : `<span class="submission-sender anon">🙈 Anonymous</span>`;
}
function _subContent(s) {
  if (s.type === "drawing") return `<img src="${s.data}" class="sub-img" alt="drawing">`;
  if (s.type === "poll") {
    try {
      const d = JSON.parse(s.data);
      const opts = (d.options || []).map((o, i) => `${i + 1}. ${escHtml(o)}`).join("<br>");
      return `<div class="sub-text"><strong>${escHtml(d.question)}</strong><br>${opts}</div>`;
    } catch { return `<p class="sub-text">[Poll data unavailable]</p>`; }
  }
  return `<p class="sub-text">${escHtml(s.data)}</p>`;
}

function renderPending() {
  const list = document.getElementById("pending-list");
  if (!list) return;
  const pending = getPending().slice().reverse();
  updatePendingBadge();

  if (!pending.length) {
    list.innerHTML = '<div class="no-submissions">✅ Nothing pending, you\'re all caught up!</div>';
    return;
  }

  list.innerHTML = pending.map((s) => {
    const reqBadge = s.requestedVis === "public"
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
            <button class="sub-btn sub-btn-delete"  onclick="deletePending('${s.id}')">🗑 Delete</button>
        </div>
    </div>`;
  }).join("");
}

function renderAdminWall() {
  const container = document.getElementById('admin-wall-list');
  if (!container) return;
  const posts = getPublicPosts().slice().reverse();
  if (!posts.length) { container.innerHTML = '<div class="no-submissions">No wall posts yet! 🌸</div>'; return; }

  container.innerHTML = posts.map(post => {
    const replies  = getReplies(post.id);
    const sender   = post.sender ? `✏️ ${escHtml(post.sender)}` : '🙈 Anon';
    const typeBadge = post.type === 'drawing' ? '🎨 Drawing' : post.type === 'poll' ? '📊 Poll' : '💬 Message';
    let contentHtml = '';
    if (post.type === 'drawing') {
      contentHtml = `<img class="admin-wall-thumb" src="${escHtml(post.data)}" alt="Drawing">`;
    } else if (post.type === 'poll') {
      let q = '';
      try { q = (typeof post.data === 'object' ? post.data : JSON.parse(post.data)).question || ''; } catch(e) {}
      contentHtml = `<div class="admin-wall-preview">📊 ${escHtml(q)}</div>`;
    } else {
      const preview = String(post.data || '').substring(0, 140);
      contentHtml = `<div class="admin-wall-preview">${escHtml(preview)}${post.data.length > 140 ? '…' : ''}</div>`;
    }
    const repliesHtml = replies.length
      ? replies.map(r => `
          <div class="admin-reply-row" id="admin-reply-${r.id}">
            <div class="admin-reply-info">
              <span class="admin-reply-sender">${r.sender ? escHtml(r.sender) : '🙈 Anon'}</span>
              <span class="admin-reply-text">${escHtml(r.text)}</span>
              <span class="admin-reply-date">${escHtml(formatCommentDate(r.timestamp))}</span>
            </div>
            <button class="admin-reply-del-btn" onclick="adminDeleteReply('${r.id}','${post.id}')" title="Delete reply">✕</button>
          </div>`).join('')
      : '<div class="admin-reply-empty">No replies yet</div>';

    return `
      <div class="admin-wall-card" id="admin-wall-post-${post.id}">
        <div class="admin-wall-header">
          <div class="admin-wall-meta">
            <span class="submission-type-badge">${typeBadge}</span>
            <span class="admin-wall-sender">${sender}</span>
            <span class="admin-wall-date">${escHtml(formatCommentDate(post.timestamp))}</span>
            ${replies.length ? `<span class="admin-wall-reply-badge">💬 ${replies.length}</span>` : ''}
          </div>
          <button class="sub-btn sub-btn-delete" onclick="adminDeleteWallPost('${post.id}')">🗑 Delete Post</button>
        </div>
        ${contentHtml}
        <details class="admin-replies-details">
          <summary class="admin-replies-summary">↩ ${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}</summary>
          <div class="admin-replies-list" id="admin-replies-${post.id}">${repliesHtml}</div>
        </details>
      </div>`;
  }).join('');
}

async function adminDeleteReply(replyId, postId) {
  if (!adminLoggedIn) return;
  if (!confirm('Delete this reply?')) return;
  await dbDeleteReply(replyId);
  const adminRow = document.getElementById(`admin-reply-${replyId}`);
  if (adminRow) adminRow.remove();
  const lbRow = document.querySelector(`[data-reply-id="${replyId}"]`);
  if (lbRow) lbRow.remove();
  const list = document.getElementById(`admin-replies-${postId}`);
  if (list) {
    const remaining = list.querySelectorAll('.admin-reply-row').length;
    const summary = list.closest('details')?.querySelector('summary');
    if (summary) summary.textContent = `↩ ${remaining} ${remaining === 1 ? 'Reply' : 'Replies'}`;
    if (remaining === 0) list.innerHTML = '<div class="admin-reply-empty">No replies yet</div>';
    const badge = document.querySelector(`#admin-wall-post-${postId} .admin-wall-reply-badge`);
    if (badge) badge.textContent = remaining ? `💬 ${remaining}` : '';
  }
}

async function adminDeleteWallPost(id) {
  if (!adminLoggedIn) return;
  if (!confirm('Delete this wall post and all its replies?')) return;
  await dbDeletePublicPost(id);
  removeWallCard(id);
  renderSubmissions();
  const card = document.getElementById(`admin-wall-post-${id}`);
  if (card) card.remove();
}

function renderSubmissions() {
  const list = document.getElementById("submissions-list");
  if (!list) return;
  const publicPosts  = getPublicPosts().slice().reverse();
  const privateSubs  = getSubmissions().slice().reverse();

  if (!publicPosts.length && !privateSubs.length) {
    list.innerHTML = '<div class="no-submissions">No approved submissions yet! 🌸</div>';
    return;
  }

  let html = "";

  if (publicPosts.length) {
    html += `<div class="submissions-section-label">🌐 Public Wall (${publicPosts.length})</div>`;
    html += publicPosts.map((s) => `
        <div class="submission-item">
            <div class="submission-meta">
                <span class="sub-vis-badge pub">🌐 Public</span>
                <span class="submission-type-badge">${_subTypeBadge(s)}</span>
                ${_subSender(s)}
                <span>${escHtml(formatCommentDate(s.timestamp))}</span>
            </div>
            ${_subContent(s)}
            <div class="sub-actions">
                <button class="sub-btn sub-btn-delete" onclick="deleteWallPostFromAdmin('${s.id}')">🗑 Delete from Wall</button>
            </div>
        </div>`).join("");
  }

  if (privateSubs.length) {
    html += `<div class="submissions-section-label">🔒 Private Inbox (${privateSubs.length})</div>`;
    html += privateSubs.map((s) => `
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
                <button class="sub-btn sub-btn-delete"  onclick="deletePrivateSub('${s.id}')">🗑 Delete</button>
            </div>
        </div>`).join("");
  }

  list.innerHTML = html;
}

// ═══════════════════════════════════════════════
// AUTO-TAG SUGGESTION
// ═══════════════════════════════════════════════
const _TAG_STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','as','is','are','was','were','be','been','this','that',
  'these','those','it','its','i','me','my','we','you','your','he','she',
  'they','his','her','their','our','just','so','do','did','have','has',
  'had','will','would','can','could','not','no','up','out','about','like',
  'really','very','also','even','now','then','than','too','here','there',
  'when','who','what','how','why','which','all','some','any','each','more',
  'most','other','into','over','after','before','still','already','lol',
  'omg','wow','hey','gawd','nah','bro','yeah','ok',
]);

function _buildTagSuggestions() {
  const titleEl = document.getElementById('new-title');
  const descEl  = document.getElementById('new-desc');
  const tagsEl  = document.getElementById('new-tags');
  if (!titleEl) return [];

  const title    = titleEl.value || '';
  const desc     = descEl?.value  || '';
  const combined = (title + ' ' + desc).toLowerCase();

  const currentTags = new Set(
    (tagsEl?.value || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  );

  const galleryTags = new Set();
  allArtworks.forEach(art => (art.tags || []).forEach(t => galleryTags.add(t.trim().toLowerCase())));

  // 1. Existing tags whose text appears in title/desc
  const matched = [...galleryTags].filter(tag => {
    if (currentTags.has(tag)) return false;
    if (tag.includes(' ')) return combined.includes(tag);
    return combined.split(/[\s,\-\/()\[\]!?.]+/).some(w => w === tag);
  });

  // 2. Capitalized words from raw text (potential proper nouns / new tags)
  const rawWords = (title + ' ' + desc).split(/[\s,\-\/()\[\]!?.]+/);
  const potential = [...new Set(
    rawWords
      .filter(w => w.length >= 3 && /^[A-Z]/.test(w))
      .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(w => {
        if (w.length < 3 || _TAG_STOP_WORDS.has(w)) return false;
        if (currentTags.has(w) || galleryTags.has(w)) return false;
        if (matched.some(tag => tag.split(' ').includes(w))) return false;
        return true;
      })
  )].slice(0, 4);

  return [...matched, ...potential];
}

function renderTagSuggestions() {
  const wrap  = document.getElementById('tag-suggest-wrap');
  const chips = document.getElementById('tag-suggest-chips');
  if (!wrap || !chips) return;
  const suggestions = _buildTagSuggestions();
  if (!suggestions.length) {
    wrap.classList.add('hidden');
    chips.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  chips.innerHTML = suggestions.map(tag =>
    `<span class="tag-suggest-chip" onclick="addSuggestedTag('${escHtml(tag)}')">#${escHtml(tag)} <span class="tag-suggest-plus">+</span></span>`
  ).join('');
}

function addSuggestedTag(tag) {
  const input = document.getElementById('new-tags');
  if (!input) return;
  const current = input.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  if (current.includes(tag.toLowerCase())) return;
  current.push(tag.toLowerCase());
  input.value = current.join(', ');
  renderTagSuggestions();
}

function initAutoTagSuggest() {
  ['new-title', 'new-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderTagSuggestions);
  });
  const tagsEl = document.getElementById('new-tags');
  if (tagsEl) tagsEl.addEventListener('input', renderTagSuggestions);
}

// ═══════════════════════════════════════════════
// EXPORT & STORAGE
// ═══════════════════════════════════════════════
function exportData() {
  const commentMap  = {};
  for (const [k, v] of Object.entries(_comments))  { if (v.length) commentMap["comments-" + k] = v; }
  const reactionMap = {};
  for (const [k, v] of Object.entries(_reactions)) { if (Object.keys(v).length) reactionMap["reactions-" + k] = v; }
  const wallRxnMap  = {};
  for (const [k, v] of Object.entries(_wallRxns))  { if (Object.keys(v).length) wallRxnMap["wall-reactions-" + k] = v; }

  const backup = {
    exportedAt: new Date().toISOString(),
    data: {
      "public-posts":         _publicPosts,
      "pending-submissions":  _pending,
      "anonymous-submissions": _inbox,
      "extra-artworks":       _extraArts,
      "art-overrides":        _overrides,
      "hidden-art-ids":       _hiddenIds,
      ...commentMap, ...reactionMap, ...wallRxnMap,
    },
  };

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  a.download = `bubbles-gallery-backup-${Date.now()}.json`;
  a.click();
  showToast("Backup downloaded! 💾");
}

function checkStorageUsage() {
  const existing = document.querySelector(".storage-warning");
  if (existing) existing.remove();
  // Data stored in Supabase — no localStorage size limit.
}

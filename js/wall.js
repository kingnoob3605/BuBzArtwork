/* =============================================
   WALL.JS — Community wall, replies, polls, wall lightbox
   ============================================= */

let wallFilter = "all";
const WALL_QUICK_REACTIONS = ['❤️', '🔥', '✨'];
const REPLY_AVATARS = ['🐣','🐻','🌷','🍄','🎭','🦋','🍀','🔮','🎪','🌙'];

// ═══════════════════════════════════════════════
// WALL FILTER & RENDER
// ═══════════════════════════════════════════════
function setWallFilter(filter, el) {
  wallFilter = filter;
  document.querySelectorAll(".wall-chip").forEach((c) => c.classList.remove("active"));
  if (el) el.classList.add("active");
  renderWall();
}

function renderWall() {
  const grid = document.getElementById("wall-grid");
  if (!grid) return;
  let posts = getPublicPosts().slice().reverse();
  if (wallFilter === 'drawing' || wallFilter === 'message') posts = posts.filter(p => p.type === wallFilter);
  if (wallFilter === 'poll') posts = posts.filter(p => p.type === 'poll');

  if (!posts.length) {
    grid.innerHTML = '<div class="wall-empty"><span>🌸</span><p>No public posts yet! Be the first to share something! ✨</p></div>';
    return;
  }

  grid.innerHTML = posts.map(post => {
    const reactions = getWallReactions(post.id);
    const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
    const replyCount = getReplies(post.id).length;
    const senderText = post.sender ? `✏️ ${escHtml(post.sender)}` : '🙈 Anon';
    const topEmoji = totalReactions > 0
      ? Object.entries(reactions).sort((a, b) => b[1] - a[1])[0][0]
      : '❤️';
    const statsHtml = [
      totalReactions > 0 ? `<span class="wall-mini-stat">${topEmoji} ${totalReactions}</span>` : '',
      replyCount > 0     ? `<span class="wall-mini-stat">💬 ${replyCount}</span>`               : '',
    ].join('');
    const miniFooter = `<div class="wall-card-mini-foot">
        <span class="wall-mini-sender">${senderText}</span>
        <span class="wall-mini-ago">${timeAgo(post.timestamp)}</span>
        ${statsHtml}
    </div>`;

    if (post.type === 'drawing') {
      return `<div class="wall-card" data-id="${post.id}" onclick="openWallPost('${post.id}')">
          <div class="wall-card-img"><img src="${post.data}" alt="Drawing" loading="lazy"></div>
          ${miniFooter}
      </div>`;
    } else if (post.type === 'poll') {
      let question = '';
      try { question = JSON.parse(post.data).question; } catch {}
      return `<div class="wall-card wall-card-poll-thumb" data-id="${post.id}" onclick="openWallPost('${post.id}')">
          <div class="wall-card-poll-preview">
              <span class="wall-poll-thumb-icon">📊</span>
              <p class="wall-poll-thumb-q">${escHtml(question.slice(0, 80))}${question.length > 80 ? '…' : ''}</p>
          </div>
          ${miniFooter}
      </div>`;
    } else {
      return `<div class="wall-card" data-id="${post.id}" onclick="openWallPost('${post.id}')">
          <div class="wall-card-text">${escHtml(post.data.slice(0, 120))}${post.data.length > 120 ? '…' : ''}</div>
          ${miniFooter}
      </div>`;
    }
  }).join('');
}

function removeWallCard(id) {
  const card = document.querySelector(`#wall-grid [data-id="${id}"]`);
  if (card) card.remove();
  const grid = document.getElementById('wall-grid');
  if (grid && !grid.querySelector('.wall-card')) {
    grid.innerHTML = '<div class="wall-empty"><span>🌸</span><p>No public posts yet! Be the first to share something! ✨</p></div>';
  }
}

// ═══════════════════════════════════════════════
// WALL REACTIONS
// ═══════════════════════════════════════════════
async function addWallReaction(postId, emoji, triggerBtn) {
  if (!isEmojiAllowed(emoji)) { showToast("That reaction isn't allowed here 🚫"); return; }
  if (triggerBtn) { _popReactionBtn(triggerBtn); _spawnEmojiFloat(triggerBtn, emoji); }
  await dbIncrementWallReaction(postId, emoji);
  renderWallReactions(postId);
}

function renderWallReactions(postId) {
  const container = document.getElementById("wall-reactions-" + postId);
  if (!container) return;
  container.innerHTML = buildWallReactionsHtml(postId);
}

function buildWallReactionsHtml(postId) {
  const data = getWallReactions(postId);
  const used = Object.keys(data).filter((e) => data[e] > 0);
  const quickBtns = WALL_QUICK_REACTIONS
    .filter(e => !used.includes(e))
    .map(e => `<button class="reaction-btn reaction-quick-btn wall-reaction-btn" onclick="addWallReaction('${postId}','${e}',this)" title="${e}">${e}</button>`)
    .join('');
  return (
    used.map((e) =>
      `<button class="reaction-btn has-count wall-reaction-btn" onclick="addWallReaction('${postId}','${escHtml(e)}')" title="React with ${escHtml(e)}">
          ${escHtml(e)}<span class="reaction-count">${data[e]}</span>
      </button>`
    ).join("") +
    quickBtns +
    `<button class="reaction-btn reaction-add-btn wall-reaction-btn" onclick="openEmojiPicker('${postId}',this,'wall')" title="Add reaction">＋</button>`
  );
}

// ═══════════════════════════════════════════════
// POLLS
// ═══════════════════════════════════════════════
function buildPollHtml(post) {
  let pollData;
  try { pollData = JSON.parse(post.data); } catch { return '<p>Invalid poll data.</p>'; }
  const votes    = getPollVotes(post.id);
  const total    = Object.values(votes).reduce((a, b) => a + b, 0);
  const voted    = hasUserVoted(post.id);
  const userVote = getUserVoteIdx(post.id);
  const opts     = (pollData.options || []).map((opt, i) => {
    const count = votes[String(i)] || 0;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const isMe  = voted && userVote === i;
    return `<button class="poll-option${isMe ? ' my-vote' : ''}" onclick="votePoll('${post.id}',${i})" ${voted ? 'disabled' : ''}>
        <div class="poll-bar" style="width:0%" data-target="${voted ? pct : 0}"></div>
        <span class="poll-opt-text">${escHtml(opt)}</span>
        ${voted ? `<span class="poll-opt-pct">${pct}%</span>` : ''}
    </button>`;
  }).join('');
  return `<div class="poll-question">${escHtml(pollData.question)}</div>
          <div class="poll-options">${opts}</div>
          <div class="poll-total">${total} vote${total !== 1 ? 's' : ''}${voted ? ' · You voted!' : ' · Tap to vote'}</div>`;
}

function animatePollBars(container) {
  requestAnimationFrame(() => {
    container.querySelectorAll('.poll-bar').forEach(bar => {
      bar.style.width = (bar.dataset.target || 0) + '%';
    });
  });
}

async function votePoll(postId, optionIdx) {
  const voted = await dbVotePoll(postId, optionIdx);
  if (!voted) return;
  const post = getPublicPosts().find(p => p.id === postId);
  if (!post) return;
  if (currentWallPost && currentWallPost.id === postId) {
    const contentEl = document.getElementById('wlb-content');
    if (contentEl) {
      const wrap = contentEl.querySelector('.wall-lb-poll-wrap');
      if (wrap) { wrap.innerHTML = buildPollHtml(post); animatePollBars(wrap); }
    }
  }
}

// ═══════════════════════════════════════════════
// REPLIES
// ═══════════════════════════════════════════════
function buildRepliesHtml(postId) {
  const replies = getReplies(postId);
  if (!replies.length) return '<div class="wall-reply-empty">No replies yet — say something! ✨</div>';
  return replies.map((r, i) => {
    const isOwner = !!r.is_owner;
    const avatar  = isOwner ? '🎨' : REPLY_AVATARS[i % REPLY_AVATARS.length];
    const sender  = isOwner ? 'BuBz' : (r.sender ? escHtml(r.sender) : 'Anon');
    const ownerClass = isOwner ? ' wall-reply--owner' : '';
    const ownerBadge = isOwner ? `<span class="reply-owner-badge">👑 BuBz</span>` : '';
    const delBtn = adminLoggedIn
      ? `<button class="reply-del-btn" onclick="deleteReply('${r.id}')" title="Delete">✕</button>`
      : '';
    return `
    <div class="wall-reply${ownerClass}" data-reply-id="${r.id}">
        <div class="reply-avatar">${avatar}</div>
        <div class="reply-bubble">
            ${ownerBadge}
            <div class="reply-top">
                <span class="reply-sender">${sender}</span>
                <span class="reply-date">${escHtml(formatCommentDate(r.timestamp))}</span>
                ${delBtn}
            </div>
            <div class="reply-text">${escHtml(r.text)}</div>
        </div>
    </div>`;
  }).join('');
}

function toggleReplyInput(postId) {
  const row = document.getElementById('reply-row-' + postId);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  row.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) document.getElementById('reply-input-' + postId)?.focus();
}

// Show/hide named input when anon select changes
document.addEventListener('change', e => {
  if (!e.target.classList.contains('reply-anon-sel')) return;
  const postId = e.target.id.replace('reply-anon-', '');
  const nameInput = document.getElementById('reply-name-' + postId);
  if (nameInput) nameInput.style.display = e.target.value === '__named__' ? 'block' : 'none';
});

let _replyPosting = false;
async function postReply(postId) {
  if (_replyPosting) return;
  const input   = document.getElementById('reply-input-' + postId);
  const text    = input?.value.trim();
  if (!text) return;
  if (isBanned(text)) { showSassyBannedPopup(); input.value = ''; return; }

  const sendBtn = document.querySelector(`#reply-row-${postId} .reply-send-btn`);
  _replyPosting = true;
  if (input)   { input.disabled = true; }
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

  try {
    const sel   = document.getElementById('reply-anon-' + postId);
    const named = sel?.value === '__named__';
    const replyName = named ? (document.getElementById('reply-name-' + postId)?.value.trim() || null) : null;
    if (!adminLoggedIn && isBubzName(replyName)) { showBubzNameWarning(); return; }
    const name  = adminLoggedIn ? 'BuBz' : replyName;

    await dbAddReply(postId, text, name, adminLoggedIn);
    input.value = '';

    const row = document.getElementById('reply-row-' + postId);
    if (row) row.style.display = 'none';

    const repliesEl = document.getElementById('replies-' + postId);
    if (repliesEl) {
      repliesEl.innerHTML = buildRepliesHtml(postId);
      repliesEl.scrollTop = repliesEl.scrollHeight;
    }
    const toggleBtn = repliesEl?.closest('.wall-replies-wrap')?.querySelector('.reply-toggle-btn');
    if (toggleBtn) {
      const count = getReplies(postId).length;
      toggleBtn.textContent = `↩ ${count} Repl${count === 1 ? 'y' : 'ies'}`;
    }
    showToast(adminLoggedIn ? 'Reply posted as BuBz 👑✨' : 'Reply sent! ✨');
  } finally {
    _replyPosting = false;
    if (input)   { input.disabled = false; input.focus(); }
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send ✨'; }
  }
}

async function deleteReply(replyId) {
  if (!adminLoggedIn) return;
  if (!confirm('Delete this reply?')) return;
  await dbDeleteReply(replyId);
  const el = document.querySelector(`[data-reply-id="${replyId}"]`);
  if (el) el.remove();
}

// ═══════════════════════════════════════════════
// WALL LIGHTBOX
// ═══════════════════════════════════════════════
function openWallPost(id) {
  const post = getPublicPosts().find(p => p.id === id);
  if (!post) return;

  if (currentWallPost) {
    const prev = currentWallPost.id;
    const r = document.getElementById(`wall-reactions-${prev}`);
    if (r) r.id = 'wlb-reactions';
    const rep = document.getElementById(`replies-${prev}`);
    if (rep) rep.id = 'wlb-replies';
  }
  currentWallPost = post;

  const contentEl = document.getElementById('wlb-content');
  if (post.type === 'drawing') {
    contentEl.className = 'wall-lb-left wall-lb-drawing';
    contentEl.innerHTML = `
        <img src="${escHtml(post.data)}" alt="Drawing" class="wall-lb-img">
        <button class="wall-lb-download-btn" data-url="${escHtml(post.data)}" onclick="downloadWallImage(this.dataset.url,event)">⬇ Download</button>`;
  } else if (post.type === 'poll') {
    contentEl.className = 'wall-lb-left wall-lb-poll';
    contentEl.innerHTML = `<div class="wall-lb-poll-wrap">${buildPollHtml(post)}</div>`;
  } else {
    contentEl.className = 'wall-lb-left wall-lb-message';
    contentEl.innerHTML = `
        <div class="wall-lb-text-wrap">
            <span class="wall-lb-bigquote">"</span>
            <p class="wall-lb-text">${escHtml(post.data)}</p>
        </div>`;
  }

  const sender = post.sender ? `✏️ ${escHtml(post.sender)}` : '🙈 Anonymous';
  const typeBadge = post.type === 'drawing' ? '🎨 Drawing' : post.type === 'poll' ? '📊 Poll' : '💬 Message';
  const adminDelBtn = adminLoggedIn
    ? `<button class="wall-lb-del" onclick="deleteWallPostFromLightbox('${post.id}')" title="Delete">🗑</button>`
    : '';
  document.getElementById('wlb-meta').innerHTML = `
      <span class="wall-type-badge">${typeBadge}</span>
      <span class="wall-lb-sender">${sender}</span>
      <span class="wall-lb-date">${timeAgo(post.timestamp)}</span>
      ${adminDelBtn}`;

  const reactEl = document.getElementById('wlb-reactions');
  reactEl.id = `wall-reactions-${post.id}`;
  reactEl.innerHTML = buildWallReactionsHtml(post.id);

  const repliesEl = document.getElementById('wlb-replies');
  repliesEl.id = `replies-${post.id}`;
  repliesEl.innerHTML = buildRepliesHtml(post.id);

  const replyCount = getReplies(post.id).length;
  document.getElementById('wlb-reply-input').innerHTML = `
      <div class="reply-input-row" id="reply-row-${post.id}" style="display:none">
          <div class="reply-input-top">
              <input class="reply-input" id="reply-input-${post.id}" placeholder="Write a reply…" maxlength="200"
                  onkeydown="if(event.key==='Enter')postReply('${post.id}')">
              <button class="reply-send-btn" onclick="postReply('${post.id}')">Send ✨</button>
          </div>
          <div class="reply-input-bottom">
              <select class="reply-anon-sel" id="reply-anon-${post.id}">
                  <option value="">🙈 Anon</option>
                  <option value="__named__">✏️ Named…</option>
              </select>
              <input class="reply-name-input" id="reply-name-${post.id}" placeholder="Your name…" style="display:none" maxlength="40">
              <button class="reply-cancel-btn" onclick="toggleReplyInput('${post.id}')">✕ Cancel</button>
          </div>
      </div>
      <button class="reply-toggle-btn" onclick="toggleReplyInput('${post.id}')">
          ↩ ${replyCount > 0 ? replyCount + ' Repl' + (replyCount === 1 ? 'y' : 'ies') : 'Reply'}
      </button>`;

  const lb = document.getElementById('wall-lightbox');
  lb.classList.add('open');
  lb.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  if (post.type === 'poll') {
    const wrap = document.querySelector('#wlb-content .wall-lb-poll-wrap');
    if (wrap) animatePollBars(wrap);
  }

  if (typeof gsap !== 'undefined') {
    gsap.fromTo('.wall-lb-inner',
      { y: 40, opacity: 0, scale: 0.97 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' }
    );
  }
}

function closeWallPost() {
  const finish = () => {
    const lb = document.getElementById('wall-lightbox');
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (currentWallPost) {
      const r = document.getElementById(`wall-reactions-${currentWallPost.id}`);
      if (r) r.id = 'wlb-reactions';
      const rep = document.getElementById(`replies-${currentWallPost.id}`);
      if (rep) rep.id = 'wlb-replies';
    }
    currentWallPost = null;
    if (typeof gsap !== 'undefined') gsap.set('.wall-lb-inner', { y: 0, opacity: 1, scale: 1 });
  };
  if (typeof gsap !== 'undefined') {
    gsap.to('.wall-lb-inner', { y: 20, opacity: 0, scale: 0.97, duration: 0.25, ease: 'power2.in', onComplete: finish });
  } else {
    finish();
  }
}

// ═══════════════════════════════════════════════
// WALL POST DELETIONS
// ═══════════════════════════════════════════════
async function approveToWall(id) {
  const item = _pending.find((p) => p.id === id);
  if (!item) return;
  await removePending(id);
  await dbAddPublicPost(item);
  renderPending();
  renderWall();
  updatePendingBadge();
  showToast("✅ Approved! Now on the Wall!");
}

async function approvePrivateToWall(id) {
  const item = _inbox.find((p) => p.id === id);
  if (!item) return;
  await dbDeletePrivate(id);
  await dbAddPublicPost({ ...item, requestedVis: "public" });
  renderSubmissions();
  renderWall();
  showToast("✅ Moved to Wall!");
}

async function approvePrivate(id) {
  const item = _pending.find((p) => p.id === id);
  if (!item) return;
  await removePending(id);
  await dbAddPrivate(item);
  renderPending();
  updatePendingBadge();
  showToast("🔒 Kept as private submission.");
}

async function deletePending(id) {
  await removePending(id);
  renderPending();
  updatePendingBadge();
  showToast("🗑 Submission deleted.");
}

async function deletePrivateSub(id) {
  await dbDeletePrivate(id);
  renderSubmissions();
  showToast("🗑 Submission deleted.");
}

async function deletePublicPost(id) {
  if (!adminLoggedIn) return;
  if (!confirm("Delete this public post?")) return;
  await dbDeletePublicPost(id);
  removeWallCard(id);
}

async function deleteWallPostFromLightbox(id) {
  if (!adminLoggedIn) return;
  if (!confirm("Delete this public post?")) return;
  await dbDeletePublicPost(id);
  removeWallCard(id);
  closeWallPost();
}

async function deleteWallPostFromAdmin(id) {
  if (!adminLoggedIn) return;
  if (!confirm("Delete this public post?")) return;
  await dbDeletePublicPost(id);
  removeWallCard(id);
  renderSubmissions();
}

// ═══════════════════════════════════════════════
// DOWNLOAD WALL IMAGE
// ═══════════════════════════════════════════════
function downloadWallImage(url, e) {
  if (e) e.stopPropagation();
  if (url.includes('cloudinary.com')) {
    const dlUrl = url.replace('/upload/', '/upload/fl_attachment/');
    const a = document.createElement('a');
    a.href = dlUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } else if (url.startsWith('data:')) {
    const [header, base64] = url.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const ext = mime === 'image/gif' ? 'gif' : mime === 'image/png' ? 'png' : 'jpg';
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl; a.download = `bubz-drawing.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } else {
    const a = document.createElement('a');
    a.href = url; a.download = 'bubz-drawing.png'; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

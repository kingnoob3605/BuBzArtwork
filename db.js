// ============================================================
// db.js — Supabase data layer for Bubbles' Gallery
// All shared data (comments, reactions, posts, etc.) lives here.
// localStorage is kept ONLY for per-user data: age gate + submit cooldown.
// ============================================================

// SUPABASE_URL and SUPABASE_ANON are loaded from keys.js (gitignored)

const _db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── In-memory cache (loaded once at startup) ──────────────────
let _comments  = {};   // artId (str) → [{id, text, date}]
let _reactions = {};   // artId (str) → {emoji: count}
let _wallRxns  = {};   // postId (str) → {emoji: count}
let _publicPosts = []; // [{id, type, data, sender, timestamp, requestedVis}]
let _pending     = []; // [{id, type, data, sender, timestamp, requestedVis}]
let _inbox       = []; // [{id, type, data, sender, timestamp}]
let _extraArts   = []; // [{id, title, description, image, tags, nsfw, date}]
let _overrides   = {}; // artId (str) → {title, description, image, tags, nsfw}
let _hiddenIds   = []; // [artId (str)]
let _replies     = {}; // postId (str) → [{id, text, sender, timestamp}]
let _pollVotes   = {}; // postId (str) → {optionIdx(str): count}

// ── Bootstrap — load everything from Supabase ─────────────────
async function dbInit() {
    try {
        const [
            { data: comments   },
            { data: reactions  },
            { data: wallRxns   },
            { data: wallPosts  },
            { data: pending    },
            { data: inbox      },
            { data: extraArts  },
            { data: overrides  },
            { data: hiddenArts },
            { data: repliesData    },
            { data: pollVotesData  },
        ] = await Promise.all([
            _db.from('comments').select('*').order('created_at', { ascending: true }),
            _db.from('reactions').select('*'),
            _db.from('wall_reactions').select('*'),
            _db.from('wall_posts').select('*').order('created_at', { ascending: true }),
            _db.from('pending_submissions').select('*').order('created_at', { ascending: true }),
            _db.from('private_inbox').select('*').order('created_at', { ascending: true }),
            _db.from('extra_artworks').select('*').order('created_at', { ascending: false }),
            _db.from('art_overrides').select('*'),
            _db.from('hidden_arts').select('*'),
            _db.from('wall_replies').select('*').order('created_at', { ascending: true }),
            _db.from('poll_votes').select('post_id, option_idx'),
        ]);

        // Comments: group by art_id
        _comments = {};
        (comments || []).forEach(c => {
            const key = String(c.art_id);
            if (!_comments[key]) _comments[key] = [];
            _comments[key].push({ id: c.id, text: c.text, date: c.date, is_owner: !!c.is_owner });
        });

        // Reactions: group by art_id
        _reactions = {};
        (reactions || []).forEach(r => {
            const key = String(r.art_id);
            if (!_reactions[key]) _reactions[key] = {};
            _reactions[key][r.emoji] = r.count;
        });

        // Wall reactions: group by post_id
        _wallRxns = {};
        (wallRxns || []).forEach(r => {
            const key = String(r.post_id);
            if (!_wallRxns[key]) _wallRxns[key] = {};
            _wallRxns[key][r.emoji] = r.count;
        });

        // Public wall posts
        _publicPosts = (wallPosts || []).map(p => ({
            id: p.id, type: p.type, data: p.data,
            sender: p.sender, timestamp: p.timestamp,
            requestedVis: p.requested_vis,
        }));

        // Pending submissions
        _pending = (pending || []).map(p => ({
            id: p.id, type: p.type, data: p.data,
            sender: p.sender, timestamp: p.timestamp,
            requestedVis: p.requested_vis,
        }));

        // Private inbox
        _inbox = (inbox || []).map(p => ({
            id: p.id, type: p.type, data: p.data,
            sender: p.sender, timestamp: p.timestamp,
        }));

        // Extra artworks (newest first from Supabase)
        _extraArts = (extraArts || []).map(a => ({
            id: a.id, title: a.title, description: a.description,
            image: a.image, images: a.images || null,
            tags: a.tags || [], nsfw: a.nsfw || false, date: a.date,
        }));

        // Art overrides
        _overrides = {};
        (overrides || []).forEach(o => {
            _overrides[String(o.art_id)] = {
                title: o.title, description: o.description,
                image: o.image, tags: o.tags || [], nsfw: o.nsfw,
            };
        });

        // Hidden art IDs
        _hiddenIds = (hiddenArts || []).map(h => String(h.art_id));

        // Replies: group by post_id
        _replies = {};
        (repliesData || []).forEach(r => {
            const key = String(r.post_id);
            if (!_replies[key]) _replies[key] = [];
            _replies[key].push({ id: r.id, text: r.text, sender: r.sender, timestamp: r.timestamp, is_owner: !!r.is_owner });
        });

        // Poll votes: count per post_id + option_idx
        _pollVotes = {};
        (pollVotesData || []).forEach(v => {
            const key = String(v.post_id);
            if (!_pollVotes[key]) _pollVotes[key] = {};
            const idx = String(v.option_idx);
            _pollVotes[key][idx] = (_pollVotes[key][idx] || 0) + 1;
        });

    } catch (err) {
        console.error('[db] dbInit failed:', err);
        // Show visible error so the user knows something is wrong
        const t = document.createElement('div');
        t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#c0392b;color:#fff;padding:10px 18px;border-radius:12px;font-size:0.85rem;z-index:9999';
        t.textContent = '⚠️ Could not connect to database. Some features may not work.';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 6000);
    }
}

// ── Synchronous getters (read from in-memory cache) ───────────
function getComments(artId)    { return _comments[String(artId)]   || []; }
function getReactions(artId)   { return _reactions[String(artId)]  || {}; }
function getWallReactions(pid) { return _wallRxns[String(pid)]     || {}; }
function getPublicPosts()      { return _publicPosts; }
function getPending()          { return _pending; }
function getSubmissions()      { return _inbox; }
function getArtOverrides()     { return _overrides; }
function getHiddenArtIds()     { return _hiddenIds; }
function getReplies(postId)    { return _replies[String(postId)]   || []; }
function getPollVotes(postId)  { return _pollVotes[String(postId)] || {}; }

// ── Internal: log DB errors without crashing ──────────────────
function _dbErr(op, error) {
    if (error) console.error(`[db] ${op}:`, error.message || error);
}

// ──────────────────────────────────────────────────────────────
// COMMENTS
// ──────────────────────────────────────────────────────────────

async function dbAddComment(artId, text, isOwner = false) {
    const id   = String(Date.now() + Math.floor(Math.random() * 1000));
    const date = new Date().toISOString();
    const key  = String(artId);

    // Update cache immediately
    if (!_comments[key]) _comments[key] = [];
    _comments[key].push({ id, text, date, is_owner: !!isOwner });

    // Persist to Supabase
    const { error } = await _db.from('comments').insert({ id, art_id: key, text, date, is_owner: !!isOwner });
    _dbErr('addComment', error);
    return { id, text, date, is_owner: !!isOwner };
}

async function dbDeleteComment(commentId) {
    // Remove from every art's comment array in cache
    for (const key in _comments) {
        _comments[key] = _comments[key].filter(c => c.id !== String(commentId));
    }
    const { error } = await _db.from('comments').delete().eq('id', String(commentId));
    _dbErr('deleteComment', error);
}

// ──────────────────────────────────────────────────────────────
// REACTIONS (gallery artworks)
// ──────────────────────────────────────────────────────────────

async function dbIncrementReaction(artId, emoji) {
    const key = String(artId);
    if (!_reactions[key]) _reactions[key] = {};
    _reactions[key][emoji] = (_reactions[key][emoji] || 0) + 1;
    const { error } = await _db.rpc('increment_reaction', { p_art_id: key, p_emoji: emoji });
    _dbErr('incrementReaction', error);
}

// ──────────────────────────────────────────────────────────────
// WALL REACTIONS
// ──────────────────────────────────────────────────────────────

async function dbIncrementWallReaction(postId, emoji) {
    const key = String(postId);
    if (!_wallRxns[key]) _wallRxns[key] = {};
    _wallRxns[key][emoji] = (_wallRxns[key][emoji] || 0) + 1;
    const { error } = await _db.rpc('increment_wall_reaction', { p_post_id: key, p_emoji: emoji });
    _dbErr('incrementWallReaction', error);
}

// ──────────────────────────────────────────────────────────────
// PUBLIC WALL POSTS
// ──────────────────────────────────────────────────────────────

// savePublicPosts: kept for code-compat but use dbAddPublicPost / dbDeletePublicPost for actual changes
function savePublicPosts(posts) { _publicPosts = posts; }

async function dbAddPublicPost(entry) {
    _publicPosts.push(entry);
    const { error } = await _db.from('wall_posts').insert({
        id: entry.id, type: entry.type, data: entry.data,
        sender: entry.sender, timestamp: entry.timestamp,
        requested_vis: entry.requestedVis || 'public',
    });
    _dbErr('addPublicPost', error);
}

async function dbDeletePublicPost(id) {
    _publicPosts = _publicPosts.filter(p => p.id !== id);
    const { error } = await _db.from('wall_posts').delete().eq('id', id);
    _dbErr('deletePublicPost', error);
}

// ──────────────────────────────────────────────────────────────
// PENDING SUBMISSIONS
// ──────────────────────────────────────────────────────────────

async function savePending(entry) {
    _pending.push(entry);
    const { error } = await _db.from('pending_submissions').insert({
        id: entry.id, type: entry.type, data: entry.data,
        sender: entry.sender, timestamp: entry.timestamp,
        requested_vis: entry.requestedVis || 'private',
    });
    if (error) {
        _pending = _pending.filter(p => p.id !== entry.id);
        _dbErr('savePending', error);
        throw error;
    }
}

async function removePending(id) {
    _pending = _pending.filter(p => p.id !== id);
    const { error } = await _db.from('pending_submissions').delete().eq('id', id);
    _dbErr('removePending', error);
}

// ──────────────────────────────────────────────────────────────
// PRIVATE INBOX
// ──────────────────────────────────────────────────────────────

async function dbAddPrivate(entry) {
    _inbox.push(entry);
    const { error } = await _db.from('private_inbox').insert({
        id: entry.id, type: entry.type, data: entry.data,
        sender: entry.sender, timestamp: entry.timestamp,
    });
    _dbErr('addPrivate', error);
}

async function dbDeletePrivate(id) {
    _inbox = _inbox.filter(p => p.id !== id);
    const { error } = await _db.from('private_inbox').delete().eq('id', id);
    _dbErr('deletePrivate', error);
}

// ──────────────────────────────────────────────────────────────
// EXTRA ARTWORKS (added via admin panel)
// ──────────────────────────────────────────────────────────────

async function dbAddExtraArtwork(art) {
    _extraArts.unshift(art);
    const { error } = await _db.from('extra_artworks').insert({
        id: String(art.id), title: art.title,
        description: art.description || '',
        image: art.image, images: art.images || null,
        tags: art.tags || [],
        nsfw: art.nsfw || false, date: art.date || '',
    });
    _dbErr('addExtraArtwork', error);
}

async function dbUpdateExtraArtwork(artId, changes) {
    const idx = _extraArts.findIndex(a => String(a.id) === String(artId));
    if (idx !== -1) _extraArts[idx] = { ..._extraArts[idx], ...changes };
    const { error } = await _db.from('extra_artworks').update({
        title: changes.title, description: changes.description,
        image: changes.image, images: changes.images || null,
        tags: changes.tags, nsfw: changes.nsfw,
    }).eq('id', String(artId));
    _dbErr('updateExtraArtwork', error);
}

async function dbDeleteExtraArtwork(artId) {
    _extraArts = _extraArts.filter(a => String(a.id) !== String(artId));
    const { error } = await _db.from('extra_artworks').delete().eq('id', String(artId));
    _dbErr('deleteExtraArtwork', error);
}

// ──────────────────────────────────────────────────────────────
// ART OVERRIDES (title/desc/image edits for data.js artworks)
// ──────────────────────────────────────────────────────────────

async function dbSaveArtOverride(artId, changes) {
    _overrides[String(artId)] = changes;
    const { error } = await _db.from('art_overrides').upsert({
        art_id: String(artId),
        title: changes.title, description: changes.description,
        image: changes.image, tags: changes.tags, nsfw: changes.nsfw,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'art_id' });
    _dbErr('saveArtOverride', error);
}

// ──────────────────────────────────────────────────────────────
// HIDDEN ART IDs (hide data.js artworks from gallery)
// ──────────────────────────────────────────────────────────────

async function dbHideArt(artId) {
    const key = String(artId);
    if (_hiddenIds.includes(key)) return; // already hidden
    _hiddenIds.push(key);
    const { error } = await _db.from('hidden_arts').insert({ art_id: key });
    _dbErr('hideArt', error);
}

async function dbUnhideArt(artId) {
    const key = String(artId);
    _hiddenIds = _hiddenIds.filter(id => id !== key);
    const { error } = await _db.from('hidden_arts').delete().eq('art_id', key);
    _dbErr('unhideArt', error);
}

// ──────────────────────────────────────────────────────────────
// WALL REPLIES
// ──────────────────────────────────────────────────────────────

async function dbAddReply(postId, text, sender, isOwner = false) {
    const id        = String(Date.now() + Math.floor(Math.random() * 1000));
    const timestamp = new Date().toISOString();
    const key       = String(postId);
    if (!_replies[key]) _replies[key] = [];
    _replies[key].push({ id, text, sender, timestamp, is_owner: !!isOwner });
    const { error } = await _db.from('wall_replies').insert({ id, post_id: key, text, sender, timestamp, is_owner: !!isOwner });
    _dbErr('addReply', error);
    return { id, text, sender, timestamp, is_owner: !!isOwner };
}

async function dbDeleteReply(replyId) {
    for (const key in _replies) {
        _replies[key] = _replies[key].filter(r => r.id !== replyId);
    }
    const { error } = await _db.from('wall_replies').delete().eq('id', replyId);
    _dbErr('deleteReply', error);
}

// ──────────────────────────────────────────────────────────────
// POLL VOTES
// ──────────────────────────────────────────────────────────────

function getVoterToken() {
    let t = localStorage.getItem('voter-token');
    if (!t) {
        t = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('voter-token', t);
    }
    return t;
}

function hasUserVoted(postId) {
    return localStorage.getItem('voted-' + postId) !== null;
}

function getUserVoteIdx(postId) {
    const v = localStorage.getItem('voted-' + postId);
    return v !== null ? parseInt(v) : -1;
}

async function dbVotePoll(postId, optionIdx) {
    if (hasUserVoted(postId)) return false; // already voted
    const key     = String(postId);
    const idx     = String(optionIdx);
    const token   = getVoterToken();
    if (!_pollVotes[key]) _pollVotes[key] = {};
    _pollVotes[key][idx] = (_pollVotes[key][idx] || 0) + 1;
    localStorage.setItem('voted-' + postId, String(optionIdx));
    const { error } = await _db.from('poll_votes').insert({ post_id: key, option_idx: optionIdx, voter_token: token });
    _dbErr('votePoll', error);
    return true;
}

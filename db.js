// ============================================================
// db.js — Supabase data layer for Bubbles' Gallery
// All shared data (comments, reactions, posts, etc.) lives here.
// localStorage is kept ONLY for per-user data: age gate + submit cooldown.
// ============================================================

const SUPABASE_URL  = 'https://hfflfrhfqxsjxofqhxev.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZmxmcmhmcXhzanhvZnFoeGV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDU1MTgsImV4cCI6MjA4OTgyMTUxOH0.nwHhBCgNap8B_vBZ0OgFJXFN6KhvMzEf7VMZxkWRbyo';

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
        ]);

        // Comments: group by art_id
        _comments = {};
        (comments || []).forEach(c => {
            const key = String(c.art_id);
            if (!_comments[key]) _comments[key] = [];
            _comments[key].push({ id: c.id, text: c.text, date: c.date });
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
            image: a.image, tags: a.tags || [], nsfw: a.nsfw || false, date: a.date,
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

    } catch (err) {
        console.error('[db] dbInit failed:', err);
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

// ── Internal: log DB errors without crashing ──────────────────
function _dbErr(op, error) {
    if (error) console.error(`[db] ${op}:`, error.message || error);
}

// ──────────────────────────────────────────────────────────────
// COMMENTS
// ──────────────────────────────────────────────────────────────

async function dbAddComment(artId, text) {
    const id   = String(Date.now() + Math.floor(Math.random() * 1000));
    const date = new Date().toISOString();
    const key  = String(artId);

    // Update cache immediately
    if (!_comments[key]) _comments[key] = [];
    _comments[key].push({ id, text, date });

    // Persist to Supabase
    const { error } = await _db.from('comments').insert({ id, art_id: key, text, date });
    _dbErr('addComment', error);
    return { id, text, date };
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
    const count = _reactions[key][emoji];

    const { error } = await _db.from('reactions')
        .upsert({ art_id: key, emoji, count }, { onConflict: 'art_id,emoji' });
    _dbErr('incrementReaction', error);
}

// ──────────────────────────────────────────────────────────────
// WALL REACTIONS
// ──────────────────────────────────────────────────────────────

async function dbIncrementWallReaction(postId, emoji) {
    const key = String(postId);
    if (!_wallRxns[key]) _wallRxns[key] = {};
    _wallRxns[key][emoji] = (_wallRxns[key][emoji] || 0) + 1;
    const count = _wallRxns[key][emoji];

    const { error } = await _db.from('wall_reactions')
        .upsert({ post_id: key, emoji, count }, { onConflict: 'post_id,emoji' });
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
    _dbErr('savePending', error);
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
        image: art.image, tags: art.tags || [],
        nsfw: art.nsfw || false, date: art.date || '',
    });
    _dbErr('addExtraArtwork', error);
}

async function dbUpdateExtraArtwork(artId, changes) {
    const idx = _extraArts.findIndex(a => String(a.id) === String(artId));
    if (idx !== -1) _extraArts[idx] = { ..._extraArts[idx], ...changes };
    const { error } = await _db.from('extra_artworks').update({
        title: changes.title, description: changes.description,
        image: changes.image, tags: changes.tags, nsfw: changes.nsfw,
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

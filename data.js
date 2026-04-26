// =============================================
// GALLERY CONFIG — edit this file to customize
// =============================================
const SITE_CONFIG = {
  title: "✦ My Gallery ✦", // Tab title
  logoText: "✦ BuBz's Social ✦", // Header logo
  aboutText:
    "Hi! Welcome to my art gallery. I post my art here — both SFW and NSFW. Feel free to look around and send me something!",
};

// =============================================
// BANNED WORDS — add words you want to block in comments
// Philosophy: block harassment & hate, NOT lewd enthusiasm.
// "omg this is so hot/nasty/filthy" = fine. Slurs & threats = blocked.
// The purgomalum API adds a second layer on top of this local list.
// =============================================
const BANNED_WORDS = [

  // ── Threats / self-harm encouragement ─────────────────
  "kill yourself", "kys", "go die", "end yourself", "rope yourself",
  "i will find you", "i know where you live",

  // ── Direct art/artist attacks ──────────────────────────
  // NOTE: "disgusting/horrible/ugly" intentionally excluded —
  // lewd users use them as compliments. Purgomalum handles context.
  "your art is trash", "you can't draw", "quit drawing",
  "delete this", "this is garbage", "garbage art", "worthless art",

  // ── Spam / self-promo ──────────────────────────────────
  "follow me", "follow my", "check out my", "visit my",
  "click here", "click the link", "link in bio",
  "subscribe to", "onlyfans.com", "discord.gg", "t.me/",
  "free robux", "free vbucks", "bit.ly", "tinyurl.com",

  // ── Slurs (racial / sexuality / gender) ───────────────
  // Listed for moderation purposes — these are never acceptable
  "nigger", "nigga", "faggot", "fag", "tranny", "retard",
  "spic", "chink", "gook", "kike",
  // Note: "dyke" and "cunt" removed — lewd/LGBTQ+ audiences use these
  // non-maliciously. Re-add if you see them used as targeted attacks.

  // ── Targeted harassment ────────────────────────────────
  "nobody likes you", "everyone hates you", "you should stop",
  "you're pathetic", "youre pathetic", "get off the internet",

  // Add your own below:
];

// =============================================
// BANNED REACTION EMOJIS — emojis blocked from reactions
// Add or remove any emoji you don't want visitors to use
// =============================================
const BANNED_REACTION_EMOJIS = [
  "🗑️", "🗑",   // trash/garbage — insulting to art
  "💩",          // poop
  "🤮", "🤢",   // vomit/nausea — negative
  "👎",          // thumbs down
  "🖕",          // middle finger
  "🤡",          // clown — often used to mock
  "🐍",          // snake — used to call someone two-faced
  "🤬", "😡",   // angry/rage
  "🙄", "😒",   // eye roll / unamused — dismissive
  // Note: 💀 ☠️ 🩸 are allowed (Spooky Month / art context)
  // Add your own: "😤", "🤑", ...
];

// =============================================
// ARTWORKS — add your art here!
// Format: { id, title, description, date (YYYY-MM-DD), tags: [], nsfw: bool, image: "url" }
// =============================================
const artworks = [
  {
    id: 1,
    title: "Placeholder Art 1",
    description:
      "Replace this with your own artwork! Edit data.js to add pieces.",
    date: "2025-01-15",
    tags: ["digital", "character"],
    nsfw: false,
    image: "https://picsum.photos/seed/art1/400/520",
  },
  {
    id: 2,
    title: "Placeholder Art 2",
    description: "Another example. You can have as many pieces as you want!",
    date: "2025-02-20",
    tags: ["traditional", "sketch"],
    nsfw: false,
    image: "https://picsum.photos/seed/art2/400/600",
  },
  {
    id: 3,
    title: "NSFW Example",
    description: "This is an NSFW-tagged piece — hidden when SFW filter is on.",
    date: "2025-03-10",
    tags: ["digital", "mature"],
    nsfw: true,
    image: "https://picsum.photos/seed/art3/400/480",
  },
];

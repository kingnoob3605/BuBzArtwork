// =============================================
// GALLERY CONFIG — edit this file to customize
// =============================================
const SITE_CONFIG = {
  title: "✦ My Gallery ✦", // Tab title
  logoText: "✦ Gallery ✦", // Header logo
  aboutText:
    "Hi! Welcome to my art gallery. I post my art here — both SFW and NSFW. Feel free to look around and send me something!",
  adminPassword: "123", // Change this!
};

// =============================================
// BANNED WORDS — add words you want to block in comments
// All checks are case-insensitive
// =============================================
const BANNED_WORDS = [
  // — Spam / self-promo
  "spam", "follow me", "check out my", "click here", "subscribe", "onlyfans.com", "discord.gg",

  // — General insults / hate
  "trash", "garbage", "terrible", "disgusting", "horrible", "worthless", "ugly", "kill yourself", "kys",

  // — Slurs (abbreviated placeholders — add full words as needed)
  "slur",

  // — NSFW / harassment
  "shut up", "idiot", "moron", "stupid", "dumb",

  // Add your own: "word1", "word2", ...
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

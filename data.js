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
  "spam",
  "hate",
  "slur",
  // Add your own: "word1", "word2", ...
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

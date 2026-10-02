// A basic filter for listings and messages, alongside Report and Block.
// Apple requires apps with posts from users to filter objectionable content.
// Add words to BLOCKED_WORDS as you see problems in reports.

const BLOCKED_WORDS = [
  "fuck", "fucking", "motherfucker", "shit", "bitch", "cunt", "asshole", "dickhead", "whore", "slut",
];

// The marketplace rules don't allow these, so they're stopped before posting.
const PROHIBITED_ITEMS = [
  "firearm", "firearms", "handgun", "pistol", "rifle", "shotgun", "ammo", "ammunition",
  "suppressor", "silencer", "switchblade", "brass knuckles", "drugs", "weed", "vape",
];

// Common scam patterns. These don't block anything; the chat shows a safety reminder.
const SCAM_HINTS = [
  "gift card", "wire transfer", "western union", "moneygram", "crypto", "bitcoin",
  "pay first", "send deposit", "shipping agent", "verification code", "zelle first", "cash app first",
];

function containsWord(text: string, words: string[]): string | null {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ")} `;
  for (const w of words) {
    if (lower.includes(` ${w} `) || lower.includes(` ${w}s `)) return w;
  }
  return null;
}

// Returns a message to show the person, or null if the text is fine.
export function checkListingText(...parts: string[]): string | null {
  const text = parts.join(" ");
  if (containsWord(text, BLOCKED_WORDS)) return "Please keep listings free of profanity.";
  const item = containsWord(text, PROHIBITED_ITEMS);
  if (item) return `Listings for "${item}" aren't allowed. The marketplace is for archery gear only.`;
  return null;
}

export function checkMessageText(text: string): string | null {
  if (containsWord(text, BLOCKED_WORDS)) return "Please keep messages respectful. Try rewording that.";
  return null;
}

export function looksLikeScam(text: string): boolean {
  const lower = text.toLowerCase();
  return SCAM_HINTS.some((h) => lower.includes(h));
}

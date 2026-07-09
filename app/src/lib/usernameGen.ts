const ADJECTIVES = [
  'quiet', 'swift', 'amber', 'coral', 'lunar', 'ember', 'violet', 'cobalt',
  'maple', 'cedar', 'misty', 'solar', 'arctic', 'velvet', 'indigo', 'copper',
  'azure', 'dusky', 'plume', 'ivory',
];

const NOUNS = [
  'falcon', 'harbor', 'ridge', 'willow', 'otter', 'comet', 'meadow', 'birch',
  'heron', 'summit', 'pebble', 'lynx', 'delta', 'marsh', 'quill', 'thistle',
  'wren', 'cove', 'fern', 'grove',
];

/**
 * Fallback username for accounts finalized without a chosen one (e.g. a
 * cold-start resume of email verification, where the in-memory signup
 * wizard state didn't survive). Deliberately avoids deriving anything from
 * the user's real email address — that both looks broken (raw local-parts
 * like "husenbashasompur294" read as garbage) and leaks personal info into
 * a public, discoverable field.
 */
export function generateFriendlyUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${adj}${noun}${suffix}`;
}

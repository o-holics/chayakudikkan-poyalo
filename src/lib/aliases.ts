// Table-mates never see each other's real name — each gets a calm alias for
// that one meetup.
const ALIASES = [
  "Cardamom", "Ginger", "Clove", "Jasmine", "Mint", "Tulsi", "Cinnamon", "Nutmeg",
  "Saffron", "Lemongrass", "Kettle", "Saucer", "Tumbler", "Lantern", "Ember", "Kindling",
  "Moth", "Sparrow", "Cricket", "Firefly", "Dusk", "Drizzle", "Mist", "Monsoon",
  "Petrichor", "Verandah", "Bench", "Almanac", "Marble", "Slate", "Pigeon", "Heron",
  "Neem", "Tamarind", "Jackfruit", "Palmyra", "Areca", "Betel", "Filter", "Steam",
];

/** A distinct alias per uid for one table. */
export function assignAliases(uids: string[]): Record<string, string> {
  const pool = [...ALIASES];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: Record<string, string> = {};
  uids.forEach((uid, i) => {
    out[uid] = pool[i] ?? `Guest ${i + 1}`;
  });
  return out;
}

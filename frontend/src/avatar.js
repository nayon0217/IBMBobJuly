// avatar.js — the backend doesn't ship avatar colors or initials, so we derive
// them client-side. Both are deterministic from the character id so a given
// character always looks the same across the results, setup, and scene views.

const PALETTE = [
  "#2f8f7c", // teal
  "#9c3f6d", // magenta
  "#c47f2e", // amber
  "#4f5bd5", // indigo
  "#c0453b", // brick
  "#3d8bcd", // blue
  "#6a4bb0", // violet
  "#2f8f4f", // green
  "#b0603a", // sienna
  "#4a6b8a", // slate
];

export function initials(name = "") {
  const parts = name
    .replace(/[.,]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function colorFor(key = "") {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

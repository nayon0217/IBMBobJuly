// theme.js — shared design tokens (JS mirror of the CSS custom properties in
// theme.css, "The Reading Room" system). Prefer the CSS classes/vars in
// theme.css for styling; these JS values exist for the few places that compute
// styles in JavaScript. A warm paper canvas, oxblood + gilt accents, a serif
// display voice, and a deep espresso "atrium" for the staged surfaces.

export const T = {
  // surfaces
  bg: "#f3efe4", // warm paper canvas
  surface: "#fbf8f0",
  surfaceAlt: "#f6f2e7",
  navy: "#241b13", // espresso panels (kept key name for compatibility)
  navyInk: "#efe7d6",
  navyMuted: "#8a7c64",
  navyRow: "#2f2417",

  // text
  ink: "#241f17",
  inkSoft: "#5a5142",
  inkMuted: "#8f8672",

  // borders
  border: "#d8d0bd",
  borderStrong: "#c8bfa8",

  // accent (oxblood / terracotta / gilt)
  accent: "#7a2e2b",
  accentSoft: "#c06a3f",
  accentDisabled: "#cbb9a6",
  accentBg: "#f1e7dd",
  gild: "#b6893f",

  // status
  danger: "#a83228",
  dangerBg: "#f6e7e2",
  dangerBorder: "#e6c9c1",
  success: "#2f7d5b",

  // shape
  radius: 8,
  radiusLg: 12,
  radiusPill: 999,

  font: 'ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif',
  serif: '"Hoefler Text", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',

  // the espresso atrium gradient, reused for accents/hero moments
  stageGradient: "linear-gradient(180deg, #2a2018 0%, #1c140c 55%, #12100b 100%)",
};

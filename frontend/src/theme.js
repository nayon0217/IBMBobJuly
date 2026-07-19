// theme.js — shared design tokens. Everything is tuned to match the scene
// page: a warm off-white canvas, a purple accent, warm-grey borders, rounded
// controls, and a dark navy sidebar. Import { T } and reference these instead
// of hard-coding hexes so the whole app stays visually consistent.

export const T = {
  // surfaces
  bg: "#f4f2ec", // warm off-white canvas
  surface: "#ffffff",
  surfaceAlt: "#faf9f4",
  navy: "#161320", // dark sidebar / inverted panels
  navyInk: "#e7e4ef",
  navyMuted: "#8b869c",
  navyRow: "#211d30",

  // text
  ink: "#1f2328",
  inkSoft: "#57606a",
  inkMuted: "#8c959f",

  // borders
  border: "#e3e1d7",
  borderStrong: "#d6d3c7",

  // accent (purple)
  accent: "#6a4bff",
  accentSoft: "#7c5cff",
  accentDisabled: "#c9c4e8",
  accentBg: "#efecfe",

  // status
  danger: "#cf222e",
  dangerBg: "#fdf1f1",
  dangerBorder: "#f3d0d2",
  success: "#2f8f7c",

  // shape
  radius: 10,
  radiusLg: 14,
  radiusPill: 999,

  font: '-apple-system, "Segoe UI", system-ui, sans-serif',

  // the scene stage gradient, reused for accents/hero moments
  stageGradient: "linear-gradient(180deg, #3b2f5e 0%, #6a4a6b 55%, #a97e86 100%)",
};

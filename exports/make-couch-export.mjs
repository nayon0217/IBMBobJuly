// Extracts the hero couch (TheatreCouch.jsx) from a rendered page into a
// standalone SVG. The live component leans on theme.css for the spine
// typography (var(--serif)/var(--sans) and the .tc-* rules), none of which
// travels with the markup, so those rules are resolved and inlined here.
//
// Usage: node make-couch-export.mjs dom.html green-room-couch.svg
//   where dom.html is `chrome --headless --dump-dom http://localhost:5173/`.

import { readFileSync, writeFileSync } from "node:fs";

const [src, out] = process.argv.slice(2);

const html = readFileSync(src, "utf8");
const start = html.indexOf('<svg class="tc');
if (start === -1) throw new Error("no couch svg found in " + src);
const end = html.indexOf("</svg>", start);
if (end === -1) throw new Error("unterminated svg");

const raw = html.slice(start, end + "</svg>".length);

const W = 560;
const H = 495;

const SERIF =
  '"Hoefler Text","Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif';
const SANS = 'ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif';

const STYLE = `<style>
    .tc-book-title { font-family: ${SERIF}; letter-spacing: .01em; }
    .tc-book-no    { font-family: ${SANS}; font-size: 6.5px; letter-spacing: .12em; }
    .tc-fo-label   { font-family: ${SANS}; font-size: 5.4px; letter-spacing: .18em; fill: rgba(233,226,208,.62); }
    .tc-fo-title   { font-family: ${SERIF}; font-size: 16px; fill: #efe7d6; }
    .tc-fo-sub     { font-family: ${SANS}; font-size: 5px; letter-spacing: .12em; fill: rgba(233,226,208,.5); }
  </style>`;

const openEnd = raw.indexOf(">");
const body = raw.slice(openEnd + 1);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="An emerald velvet couch on a small stage, with book spines standing on the seat">
  ${STYLE}${body}
`;

writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);

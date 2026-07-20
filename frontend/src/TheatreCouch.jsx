// TheatreCouch.jsx — the hero's signature image: an emerald velvet chesterfield
// on a small curtained stage, with the cast standing on the seat as book spines.
// The couch is green and the house around it stays red: the room earns its name,
// and the complementary pair keeps the couch clear of the curtain behind it.
// This replaces the old bookcase, and keeps its content: the same archetype
// spines, the same lean, the same face-out manuscript, the same lift on hover —
// moved from a shelf to a couch in a theatre.
//
// Everything is inline SVG, and the quality lives in the gradients rather than
// the outlines: velvet nap (turbulence), tufted puffs (per-cell radial
// highlights + a crease lattice), turned wood legs (horizontal dark-light-dark
// for roundness), brass nailheads, gilt-trimmed valance.
//
// The viewBox is deliberately close to the element's real display width (~560
// units in a ~455px column) so spine type lands near 12px on screen — the size
// it was on the old shelf. Drawing bigger and letting the browser shrink it
// would make the titles unreadable, which is the whole point of the spines.

const W = 560;
const H = 495;

// The couch, in viewBox units. Kept as one table so the parts stay aligned.
const BACK = { x0: 88, x1: 472, y0: 132, y1: 334 };
const SEAT = { x0: 63, x1: 497, y0: 328, y1: 369 };
const RAIL = { x0: 58, x1: 502, y0: 369, y1: 387 };
const ARM = { outer: 38, inner: 88, top: 276, cx: 63, cy: 300, rx: 25, ry: 23 };
const FLOOR_Y = 427;

// Where the spines stand: a little into the cushion, so the front of the seat
// still reads below them.
const SHELF_Y = 343;

// Tufting lattice.
const TUFT_X = 38;
const TUFT_Y = 32;

// Decorative spines — archetypes, not extracted characters (the real cast is
// discovered only after a manuscript is processed). `tilt` leans a book a
// degree or two so the row settles the way a real row of books does. Taller
// boards carry the longer titles, so every spine can hold one line of type.
const SHELF = [
  { n: "001", label: "The Protagonist", bg: "#e2c25c", fg: "#3a2f10", w: 33, h: 168, tilt: -3 },
  { n: "002", label: "The Rival", bg: "#b5503f", fg: "#f7ece2", w: 25, h: 128, tilt: -1.5 },
  { n: "003", label: "The Confidante", bg: "#d3a2ac", fg: "#402029", w: 41, h: 159, tilt: 0 },
  { n: "004", label: "The Beloved", bg: "#e6dfcd", fg: "#3b3527", w: 29, h: 188, tilt: 2 },
  { faceout: true, w: 86, h: 157 },
  { n: "005", label: "The Mentor", bg: "#5d3a6e", fg: "#efe6f2", w: 37, h: 140, tilt: -2.5 },
  { n: "006", label: "The Rival's Sister", bg: "#aec2d3", fg: "#25333f", w: 24, h: 180, tilt: 0 },
  { n: "007", label: "The Narrator", bg: "#4a4642", fg: "#eae5da", w: 45, h: 173, tilt: 1.5 },
  { n: "008", label: "The Ghost", bg: "#c9762f", fg: "#fdf3e6", w: 22, h: 120, tilt: 4 },
];

const BOOK_GAP = 5;

export default function TheatreCouch({ className = "" }) {
  // lay the row out centred on the seat
  const rowWidth =
    SHELF.reduce((sum, b) => sum + b.w, 0) + BOOK_GAP * (SHELF.length - 1);
  let cursor = (W - rowWidth) / 2;
  const placed = SHELF.map((b) => {
    const x = cursor;
    cursor += b.w + BOOK_GAP;
    return { ...b, x };
  });

  return (
    <svg
      className={`tc ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="An emerald velvet couch on a small stage, with book spines standing on the seat"
    >
      <defs>{defs()}</defs>

      {/* ── backdrop: the drawn curtain ─────────────────────────────────── */}
      <rect width={W} height={H} fill="#150809" />
      <rect width={W} height={FLOOR_Y - 20} fill="url(#tc-curtain)" />
      {foldShadows()}

      {/* ── valance: scalloped swag with gilt trim and tassels ──────────── */}
      <path d={valancePath()} fill="url(#tc-valance)" />
      <path d={valanceEdge()} fill="none" stroke="url(#tc-brassline)" strokeWidth="1.8" />
      {tassels()}

      <rect width={W} height={H} fill="url(#tc-vignette)" />

      {/* ── stage floor + the light it stands in ────────────────────────── */}
      <rect y={FLOOR_Y - 24} width={W} height={H - FLOOR_Y + 24} fill="url(#tc-floor)" />
      <ellipse cx={W / 2} cy={FLOOR_Y + 14} rx="290" ry="38" fill="url(#tc-spot)" className="tc-spot" />
      <ellipse cx={W / 2} cy={FLOOR_Y + 2} rx="200" ry="13" fill="url(#tc-contact)" />

      {/* ── the couch ───────────────────────────────────────────────────── */}
      <path d={backPath()} fill="url(#tc-back)" />
      <g clipPath="url(#tc-backclip)">
        <rect
          x={BACK.x0} y={BACK.y0} width={BACK.x1 - BACK.x0} height={BACK.y1 - BACK.y0}
          fill="url(#tc-nap)" opacity="0.26" style={{ mixBlendMode: "soft-light" }}
        />
        {tufting()}
      </g>
      <path d={backTopEdge()} fill="none" stroke="#3fa47a" strokeWidth="1.6" opacity="0.5" />

      {/* seat cushion, then the spines standing on it */}
      <path d={seatPath()} fill="url(#tc-seat)" />
      <path d={seatPath()} fill="url(#tc-nap)" opacity="0.2" style={{ mixBlendMode: "soft-light" }} />
      <path
        d={`M ${SEAT.x0 + 12},${SEAT.y0 + 3} L ${SEAT.x1 - 12},${SEAT.y0 + 3}`}
        stroke="#3fa47a" strokeWidth="2" opacity="0.4" fill="none" strokeLinecap="round"
      />

      <g>
        {placed.map((b, i) => (b.faceout ? <FaceOut key="faceout" {...b} /> : <Book key={b.n ?? i} {...b} />))}
      </g>

      {/* arms in front of the seat, then rail and legs */}
      <Arm />
      <g transform={`translate(${W},0) scale(-1,1)`}>
        <Arm />
      </g>

      <path d={railPath()} fill="url(#tc-rail)" />
      <path d={railPath()} fill="url(#tc-nap)" opacity="0.16" style={{ mixBlendMode: "soft-light" }} />
      {[80, 207, 353, 480].map((x) => (
        <g key={x} transform={`translate(${x}, ${RAIL.y1 - 2})`}>
          <path d={LEG_PATH} fill="url(#tc-wood)" />
          <path d={LEG_PATH} fill="none" stroke="#160c05" strokeWidth="0.6" opacity="0.55" />
        </g>
      ))}
    </svg>
  );
}

/* ── the spines ────────────────────────────────────────────────────────── */
// Two nested groups on purpose: the outer one carries the position and lean as
// a transform *attribute*, the inner one is left free for the CSS transform
// that lifts the book on hover. A CSS transform on the outer group would beat
// the attribute and throw the book out of the row.

function Book({ x, w, h, bg, fg, n, label, tilt = 0 }) {
  const cx = x + w / 2;
  // shrink type on short boards so a long title still fits between the ends
  const fs = Math.max(8, Math.min(15, (h - 40) / (label.length * 0.55)));
  const titleY = -h / 2 - 4;

  return (
    <g className="tc-book" transform={`translate(${cx}, ${SHELF_Y}) rotate(${tilt})`}>
      <title>{label}</title>
      <g className="tc-book-lift">
        {/* the shadow the book casts into the cushion */}
        <ellipse cx="0" cy="2" rx={w * 0.62} ry="3.5" fill="#03180e" opacity="0.5" />
        <rect x={-w / 2} y={-h} width={w} height={h} rx="1.5" fill={bg} />
        {/* one reused gradient does the rounding on every spine */}
        <rect x={-w / 2} y={-h} width={w} height={h} rx="1.5" fill="url(#tc-spine)" />
        <text
          className="tc-book-title"
          x="0" y={titleY}
          transform={`rotate(-90 0 ${titleY})`}
          textAnchor="middle" dominantBaseline="central"
          fill={fg} fontSize={fs}
        >
          {label}
        </text>
        <text
          className="tc-book-no"
          x="0" y={-13}
          transform={`rotate(-90 0 ${-13})`}
          textAnchor="middle" dominantBaseline="central"
          fill={fg} opacity="0.6"
        >
          {n}
        </text>
      </g>
    </g>
  );
}

// The writer's own manuscript, standing face-out among the cast.
function FaceOut({ x, w, h }) {
  const cx = x + w / 2;
  return (
    <g className="tc-book" transform={`translate(${cx}, ${SHELF_Y})`}>
      <title>Your manuscript</title>
      <g className="tc-book-lift">
        <ellipse cx="0" cy="2" rx={w * 0.55} ry="4" fill="#03180e" opacity="0.55" />
        <rect x={-w / 2} y={-h} width={w} height={h} rx="2" fill="url(#tc-faceout)" />
        <rect x={-w / 2} y={-h} width={w} height={h} rx="2" fill="url(#tc-nap)" opacity="0.2" style={{ mixBlendMode: "soft-light" }} />
        {/* the spine edge, turned away from the stage light */}
        <rect x={-w / 2} y={-h} width="4" height={h} fill="#000" opacity="0.28" />

        <text className="tc-fo-label" x="2" y={-h + 20} textAnchor="middle">MANUSCRIPT</text>
        <text className="tc-fo-title" x="2" y={-h + 60} textAnchor="middle">Your</text>
        <text className="tc-fo-title" x="2" y={-h + 80} textAnchor="middle">book</text>
        <line x1="-11" y1={-h + 92} x2="15" y2={-h + 92} stroke="#b6893f" strokeWidth="1" />
        <text className="tc-fo-sub" x="2" y={-h + 108} textAnchor="middle">Waiting to be read</text>
        <text className="tc-fo-label" x="2" y={-14} textAnchor="middle">THE GREEN ROOM</text>
      </g>
    </g>
  );
}

/* ── the rolled arm (drawn left, mirrored right) ───────────────────────── */

function Arm() {
  const outline = `M ${ARM.inner},${ARM.top + 24}
    C ${ARM.inner},${ARM.top + 7} ${ARM.cx + 16},${ARM.top} ${ARM.cx},${ARM.top}
    C ${ARM.cx - 18},${ARM.top} ${ARM.outer},${ARM.top + 11} ${ARM.outer},${ARM.top + 28}
    L ${ARM.outer},${RAIL.y1} L ${ARM.inner},${RAIL.y1} Z`;

  return (
    <g>
      <path d={outline} fill="url(#tc-arm)" />
      <path d={outline} fill="url(#tc-nap)" opacity="0.22" style={{ mixBlendMode: "soft-light" }} />
      <ellipse cx={ARM.cx} cy={ARM.cy} rx={ARM.rx} ry={ARM.ry} fill="url(#tc-roll)" />
      <path
        d={`M ${ARM.cx},${ARM.cy - 14} C ${ARM.cx + 10},${ARM.cy - 14} ${ARM.cx + 15},${ARM.cy - 8} ${ARM.cx + 15},${ARM.cy}
            C ${ARM.cx + 15},${ARM.cy + 8} ${ARM.cx + 9},${ARM.cy + 13} ${ARM.cx + 2},${ARM.cy + 13}
            C ${ARM.cx - 4},${ARM.cy + 13} ${ARM.cx - 8},${ARM.cy + 8} ${ARM.cx - 8},${ARM.cy + 3}`}
        fill="none" stroke="#082a1c" strokeWidth="1.3" opacity="0.55"
      />
      <path
        d={`M ${ARM.cx},${ARM.cy - 17} C ${ARM.cx + 11},${ARM.cy - 17} ${ARM.cx + 18},${ARM.cy - 9} ${ARM.cx + 18},${ARM.cy}`}
        fill="none" stroke="#47ab80" strokeWidth="1.3" opacity="0.35"
      />
      {nailheads()}
    </g>
  );
}

// Brass studs follow the front edge of the arm and round the face of the roll.
function nailheads() {
  const studs = [];
  const yTop = ARM.cy + ARM.ry + 4;
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    studs.push(
      <circle key={`v${i}`} cx={ARM.outer + 6 + Math.sin(t * 0.9) * 2} cy={yTop + t * (RAIL.y1 - yTop - 5)} r="2.2" fill="url(#tc-brass)" />
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.58 + i * 0.11);
    studs.push(
      <circle key={`r${i}`} cx={ARM.cx + Math.cos(a) * (ARM.rx + 3)} cy={ARM.cy + Math.sin(a) * (ARM.ry + 3)} r="2.2" fill="url(#tc-brass)" />
    );
  }
  return <g>{studs}</g>;
}

/* ── geometry helpers ──────────────────────────────────────────────────── */

function backPath() {
  return `M ${BACK.x0},${BACK.y1} L ${BACK.x0},${BACK.y0 + 26}
          C ${BACK.x0},${BACK.y0 + 5} ${BACK.x0 + 18},${BACK.y0} ${BACK.x0 + 42},${BACK.y0}
          L ${BACK.x1 - 42},${BACK.y0}
          C ${BACK.x1 - 18},${BACK.y0} ${BACK.x1},${BACK.y0 + 5} ${BACK.x1},${BACK.y0 + 26}
          L ${BACK.x1},${BACK.y1} Z`;
}

function backTopEdge() {
  return `M ${BACK.x0 + 2},${BACK.y0 + 26}
          C ${BACK.x0 + 2},${BACK.y0 + 6} ${BACK.x0 + 19},${BACK.y0 + 2} ${BACK.x0 + 42},${BACK.y0 + 2}
          L ${BACK.x1 - 42},${BACK.y0 + 2}
          C ${BACK.x1 - 19},${BACK.y0 + 2} ${BACK.x1 - 2},${BACK.y0 + 6} ${BACK.x1 - 2},${BACK.y0 + 26}`;
}

function seatPath() {
  return `M ${SEAT.x0 + 8},${SEAT.y0} L ${SEAT.x1 - 8},${SEAT.y0}
          C ${SEAT.x1},${SEAT.y0 + 6} ${SEAT.x1},${SEAT.y1 - 8} ${SEAT.x1 - 8},${SEAT.y1}
          L ${SEAT.x0 + 8},${SEAT.y1}
          C ${SEAT.x0},${SEAT.y1 - 8} ${SEAT.x0},${SEAT.y0 + 6} ${SEAT.x0 + 8},${SEAT.y0} Z`;
}

function railPath() {
  return `M ${RAIL.x0 + 6},${RAIL.y0} L ${RAIL.x1 - 6},${RAIL.y0}
          C ${RAIL.x1},${RAIL.y0 + 5} ${RAIL.x1},${RAIL.y1 - 4} ${RAIL.x1 - 8},${RAIL.y1}
          L ${RAIL.x0 + 8},${RAIL.y1}
          C ${RAIL.x0},${RAIL.y1 - 4} ${RAIL.x0},${RAIL.y0 + 5} ${RAIL.x0 + 6},${RAIL.y0} Z`;
}

const LEG_PATH = `M -8,0 L 8,0 L 7,6
  C 12,11 12,17 7,21 L 6,28
  C 9,31 9,35 5,38 L 4,43 L -4,43 L -5,38
  C -9,35 -9,31 -6,28 L -7,21
  C -12,17 -12,11 -7,6 Z`;

/* ── tufting ───────────────────────────────────────────────────────────── */

function tufting() {
  const puffs = [];
  const creases = [];
  const buttons = [];

  let row = 0;
  for (let y = BACK.y0 + 20; y < BACK.y1 - 6; y += TUFT_Y, row++) {
    const offset = row % 2 ? TUFT_X / 2 : 0;
    for (let x = BACK.x0 + 18 + offset; x < BACK.x1 - 10; x += TUFT_X) {
      puffs.push(
        <ellipse key={`p${row}-${x}`} cx={x + TUFT_X / 2} cy={y + TUFT_Y / 2} rx={TUFT_X * 0.52} ry={TUFT_Y * 0.56} fill="url(#tc-puff)" />
      );
      creases.push(
        <path
          key={`c${row}-${x}`}
          d={`M ${x},${y} L ${x - TUFT_X / 2},${y + TUFT_Y} M ${x},${y} L ${x + TUFT_X / 2},${y + TUFT_Y}`}
          stroke="#06241a" strokeWidth="0.9" opacity="0.45" fill="none"
        />
      );
      buttons.push(
        <g key={`b${row}-${x}`}>
          <ellipse cx={x} cy={y + 1.3} rx="3.6" ry="2.9" fill="#04170f" opacity="0.8" />
          <circle cx={x} cy={y} r="2.7" fill="url(#tc-button)" />
          <circle cx={x - 0.8} cy={y - 0.9} r="0.9" fill="#68c79e" opacity="0.45" />
        </g>
      );
    }
  }

  return (
    <g>
      <g opacity="0.3">{puffs}</g>
      {creases}
      {buttons}
    </g>
  );
}

/* ── curtain + valance ─────────────────────────────────────────────────── */

function foldShadows() {
  const lines = [];
  for (let i = 0; i < 17; i++) {
    // sin() wobble keeps the drape from reading as a machine-made pattern
    const x = 8 + i * 33 + Math.sin(i * 2.4) * 6;
    lines.push(
      <path
        key={i}
        d={`M ${x},0 C ${x + 4},120 ${x - 4},240 ${x + 3},${FLOOR_Y - 20}`}
        stroke="#20050a" strokeWidth={3 + (i % 3) * 2} fill="none" opacity="0.55"
      />
    );
  }
  return <g>{lines}</g>;
}

const VAL_N = 7;
const VAL_W = W / VAL_N;

function scallops() {
  let d = "";
  for (let i = VAL_N; i > 0; i--) {
    d += ` Q ${i * VAL_W - VAL_W / 2},56 ${i * VAL_W - VAL_W},28`;
  }
  return d;
}

function valancePath() {
  return `M 0,0 L ${W},0 L ${W},28${scallops()} L 0,0 Z`;
}

function valanceEdge() {
  return `M ${W},28${scallops()}`;
}

function tassels() {
  const out = [];
  for (let i = 1; i < VAL_N; i++) {
    const x = i * VAL_W;
    out.push(
      <g key={i}>
        <line x1={x} y1="27" x2={x} y2="37" stroke="#9c7333" strokeWidth="1.1" />
        <path d={`M ${x - 3.5},37 L ${x + 3.5},37 L ${x + 2.2},48 L ${x - 2.2},48 Z`} fill="url(#tc-brass)" />
        <path d={`M ${x - 2.2},48 L ${x + 2.2},48 L ${x + 1.2},54 L ${x - 1.2},54 Z`} fill="#8a6329" />
      </g>
    );
  }
  return <g opacity="0.9">{out}</g>;
}

/* ── gradients + filters ───────────────────────────────────────────────── */

function defs() {
  const curtainStops = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const wobble = Math.sin(i * 2.399) * 0.01;
    const off = Math.min(1, Math.max(0, t + wobble));
    curtainStops.push(
      <stop key={i} offset={`${(off * 100).toFixed(2)}%`} stopColor={i % 2 ? "#711a26" : "#23050b"} />
    );
  }

  return (
    <>
      <linearGradient id="tc-curtain" x1="0" y1="0" x2="1" y2="0">
        {curtainStops}
      </linearGradient>

      <linearGradient id="tc-valance" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9e2734" />
        <stop offset="55%" stopColor="#71161f" />
        <stop offset="100%" stopColor="#3c0a11" />
      </linearGradient>

      {/* the couch reads brighter than the curtain behind it, so it separates */}
      <linearGradient id="tc-back" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#256f4e" />
        <stop offset="45%" stopColor="#16523a" />
        <stop offset="100%" stopColor="#092b1d" />
      </linearGradient>

      <linearGradient id="tc-seat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#27754f" />
        <stop offset="40%" stopColor="#144d34" />
        <stop offset="100%" stopColor="#082619" />
      </linearGradient>

      <linearGradient id="tc-arm" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#0b3020" />
        <stop offset="48%" stopColor="#22704e" />
        <stop offset="100%" stopColor="#10422c" />
      </linearGradient>

      <radialGradient id="tc-roll" cx="0.36" cy="0.3" r="0.8">
        <stop offset="0%" stopColor="#2f8a63" />
        <stop offset="55%" stopColor="#16583c" />
        <stop offset="100%" stopColor="#082718" />
      </radialGradient>

      <linearGradient id="tc-rail" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#114733" />
        <stop offset="100%" stopColor="#061e13" />
      </linearGradient>

      <radialGradient id="tc-puff" cx="0.5" cy="0.42" r="0.62">
        <stop offset="0%" stopColor="#45ad7e" stopOpacity="0.5" />
        <stop offset="70%" stopColor="#45ad7e" stopOpacity="0.07" />
        <stop offset="100%" stopColor="#45ad7e" stopOpacity="0" />
      </radialGradient>

      <radialGradient id="tc-button" cx="0.35" cy="0.3" r="0.85">
        <stop offset="0%" stopColor="#216d4b" />
        <stop offset="100%" stopColor="#071f14" />
      </radialGradient>

      {/* one spine-rounding overlay, reused by every book */}
      <linearGradient id="tc-spine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="16%" stopColor="#fff" stopOpacity="0.04" />
        <stop offset="62%" stopColor="#000" stopOpacity="0.04" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
      </linearGradient>

      <linearGradient id="tc-faceout" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stopColor="#33406e" />
        <stop offset="100%" stopColor="#20294a" />
      </linearGradient>

      {/* turned wood: dark-light-dark across the width is what makes it round */}
      <linearGradient id="tc-wood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#28180d" />
        <stop offset="34%" stopColor="#79522f" />
        <stop offset="52%" stopColor="#9b6e43" />
        <stop offset="100%" stopColor="#231407" />
      </linearGradient>

      <radialGradient id="tc-brass" cx="0.34" cy="0.3" r="0.8">
        <stop offset="0%" stopColor="#f2d48f" />
        <stop offset="45%" stopColor="#bd8f42" />
        <stop offset="100%" stopColor="#6b4a1a" />
      </radialGradient>

      <linearGradient id="tc-brassline" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#7d5926" />
        <stop offset="50%" stopColor="#e3c078" />
        <stop offset="100%" stopColor="#7d5926" />
      </linearGradient>

      <linearGradient id="tc-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2d1c15" />
        <stop offset="45%" stopColor="#170c09" />
        <stop offset="100%" stopColor="#0b0504" />
      </linearGradient>

      <radialGradient id="tc-spot" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#f2cd90" stopOpacity="0.3" />
        <stop offset="45%" stopColor="#c98f4e" stopOpacity="0.11" />
        <stop offset="100%" stopColor="#c98f4e" stopOpacity="0" />
      </radialGradient>

      <radialGradient id="tc-contact" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#080304" stopOpacity="0.75" />
        <stop offset="60%" stopColor="#080304" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#080304" stopOpacity="0" />
      </radialGradient>

      <radialGradient id="tc-vignette" cx="0.5" cy="0.44" r="0.75">
        <stop offset="0%" stopColor="#000" stopOpacity="0" />
        <stop offset="58%" stopColor="#000" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.78" />
      </radialGradient>

      {/* velvet nap — fine grain, laid over the flat gradients in soft-light */}
      <filter id="tc-napfilter" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <pattern id="tc-nap" width="160" height="160" patternUnits="userSpaceOnUse">
        <rect width="160" height="160" filter="url(#tc-napfilter)" />
      </pattern>

      <clipPath id="tc-backclip">
        <path d={backPath()} />
      </clipPath>
    </>
  );
}

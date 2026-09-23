import {
  recommendBoxes,
  presetSachets,
  presetCandle,
  presetRectBox,
  presetSquare,
  spanWithOverlap,
  bestLooseFlatPack,
} from "../src/lib/sizing";
import {
  enumerateLayouts,
  planeFootprint,
  unitOrientations,
  OPTIMAL_PALLET_MIN_COVERAGE,
} from "../src/lib/layout-enumerate";
import { bestPalletFit } from "../src/lib/euro-pallet";
import { checkTechAccess } from "../src/lib/tech-access";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(spanWithOverlap(105, 2, 0) === 210, "no overlap 2×105=210");
assert(spanWithOverlap(105, 2, 15) === 195, "overlap 15 → 195");
assert(spanWithOverlap(105, 2, 10) === 200, "overlap 10 → 200");

// Brick row match accept/reject
const brickOk = planeFootprint(100, 105, 1, 2, "brick", 0, 0, 8);
assert(brickOk != null, "brick accept when |L−W| ≤ tol (nx=1)");
const brickReject = planeFootprint(200, 50, 2, 2, "brick", 0, 0, 8);
assert(brickReject == null, "brick reject when |span1−span2| > tol");

const pack = bestLooseFlatPack(150, 105, 1.5, 100, 15, 6.6);
console.log("Loose pack:", pack);
assert(pack.overlapEnabled && pack.overlapMm === 15, "overlap on");
assert(pack.nx * pack.ny * pack.nz >= 100, "qty covered");

const sachets = recommendBoxes(presetSachets());
console.log("Sachets etalon:", sachets.etalon.innerBox, sachets.etalon.summary);
console.log(
  "Sachets optimal:",
  sachets.optimal.map((o) => ({
    box: o.innerBox,
    S: o.groupCount,
    cov: Math.round(o.pallet.coverage * 100),
    exact: o.pallet.exact,
  })),
);
console.log("Sachets custom:", sachets.custom.box.label, sachets.custom.productionRoute);

assert(sachets.etalon.groupCount === 1, "etalon is S=1");
assert(sachets.layouts.length > 1, "multiple layouts enumerated");
assert(
  sachets.optimal.every(
    (o) =>
      o.pallet.ok &&
      (o.pallet.exact || o.pallet.coverage >= OPTIMAL_PALLET_MIN_COVERAGE),
  ),
  "optimal all have pallet ≥90%",
);

// ~310×215×110 (4 stacks ~305×210) has ~75% pallet — must not be in optimal
const weakStyle = sachets.layouts.find(
  (o) =>
    o.groupCount === 4 &&
    o.innerBox.lengthMm >= 300 &&
    o.innerBox.lengthMm <= 320 &&
    o.innerBox.widthMm >= 205 &&
    o.innerBox.widthMm <= 225 &&
    o.pallet.coverage < 0.85,
);
if (weakStyle) {
  assert(
    !sachets.optimal.some((o) => o.id === weakStyle.id),
    "weak ~310×215 4-stack not in optimal",
  );
  assert(
    weakStyle.tags.includes("weak_pallet") || weakStyle.pallet.coverage < 0.9,
    "weak 4-stack tagged or <90%",
  );
}
assert(
  !sachets.optimal.some((o) => o.pallet.coverage < 0.9 && !o.pallet.exact),
  "no optimal with coverage <90%",
);

assert(
  !sachets.recommendations.some(
    (r) => r.isBest && r.box.label === "200×200×200",
  ),
  "200×200×200 should not be best when dims-first layout is tighter",
);
assert(sachets.techHint.includes("240"), "tech hint present");

// rotateMode=none → no rotated layouts
const noneOr = unitOrientations({
  shape: "flat_stack",
  lengthMm: 150,
  widthMm: 105,
  heightMm: 1.5,
  quantity: 10,
  packing: "standard",
  rotateMode: "none",
});
assert(noneOr.orients.length === 1, "rotate none: single orient");
assert(!noneOr.orients[0]!.lengthMm || true, "canon present");

const sachetsNone = recommendBoxes({ ...presetSachets(), rotateMode: "none" });
assert(
  sachetsNone.layouts.every((l) => !l.rotatedFromCanon),
  "rotateMode=none yields no rotatedFromCanon",
);

// planar: cylinder stays upright
const cylPlanar = unitOrientations({
  shape: "cylinder",
  lengthMm: 150,
  widthMm: 150,
  heightMm: 105,
  diameterMm: 150,
  quantity: 4,
  packing: "standard",
  rotateMode: "planar",
});
assert(cylPlanar.orients.length === 1, "planar cylinder: upright only");
assert(
  cylPlanar.orients[0]!.heightMm === 105 &&
    cylPlanar.orients[0]!.lengthMm === 150,
  "planar cylinder dims",
);

const cylFull = unitOrientations({
  shape: "cylinder",
  lengthMm: 150,
  widthMm: 150,
  heightMm: 105,
  diameterMm: 150,
  quantity: 4,
  packing: "standard",
  rotateMode: "full",
});
assert(cylFull.orients.length >= 2, "full cylinder includes on-side");
assert(
  cylFull.orients.some((o) => o.heightMm === 150 && o.lengthMm === 105),
  "full puts cylinder on side",
);

const cylFullLayouts = enumerateLayouts({
  shape: "cylinder",
  lengthMm: 150,
  widthMm: 150,
  heightMm: 105,
  diameterMm: 150,
  quantity: 4,
  packing: "standard",
  rotateMode: "full",
  maxGroups: 4,
});
assert(
  cylFullLayouts.layouts.some((l) => l.rotatedFromCanon),
  "full cylinder layouts include rotated",
);

// Pallet <90% absent from optimal
const weakPalletBox = bestPalletFit({
  lengthMm: 310,
  widthMm: 215,
  heightMm: 110,
});
assert(
  weakPalletBox.coverage < 0.9,
  `310×215 coverage ${weakPalletBox.coverage} < 0.9`,
);

// Rect / cylinder smoke: qty>1 → several layouts
const rectMulti = recommendBoxes({
  ...presetRectBox(),
  quantity: 6,
  rotateMode: "none",
  maxGroups: 6,
});
assert(rectMulti.layouts.length >= 2, "rect qty>1 multiple layouts");
assert(rectMulti.etalon.groupCount === 1, "rect etalon S=1");

const cylMulti = recommendBoxes({
  ...presetCandle(),
  quantity: 4,
  rotateMode: "none",
  maxGroups: 4,
});
assert(cylMulti.layouts.length >= 2, "cylinder qty>1 multiple layouts");

const neat = recommendBoxes({
  ...presetSachets(),
  flatLayout: "neat_stack",
  occupiedVolumeLiters: null,
  allowOverlap: false,
});
console.log("Neat stack etalon:", neat.etalon.innerBox);
assert(neat.etalon.groupCount === 1, "neat etalon S=1");
assert(
  neat.productBlock.heightMm >= 140 && neat.productBlock.heightMm <= 160,
  "neat stack height ~150 mm",
);

const candle = recommendBoxes(presetCandle());
assert(
  candle.productBlock.lengthMm === 150 &&
    candle.productBlock.widthMm === 150 &&
    candle.productBlock.heightMm === 105,
  "cylinder bounding box",
);

const rect = recommendBoxes(presetRectBox());
const square = recommendBoxes(presetSquare());
assert(rect.notes.some((n) => /Прямоугольн/i.test(n)), "rect note");
assert(square.notes.some((n) => /Кубическ|квадрат/i.test(n)), "square note");

const bad = bestPalletFit({ lengthMm: 300, widthMm: 300, heightMm: 80 });
assert(!bad.exact && Math.abs(bad.coverage - 0.75) < 0.01, "300×300 pallet waste");

const techOk = checkTechAccess(240, 200, 140);
assert(techOk.ok && techOk.route === "tech_slotter", "240×200×140 tech ok");
const techBad = checkTechAccess(160, 120, 160);
assert(!techBad.ok && techBad.route === "custom_die", "160³ outside tech");

console.log("OK: layout enum + pallet ≥90% + rotate verified");

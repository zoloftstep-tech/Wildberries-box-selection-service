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
  DEFAULT_STACK_COUNTS,
} from "../src/lib/layout-enumerate";
import { bestPalletFit } from "../src/lib/euro-pallet";
import { checkTechAccess } from "../src/lib/tech-access";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(spanWithOverlap(105, 2, 0) === 210, "no overlap 2×105=210");
assert(spanWithOverlap(105, 2, 15) === 195, "overlap 15 → 195");
assert(spanWithOverlap(105, 2, 10) === 200, "overlap 10 → 200");

const brickOk = planeFootprint(100, 105, 1, 2, "brick", 0, 0, 8);
assert(brickOk != null, "brick accept when |L−W| ≤ tol (nx=1)");
const brickReject = planeFootprint(200, 50, 2, 2, "brick", 0, 0, 8);
assert(brickReject == null, "brick reject when |span1−span2| > tol");

const pack = bestLooseFlatPack(150, 105, 1.5, 100, 15, 6.6);
console.log("Loose pack:", pack);
assert(pack.overlapEnabled && pack.overlapMm === 15, "overlap on");
assert(pack.nx * pack.ny * pack.nz >= 100, "qty covered");

const sachets = recommendBoxes(presetSachets());
console.log("Sachets selected:", sachets.selectedLayout.innerBox, sachets.selectedLayout.summary);
console.log(
  "Sachets ranked:",
  sachets.ranked.map((o) => ({
    box: o.innerBox,
    S: o.groupCount,
    cov: Math.round(o.pallet.coverage * 100),
    exact: o.pallet.exact,
    div: o.voidFill?.dividerMm ?? 0,
  })),
);
console.log("Sachets custom:", sachets.custom.box.label, sachets.custom.productionRoute);

assert(!("etalon" in sachets), "no etalon on result");
assert(Array.isArray(sachets.ranked) && sachets.ranked.length >= 1, "ranked present");
assert(
  sachets.selectedLayout.id === sachets.ranked[0]!.id,
  "selected defaults to best ranked",
);
assert(
  sachets.custom.box.lengthMm === sachets.selectedLayout.innerBox.lengthMm &&
    sachets.custom.box.widthMm === sachets.selectedLayout.innerBox.widthMm &&
    sachets.custom.box.heightMm === sachets.selectedLayout.innerBox.heightMm,
  "custom matches selected layout",
);

// Регрессия-пример: плотная укладка без нахлёста → exact-паллет + tech среди лучших
const dense = sachets.ranked.find(
  (o) =>
    o.groupCount >= 2 &&
    o.pallet.exact &&
    o.tech.ok &&
    DEFAULT_STACK_COUNTS.includes(o.groupCount as 2 | 4 | 6 | 8),
);
assert(dense, "ranked includes even-stack exact+tech layout (dense packing example)");
console.log("Dense example:", dense!.innerBox, dense!.voidFill);

assert(
  sachets.layouts.every(
    (l) =>
      l.groupCount === 1 ||
      DEFAULT_STACK_COUNTS.includes(l.groupCount as 2 | 4 | 6 | 8),
  ),
  "stacks mode only even group counts (or neat S=1 not in stacks preset)",
);
assert(
  sachets.layouts.every((l) => ![3, 5, 7].includes(l.groupCount)),
  "no odd stack counts 3/5/7",
);

assert(
  sachets.ranked.every(
    (o) =>
      o.pallet.ok &&
      (o.pallet.exact || o.pallet.coverage >= OPTIMAL_PALLET_MIN_COVERAGE),
  ),
  "ranked all have pallet ≥90% or exact",
);

const noDiv = recommendBoxes({
  ...presetSachets(),
  allowDivider: false,
  dividerMm: 0,
});
assert(
  noDiv.layouts.every((l) => (l.voidFill?.dividerMm ?? 0) === 0),
  "without allowDivider no divider in layouts",
);

assert(sachets.techHint.includes("240"), "tech hint present");

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

const sachetsNone = recommendBoxes({ ...presetSachets(), rotateMode: "none" });
assert(
  sachetsNone.layouts.every((l) => !l.rotatedFromCanon),
  "rotateMode=none yields no rotatedFromCanon",
);

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
assert(cylFullLayouts.ranked.length >= 1, "cylinder ranked");

const weak = enumerateLayouts({
  shape: "rect",
  lengthMm: 300,
  widthMm: 300,
  heightMm: 80,
  quantity: 1,
  packing: "standard",
  maxGroups: 1,
});
assert(weak.ranked.length >= 1, "weak rect still has ranked");

const rectMulti = enumerateLayouts({
  shape: "rect",
  lengthMm: 100,
  widthMm: 80,
  heightMm: 60,
  quantity: 6,
  packing: "standard",
  maxGroups: 6,
});
assert(rectMulti.ranked[0]!.groupCount >= 1, "rect has ranked");

const layers = recommendBoxes({
  ...presetSachets(),
  flatLayout: "layers",
  allowDivider: false,
});
assert(
  layers.layouts.every((l) => (l.voidFill?.dividerMm ?? 0) === 0),
  "layers never use divider",
);
console.log("Layers selected:", layers.selectedLayout.innerBox, layers.selectedLayout.summary);

const neat = recommendBoxes({
  shape: "flat_stack",
  flatLayout: "neat_stack",
  lengthMm: 150,
  widthMm: 105,
  heightMm: 1.5,
  quantity: 100,
  packing: "standard",
});
console.log("Neat stack selected:", neat.selectedLayout.innerBox);
assert(neat.selectedLayout.groupCount === 1, "neat S=1");

assert(presetCandle().shape === "cylinder", "candle");
assert(presetRectBox().shape === "rect", "rect");
assert(presetSquare().lengthMm === 100, "square");

const tech = checkTechAccess(240, 160, 120);
assert(tech.ok, "240×160×120 tech ok");
const pallet = bestPalletFit({ lengthMm: 240, widthMm: 160, heightMm: 120 });
assert(pallet.exact && pallet.alongLength * pallet.alongWidth === 25, "5×5 pallet");

console.log("OK: layout enum + ranked + stacks/layers + divider permission verified");

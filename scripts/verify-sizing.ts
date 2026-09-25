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
    void: Math.round(o.voidRatio * 100),
    cov: Math.round(o.pallet.coverage * 100),
    exact: o.pallet.exact,
    tech: o.tech.ok,
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

// Плотная укладка: exact-паллет, без раздува H ради техлимитов, пустота считается по геометрии
const best = sachets.selectedLayout;
assert(best.groupCount === 2, "best is 2 stacks");
assert(best.pallet.exact, "best has exact pallet");
assert(
  best.voidRatio > 0.05 && best.voidRatio < 0.35,
  `geom void shown and moderate (got ${Math.round(best.voidRatio * 100)}%)`,
);
assert(
  best.innerBox.heightMm <= 100,
  `no tech-inflate to 120 when stack needs ~85 (got H=${best.innerBox.heightMm})`,
);
assert(
  (best.innerBox.lengthMm === 240 && best.innerBox.widthMm === 160) ||
    (best.innerBox.lengthMm === 160 && best.innerBox.widthMm === 240),
  "best base is 240×160 family",
);
console.log("Dense best:", best.innerBox, "void%", Math.round(best.voidRatio * 100));

assert(
  sachets.ranked.every(
    (o) =>
      Math.max(o.innerBox.lengthMm, o.innerBox.widthMm, o.innerBox.heightMm) <=
      500,
  ),
  "no spaghetti alternatives (max side ≤500)",
);
assert(
  sachets.ranked.every((o) => {
    const sides = [
      o.innerBox.lengthMm,
      o.innerBox.widthMm,
      o.innerBox.heightMm,
    ].sort((a, b) => b - a);
    return sides[0]! / Math.max(sides[2]!, 1) <= 5.01;
  }),
  "no extreme aspect-ratio alternatives",
);

assert(
  sachets.ranked.every((o) => o.innerBox.lengthMm >= o.innerBox.widthMm - 0.05),
  "Д×Ш: длина ≥ ширины на всех ranked",
);

// 150×105×3 → 240×160×160 (Д=240)
const thick = recommendBoxes({
  ...presetSachets(),
  heightMm: 3,
  occupiedVolumeLiters: null,
});
assert(
  thick.selectedLayout.innerBox.lengthMm === 240 &&
    thick.selectedLayout.innerBox.widthMm === 160 &&
    thick.selectedLayout.innerBox.heightMm === 160,
  `150×105×3 → 240×160×160 (got ${thick.selectedLayout.innerBox.lengthMm}×${thick.selectedLayout.innerBox.widthMm}×${thick.selectedLayout.innerBox.heightMm})`,
);
console.log("Thick 3mm:", thick.selectedLayout.innerBox);
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

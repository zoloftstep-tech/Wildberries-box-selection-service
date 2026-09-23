import {
  recommendBoxes,
  presetSachets,
  presetCandle,
} from "../src/lib/sizing";
import { bestPalletFit } from "../src/lib/euro-pallet";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const sachets = recommendBoxes(presetSachets());
console.log("Sachets product block:", sachets.productBlock);
console.log("Sachets required:", sachets.requiredInner);
console.log("Sachets custom:", sachets.custom.box.label);
console.log("Sachets custom pallet:", sachets.custom.pallet.summary);
console.log(
  "Sachets best catalog:",
  sachets.recommendations[0]?.box.label,
  "pallet:",
  sachets.recommendations[0]?.pallet.summary,
);

assert(
  sachets.productBlock.lengthMm === 150 &&
    sachets.productBlock.widthMm === 105 &&
    sachets.productBlock.heightMm === 150,
  "stack should be 150×105×150",
);
assert(
  sachets.requiredInner.lengthMm === 160 &&
    sachets.requiredInner.widthMm === 115 &&
    sachets.requiredInner.heightMm === 160,
  "required with 5mm clearance",
);
assert(sachets.recommendations.length > 0, "catalog hits expected");
assert(
  sachets.custom.compliance.every((c) => c.ok),
  "custom sachet box should pass all standard models",
);

const candle = recommendBoxes(presetCandle());
console.log("Candle product block:", candle.productBlock);
console.log("Candle required:", candle.requiredInner);
console.log("Candle custom:", candle.custom.box.label);
console.log(
  "Candle best catalog:",
  candle.recommendations[0]?.box.label,
  candle.recommendations[0]?.pallet.summary,
);

assert(
  candle.productBlock.lengthMm === 150 &&
    candle.productBlock.widthMm === 150 &&
    candle.productBlock.heightMm === 105,
  "cylinder bounding box",
);
assert(
  candle.requiredInner.lengthMm === 160 &&
    candle.requiredInner.widthMm === 160 &&
    candle.requiredInner.heightMm === 115,
  "cylinder required",
);
assert(candle.custom.compliance.every((c) => c.ok), "candle custom ok");

const bad = bestPalletFit({ lengthMm: 300, widthMm: 300, heightMm: 80 });
console.log("300×300×80 pallet:", bad.summary);
assert(bad.ok, "300×300 fits on pallet without overhang");
assert(!bad.exact, "300×300 flat base should leave remainder on 800 side");
assert(bad.countPerLayer === 8, "4×2 = 8 with 300×300 base");
assert(
  bad.leftoverWidthMm === 200 || bad.leftoverLengthMm === 200,
  "200mm waste",
);
assert(Math.abs(bad.coverage - 0.75) < 0.01, "75% coverage");

const good = bestPalletFit({ lengthMm: 160, widthMm: 120, heightMm: 160 });
console.log("160×120×160 pallet:", good.summary);
assert(good.exact, "160×120 should tile exactly as 10×5 or similar");
assert(good.countPerLayer === 50, "50 per layer");

assert(sachets.palletHint, "hint about 300×300 should be present");

console.log("OK: sizing + euro pallet verified");

import {
  recommendBoxes,
  presetSachets,
  presetCandle,
} from "../src/lib/sizing";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const sachets = recommendBoxes(presetSachets());
console.log("Sachets product block:", sachets.productBlock);
console.log("Sachets required:", sachets.requiredInner);
console.log("Sachets custom:", sachets.custom.box.label);
console.log(
  "Sachets best catalog:",
  sachets.recommendations[0]?.box.label,
  "ok models:",
  sachets.recommendations[0]?.compliance.filter((c) => c.ok).map((c) => c.model.shortTitle),
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

console.log("OK: sizing presets verified");

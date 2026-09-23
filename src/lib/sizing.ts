import {
  BOX_CATALOG,
  sortedDims,
  type CatalogBox,
} from "./box-catalog";
import {
  bestPalletFit,
  palletIsPractical,
  type PalletFit,
} from "./euro-pallet";
import {
  checkAllModels,
  type ComplianceResult,
  type SalesModel,
} from "./wb-limits";

export type ProductShape = "rect" | "cylinder" | "flat_stack";

export type PackingMode = "tight" | "standard" | "bubble" | "fragile";

export interface ProductInput {
  shape: ProductShape;
  /** Для rect / flat_stack: длина, мм */
  lengthMm: number;
  /** Для rect / flat_stack: ширина, мм */
  widthMm: number;
  /** Для rect: высота; для flat_stack: толщина одного пакетика; для cylinder: высота */
  heightMm: number;
  /** Для cylinder: диаметр, мм */
  diameterMm?: number;
  quantity: number;
  weightKg?: number | null;
  packing: PackingMode;
}

export interface Dims {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export interface FitScore {
  fits: boolean;
  /** Ориентация коробки относительно товара */
  orientation: Dims;
  /** Зазоры по осям после ориентации, мм */
  gaps: Dims;
  unusedVolumeRatio: number;
  maxGapMm: number;
  score: number;
}

export interface BoxRecommendation {
  kind: "catalog" | "custom";
  box: CatalogBox;
  fit: FitScore;
  compliance: ComplianceResult[];
  pallet: PalletFit;
  isBest: boolean;
  warnings: string[];
}

export interface SizingResult {
  productBlock: Dims;
  requiredInner: Dims;
  clearanceMm: number;
  recommendations: BoxRecommendation[];
  custom: BoxRecommendation;
  notes: string[];
  markingHint: string | null;
  /** Пример: почему 300×300×80 отвергают при паллетировании */
  palletHint: string | null;
}

/** Зазор на сторону (мм) по режиму упаковки. */
export function clearanceForPacking(mode: PackingMode): number {
  switch (mode) {
    case "tight":
      return 2;
    case "standard":
      return 5;
    case "bubble":
      return 10;
    case "fragile":
      return 20;
  }
}

/** Габаритный блок товара (без зазора) — прямоугольный параллелепипед. */
export function productBoundingBox(input: ProductInput): Dims {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);

  if (input.shape === "cylinder") {
    const d = input.diameterMm ?? input.lengthMm;
    const h = input.heightMm;
    if (qty === 1) {
      return { lengthMm: d, widthMm: d, heightMm: h };
    }
    // Несколько цилиндров: сетка в плоскости основания (квадратная укладка)
    const cols = Math.ceil(Math.sqrt(qty));
    const rows = Math.ceil(qty / cols);
    return {
      lengthMm: cols * d,
      widthMm: rows * d,
      heightMm: h,
    };
  }

  if (input.shape === "flat_stack") {
    // Плоские пакетики сложены друг на друга врассыпную
    const thickness = input.heightMm;
    return {
      lengthMm: input.lengthMm,
      widthMm: input.widthMm,
      heightMm: thickness * qty,
    };
  }

  // rect — штучный прямоугольный товар; qty>1 → оптимальная сетка
  if (qty === 1) {
    return {
      lengthMm: input.lengthMm,
      widthMm: input.widthMm,
      heightMm: input.heightMm,
    };
  }

  return bestRectGrid(
    input.lengthMm,
    input.widthMm,
    input.heightMm,
    qty,
  );
}

function bestRectGrid(l: number, w: number, h: number, qty: number): Dims {
  let best: Dims | null = null;
  let bestVol = Infinity;

  for (let nx = 1; nx <= qty; nx++) {
    for (let ny = 1; ny <= Math.ceil(qty / nx); ny++) {
      const nz = Math.ceil(qty / (nx * ny));
      if (nx * ny * nz < qty) continue;
      const dims = sortedDims(nx * l, ny * w, nz * h);
      const vol = dims[0] * dims[1] * dims[2];
      if (vol < bestVol) {
        bestVol = vol;
        best = { lengthMm: dims[0], widthMm: dims[1], heightMm: dims[2] };
      }
      // перестановки осей единицы
      for (const [a, b, c] of permute3(l, w, h)) {
        const d2 = sortedDims(nx * a, ny * b, nz * c);
        const v2 = d2[0] * d2[1] * d2[2];
        if (v2 < bestVol) {
          bestVol = v2;
          best = { lengthMm: d2[0], widthMm: d2[1], heightMm: d2[2] };
        }
      }
    }
  }

  return best ?? { lengthMm: l, widthMm: w, heightMm: h * qty };
}

function permute3(a: number, b: number, c: number): [number, number, number][] {
  return [
    [a, b, c],
    [a, c, b],
    [b, a, c],
    [b, c, a],
    [c, a, b],
    [c, b, a],
  ];
}

export function addClearance(block: Dims, clearanceMm: number): Dims {
  const pad = clearanceMm * 2;
  return {
    lengthMm: block.lengthMm + pad,
    widthMm: block.widthMm + pad,
    heightMm: block.heightMm + pad,
  };
}

/** Округлить вверх до шага (по умолчанию 5 мм) — оси как у товара. */
export function roundUpCustom(required: Dims, step = 5): Dims {
  const up = (n: number) => Math.ceil(n / step) * step;
  return {
    lengthMm: up(required.lengthMm),
    widthMm: up(required.widthMm),
    heightMm: up(required.heightMm),
  };
}

export function tryFit(box: Dims, required: Dims): FitScore | null {
  let best: FitScore | null = null;

  for (const [bl, bw, bh] of permute3(box.lengthMm, box.widthMm, box.heightMm)) {
    const [rl, rw, rh] = [required.lengthMm, required.widthMm, required.heightMm];
    // required уже «нужный минимум»; сравниваем с ориентацией коробки
    // Перебираем ориентации required относительно box
    for (const [x, y, z] of permute3(rl, rw, rh)) {
      if (bl >= x && bw >= y && bh >= z) {
        const gaps = {
          lengthMm: bl - x,
          widthMm: bw - y,
          heightMm: bh - z,
        };
        const boxVol = bl * bw * bh;
        const reqVol = x * y * z;
        const unusedVolumeRatio = boxVol > 0 ? (boxVol - reqVol) / boxVol : 1;
        const maxGapMm = Math.max(gaps.lengthMm, gaps.widthMm, gaps.heightMm);
        // Меньше пустот и меньше объём — лучше; штраф за огромные зазоры
        const score =
          boxVol + unusedVolumeRatio * 50_000 + maxGapMm * 100 + (gaps.lengthMm + gaps.widthMm + gaps.heightMm);

        const candidate: FitScore = {
          fits: true,
          orientation: { lengthMm: bl, widthMm: bw, heightMm: bh },
          gaps,
          unusedVolumeRatio,
          maxGapMm,
          score,
        };
        if (!best || candidate.score < best.score) best = candidate;
      }
    }
  }

  return best;
}

function buildWarnings(
  fit: FitScore,
  compliance: ComplianceResult[],
  pallet: PalletFit,
): string[] {
  const warnings: string[] = [];
  if (fit.unusedVolumeRatio > 0.45 || fit.maxGapMm > 40) {
    warnings.push(
      "Много свободного места — по правилам WB товар не должен болтаться. Заполните пустоты или возьмите коробку плотнее.",
    );
  }
  if (fit.maxGapMm <= 4 && fit.unusedVolumeRatio < 0.15) {
    warnings.push(
      "Плотная посадка: удобно для FBS/FBW, но проверьте, что товар легко достаётся.",
    );
  }
  const failed = compliance.filter((c) => !c.ok);
  if (failed.length === compliance.length) {
    warnings.push(
      "Размер не проходит ни одну из стандартных моделей FBS/FBW без статуса КГТ+/СГТ.",
    );
  }
  if (!pallet.ok) {
    warnings.push(
      "Не ложится на европаллет 1200×800 без свеса — для отгрузки на склад WB это критично.",
    );
  } else if (!palletIsPractical(pallet)) {
    warnings.push(
      `Слабая укладка на европаллет: ${pallet.summary} Типичная причина отказа размера вроде 300×300.`,
    );
  }
  return warnings;
}

function makeRecommendation(
  kind: "catalog" | "custom",
  box: CatalogBox,
  requiredInner: Dims,
  weight: number | null,
): BoxRecommendation | null {
  const fit = tryFit(box, requiredInner);
  if (!fit) return null;
  const compliance = checkAllModels(
    box.lengthMm,
    box.widthMm,
    box.heightMm,
    weight,
  );
  const pallet = bestPalletFit(box);
  return {
    kind,
    box,
    fit,
    compliance,
    pallet,
    isBest: false,
    warnings: buildWarnings(fit, compliance, pallet),
  };
}

function rankKey(r: BoxRecommendation): [number, number, number, number] {
  const modelOk = r.compliance.filter((c) => c.ok).length;
  const palletScore = r.pallet.exact ? 2 : palletIsPractical(r.pallet) ? 1 : 0;
  return [modelOk, palletScore, r.pallet.coverage, -r.fit.score];
}

function compareRecs(a: BoxRecommendation, b: BoxRecommendation): number {
  const ka = rankKey(a);
  const kb = rankKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (kb[i]! !== ka[i]!) return kb[i]! - ka[i]!;
  }
  return 0;
}

export function recommendBoxes(input: ProductInput): SizingResult {
  const clearanceMm = clearanceForPacking(input.packing);
  const productBlock = productBoundingBox(input);
  const requiredInner = addClearance(productBlock, clearanceMm);
  const weight = input.weightKg ?? null;
  const notes: string[] = [];

  if (input.shape === "cylinder") {
    notes.push(
      "Круглый товар упаковывается в квадратную/прямоугольную коробку по диаметру основания.",
    );
  }
  if (input.shape === "flat_stack") {
    notes.push(
      `Укладка ${Math.max(1, Math.floor(input.quantity))} плоских единиц: считается блок ${productBlock.lengthMm}×${productBlock.widthMm}×${productBlock.heightMm} мм (можно переориентировать при сборке).`,
    );
  }
  if (input.packing === "fragile") {
    notes.push(
      "Режим «хрупкое»: заложен запас под ≥2 слоя пузырчатой плёнки (требования WB к хрупким).",
    );
  } else if (input.packing === "bubble") {
    notes.push("Заложен запас под слой пузырчатой плёнки.");
  }
  notes.push(
    "Отдельно проверяется укладка на европаллет 1200×800 мм (принимают склады WB).",
  );

  const customDims = roundUpCustom(requiredInner);
  const customBox: CatalogBox = {
    id: "custom",
    lengthMm: customDims.lengthMm,
    widthMm: customDims.widthMm,
    heightMm: customDims.heightMm,
    label: `${customDims.lengthMm}×${customDims.widthMm}×${customDims.heightMm}`,
  };
  const custom = makeRecommendation("custom", customBox, requiredInner, weight)!;

  const catalogFits: BoxRecommendation[] = [];
  for (const box of BOX_CATALOG) {
    const rec = makeRecommendation("catalog", box, requiredInner, weight);
    if (rec) catalogFits.push(rec);
  }

  catalogFits.sort(compareRecs);

  const top = catalogFits.slice(0, 6);
  if (top[0]) top[0].isBest = true;

  const faceA = Math.min(
    productBlock.lengthMm,
    productBlock.widthMm,
    productBlock.heightMm,
  );
  const faceB = Math.max(productBlock.lengthMm, productBlock.widthMm);
  let markingHint: string | null = null;
  if (faceA < 80 || faceB < 80) {
    markingHint =
      "Товар меньше 80×80 мм или с круглой/неровной поверхностью: по правилам FBS нужна доп. упаковка (пакет/коробка) для надёжной маркировки.";
  }
  if (input.shape === "cylinder") {
    markingHint =
      (markingHint ? markingHint + " " : "") +
      "Круглая поверхность: размещайте стикер на плоской стороне коробки, не на товаре.";
  }

  const bad300 = bestPalletFit({
    lengthMm: 300,
    widthMm: 300,
    heightMm: 80,
  });
  const palletHint = !bad300.exact
    ? `Размер 300×300×80 проходит лимиты стороны/суммы WB, но на европаллете 1200×800 даёт расклад ${bad300.alongLength}×${bad300.alongWidth} с остатком ${bad300.leftoverLengthMm || bad300.leftoverWidthMm} мм (покрытие ${Math.round(bad300.coverage * 100)}%) — поэтому его часто отклоняют при паллетировании.`
    : null;

  return {
    productBlock,
    requiredInner,
    clearanceMm,
    recommendations: top,
    custom,
    notes,
    markingHint,
    palletHint,
  };
}

export function presetSachets(): ProductInput {
  return {
    shape: "flat_stack",
    lengthMm: 150,
    widthMm: 105,
    heightMm: 1.5,
    quantity: 100,
    weightKg: null,
    packing: "standard",
  };
}

export function presetCandle(): ProductInput {
  return {
    shape: "cylinder",
    lengthMm: 150,
    widthMm: 150,
    heightMm: 105,
    diameterMm: 150,
    quantity: 1,
    weightKg: null,
    packing: "standard",
  };
}

export type PreferredModel = SalesModel | "any";

export function filterByModel(
  result: SizingResult,
  model: PreferredModel,
): BoxRecommendation[] {
  const list = [...result.recommendations];
  if (model === "any") return list;
  return list.filter((r) =>
    r.compliance.some((c) => c.model.id === model && c.ok),
  );
}

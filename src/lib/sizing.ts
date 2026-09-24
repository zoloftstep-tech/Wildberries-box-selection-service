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
  enumerateLayouts,
  spanWithOverlap as spanWithOverlapLayout,
  type LayoutCandidate,
  type RotateMode,
} from "./layout-enumerate";
import {
  checkTechAccess,
  type ProductionRoute,
  type TechAccessResult,
} from "./tech-access";
import {
  checkAllModels,
  type ComplianceResult,
  type SalesModel,
} from "./wb-limits";

export type ProductShape = "rect" | "cylinder" | "flat_stack";

/** Плоский товар: аккуратная стопка или россыпь/слойная укладка. */
export type FlatLayout = "neat_stack" | "loose_bulk";

export type PackingMode = "tight" | "standard" | "bubble" | "fragile";

export type { LayoutCandidate, RotateMode };

export interface ProductInput {
  shape: ProductShape;
  /** Для rect / flat_stack: длина, мм */
  lengthMm: number;
  /** Для rect / flat_stack: ширина, мм */
  widthMm: number;
  /** Для rect: высота; для flat_stack: толщина одного; для cylinder: высота */
  heightMm: number;
  /** Для cylinder: диаметр, мм */
  diameterMm?: number;
  quantity: number;
  weightKg?: number | null;
  packing: PackingMode;
  /** Только flat_stack: стопка или врассыпную / слоями */
  flatLayout?: FlatLayout;
  /**
   * Занимаемый объём, л — вторичная проверка (россыпь «вспухает»).
   * Не задаёт размер коробки сам по себе.
   */
  occupiedVolumeLiters?: number | null;
  /** Разрешить небольшое наложение единиц в плоскости (сжимает габарит). */
  allowOverlap?: boolean;
  /** Нахлёст на стык, мм (пример: 2×105 → 210 без, ~190–195 при 15 мм). */
  overlapMm?: number;
  /**
   * Поворот единицы относительно канона Д×Ш×В / Ø×H.
   * none — только канон; planar — Д↔Ш; full — любые оси (цилиндр на бок).
   */
  rotateMode?: RotateMode;
  /** Допуск совпадения длины brick-рядов, мм */
  rowMatchTolMm?: number;
  /** Шаг округления внутренней коробки вверх, мм */
  roundStepMm?: number;
  /** Макс. число стопок/групп в плоскости (1…N) */
  maxGroups?: number;
  /** Soft boost в score для этих groupCount (обычно 2…6) */
  preferredGroupCounts?: number[];
  /** Картонный разделитель: фикс при void-fill выкл; иначе модель подбирает */
  dividerMm?: number;
  /** @deprecated → dividerMm */
  interStackGapMm?: number;
  /** Отсев слишком высоких столбиков, мм */
  maxStackHeightMm?: number | null;
  /** Толщина стенки (паллет по outer = inner + 2×wall); v1 обычно 0 */
  wallThicknessMm?: number;
  /** Раздувать высоту стопки из occupiedVolumeLiters (по умолчанию нет) */
  inflateStackFromVolume?: boolean;
  /** При snap к exact-паллету поднять H под объём россыпи */
  fillHeightFromVolume?: boolean;
  /**
   * Разрешить вкладыши: разделитель, бока, верх/низ — в разумных пределах.
   * Модель сама подбирает толщины под exact-паллет и техлимиты.
   */
  allowVoidFill?: boolean;
  maxSideInsertMm?: number;
  maxDividerMm?: number;
  maxHeightInsertMm?: number;
  /**
   * Каталог/custom считать от этой укладки (id из layouts).
   * По умолчанию — эталон.
   */
  selectedLayoutId?: string | null;
}

export interface Dims {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

/** Результат раскладки плоских единиц в сетку. */
export interface FlatPackInfo {
  nx: number;
  ny: number;
  nz: number;
  unitLengthMm: number;
  unitWidthMm: number;
  thicknessMm: number;
  overlapEnabled: boolean;
  overlapMm: number;
  spanXMm: number;
  spanYMm: number;
  spanZMm: number;
  geomVolumeLiters: number;
  /** Высота раздута под заявленный объём россыпи */
  bulkInflated: boolean;
}

type FitContext =
  | { mode: "geom"; required: Dims }
  | {
      mode: "volume";
      requiredVolMm3: number;
      faceLengthMm: number;
      faceWidthMm: number;
      required: Dims;
    };

export interface FitScore {
  fits: boolean;
  orientation: Dims;
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
  tech: TechAccessResult;
  productionRoute: ProductionRoute;
  isBest: boolean;
  isBestTech: boolean;
  warnings: string[];
}

export interface SizingResult {
  productBlock: Dims;
  requiredInner: Dims;
  clearanceMm: number;
  /** Геометрический или заявленный объём для справки, л */
  occupiedVolumeLiters: number;
  /** Детали сетки (только flat_stack, legacy) */
  flatPack: FlatPackInfo | null;
  /** Все уникальные кандидаты укладки */
  layouts: LayoutCandidate[];
  /** Эталон: 1 стопка / 1 группа в каноне (предпочтительно) */
  etalon: LayoutCandidate;
  /** Оптимальные: паллет ≥90%, отсортированы по score */
  optimal: LayoutCandidate[];
  /** Укладка, от которой посчитаны catalog/custom */
  selectedLayout: LayoutCandidate;
  recommendations: BoxRecommendation[];
  custom: BoxRecommendation;
  customTech: BoxRecommendation | null;
  notes: string[];
  markingHint: string | null;
  palletHint: string | null;
  techHint: string;
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

export function volumeLiters(dims: Dims): number {
  return (dims.lengthMm * dims.widthMm * dims.heightMm) / 1_000_000;
}

/**
 * Длина ряда с возможным наложением.
 * count=2, unit=105, overlap=15 → 105+90=195 (без overlap → 210).
 */
export function spanWithOverlap(
  unitMm: number,
  count: number,
  overlapMm: number,
): number {
  return spanWithOverlapLayout(unitMm, count, overlapMm);
}

/**
 * Лучшая слойная сетка плоских единиц: оси первичны, объём вторичен.
 * При заявленном occupiedVolumeLiters высота может чуть раздуться (вспухание россыпи),
 * не ломая footprint по L×W укладки.
 */
export function bestLooseFlatPack(
  lengthMm: number,
  widthMm: number,
  thicknessMm: number,
  quantity: number,
  overlapMm: number,
  occupiedVolumeLiters?: number | null,
): FlatPackInfo {
  const qty = Math.max(1, Math.floor(quantity));
  const t = Math.max(0.1, thicknessMm);
  const overlap = Math.max(0, overlapMm);

  type Cand = FlatPackInfo & { score: number };
  const cands: Cand[] = [];

  for (let nx = 1; nx <= qty; nx++) {
    for (let ny = 1; ny <= Math.ceil(qty / nx); ny++) {
      const nz = Math.ceil(qty / (nx * ny));
      if (nx * ny * nz < qty) continue;

      for (const [uL, uW] of [
        [lengthMm, widthMm],
        [widthMm, lengthMm],
      ] as [number, number][]) {
        const spanX = spanWithOverlap(uL, nx, overlap);
        const spanY = spanWithOverlap(uW, ny, overlap);
        const spanZ = t * nz;
        const geomVol = (spanX * spanY * spanZ) / 1_000_000;
        const bulkInflated =
          occupiedVolumeLiters != null &&
          occupiedVolumeLiters > geomVol + 0.15;

        // Первично: компактный блок по осям. Объём россыпи не раздувает габарит.
        const aspect =
          Math.max(spanX, spanY, spanZ) / Math.max(1, Math.min(spanX, spanY, spanZ));
        const score =
          geomVol * 1000 +
          aspect * 8 +
          Math.max(spanX, spanY, spanZ) * 0.05 +
          nz * 0.3;

        cands.push({
          nx,
          ny,
          nz,
          unitLengthMm: uL,
          unitWidthMm: uW,
          thicknessMm: t,
          overlapEnabled: overlap > 0,
          overlapMm: overlap,
          spanXMm: spanX,
          spanYMm: spanY,
          spanZMm: spanZ,
          geomVolumeLiters: geomVol,
          bulkInflated,
          score,
        });
      }
    }
  }

  cands.sort((a, b) => a.score - b.score);
  const best = cands[0]!;
  return {
    nx: best.nx,
    ny: best.ny,
    nz: best.nz,
    unitLengthMm: best.unitLengthMm,
    unitWidthMm: best.unitWidthMm,
    thicknessMm: best.thicknessMm,
    overlapEnabled: best.overlapEnabled,
    overlapMm: best.overlapMm,
    spanXMm: Math.round(best.spanXMm * 10) / 10,
    spanYMm: Math.round(best.spanYMm * 10) / 10,
    spanZMm: Math.round(best.spanZMm * 10) / 10,
    geomVolumeLiters: best.geomVolumeLiters,
    bulkInflated: best.bulkInflated,
  };
}

/** @deprecated объём больше не задаёт габарит сам; оставлен для справки/миграции. */
export function dimsFromOccupiedVolume(
  faceLengthMm: number,
  faceWidthMm: number,
  volumeLitersValue: number,
): Dims {
  const pack = bestLooseFlatPack(
    faceLengthMm,
    faceWidthMm,
    1.5,
    100,
    0,
    volumeLitersValue,
  );
  return {
    lengthMm: pack.spanXMm,
    widthMm: pack.spanYMm,
    heightMm: pack.spanZMm,
  };
}

export function resolveFlatPack(input: ProductInput): FlatPackInfo | null {
  if (input.shape !== "flat_stack") return null;
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const layout = input.flatLayout ?? "neat_stack";

  if (layout === "neat_stack") {
    return {
      nx: 1,
      ny: 1,
      nz: qty,
      unitLengthMm: input.lengthMm,
      unitWidthMm: input.widthMm,
      thicknessMm: input.heightMm,
      overlapEnabled: false,
      overlapMm: 0,
      spanXMm: input.lengthMm,
      spanYMm: input.widthMm,
      spanZMm: input.heightMm * qty,
      geomVolumeLiters: volumeLiters({
        lengthMm: input.lengthMm,
        widthMm: input.widthMm,
        heightMm: input.heightMm * qty,
      }),
      bulkInflated: false,
    };
  }

  const overlap =
    input.allowOverlap && (input.overlapMm ?? 0) > 0
      ? input.overlapMm ?? 0
      : 0;

  return bestLooseFlatPack(
    input.lengthMm,
    input.widthMm,
    input.heightMm,
    qty,
    overlap,
    input.occupiedVolumeLiters,
  );
}

/** Габаритный блок товара (без зазора). */
export function productBoundingBox(input: ProductInput): Dims {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);

  if (input.shape === "cylinder") {
    const d = input.diameterMm ?? input.lengthMm;
    const h = input.heightMm;
    if (qty === 1) {
      return { lengthMm: d, widthMm: d, heightMm: h };
    }
    const cols = Math.ceil(Math.sqrt(qty));
    const rows = Math.ceil(qty / cols);
    return {
      lengthMm: cols * d,
      widthMm: rows * d,
      heightMm: h,
    };
  }

  if (input.shape === "flat_stack") {
    const pack = resolveFlatPack(input)!;
    return {
      lengthMm: pack.spanXMm,
      widthMm: pack.spanYMm,
      heightMm: pack.spanZMm,
    };
  }

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
    for (const [x, y, z] of permute3(
      required.lengthMm,
      required.widthMm,
      required.heightMm,
    )) {
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
        const score =
          boxVol +
          unusedVolumeRatio * 50_000 +
          maxGapMm * 100 +
          (gaps.lengthMm + gaps.widthMm + gaps.heightMm);

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

/**
 * Для врассыпную: коробка подходит, если объём ≥ нужного и
 * хотя бы одна грань принимает лицо единицы (L×W пакетика).
 */
export function tryFitVolume(
  box: Dims,
  requiredVolMm3: number,
  faceLengthMm: number,
  faceWidthMm: number,
): FitScore | null {
  const boxVol = box.lengthMm * box.widthMm * box.heightMm;
  if (boxVol + 1 < requiredVolMm3) return null;

  let orientation: Dims | null = null;
  for (const [a, b, c] of permute3(box.lengthMm, box.widthMm, box.heightMm)) {
    if (
      (a >= faceLengthMm && b >= faceWidthMm) ||
      (a >= faceWidthMm && b >= faceLengthMm)
    ) {
      orientation = { lengthMm: a, widthMm: b, heightMm: c };
      break;
    }
  }
  if (!orientation) return null;

  const unusedVolumeRatio = (boxVol - requiredVolMm3) / boxVol;
  const score = boxVol + unusedVolumeRatio * 50_000;
  return {
    fits: true,
    orientation,
    gaps: { lengthMm: 0, widthMm: 0, heightMm: 0 },
    unusedVolumeRatio,
    maxGapMm: 0,
    score,
  };
}

function buildWarnings(
  fit: FitScore,
  compliance: ComplianceResult[],
  pallet: PalletFit,
  tech: TechAccessResult,
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
  if (!tech.ok) {
    warnings.push(tech.messages[0]!);
  }
  return warnings;
}

function fitBox(box: Dims, ctx: FitContext): FitScore | null {
  if (ctx.mode === "volume") {
    return tryFitVolume(
      box,
      ctx.requiredVolMm3,
      ctx.faceLengthMm,
      ctx.faceWidthMm,
    );
  }
  return tryFit(box, ctx.required);
}

/** Индивидуальный размер под объём + техлимиты (если возможно). */
export function customDimsForTech(
  ctx: FitContext,
  occupiedLiters: number,
): Dims | null {
  const targetMm3 =
    ctx.mode === "volume"
      ? ctx.requiredVolMm3
      : Math.max(occupiedLiters, volumeLiters(ctx.required)) * 1_000_000;
  const bases: [number, number][] = [
    [240, 200],
    [240, 160],
    [300, 200],
    [250, 200],
    [400, 200],
    [300, 160],
  ];
  const heights = [80, 100, 120, 140, 160, 180, 200, 240];
  let best: Dims | null = null;
  let bestScore = Infinity;

  for (const [a, b] of bases) {
    for (const h of heights) {
      const dims = { lengthMm: a, widthMm: b, heightMm: h };
      if (!checkTechAccess(a, b, h).ok) continue;
      if (a * b * h < targetMm3) continue;
      if (!fitBox(dims, ctx)) continue;
      const pallet = bestPalletFit(dims);
      const waste = (a * b * h - targetMm3) / targetMm3;
      const score =
        waste * 10 +
        (pallet.exact ? 0 : palletIsPractical(pallet) ? 1 : 6) +
        a * b * h / 1e7;
      if (score < bestScore) {
        bestScore = score;
        best = dims;
      }
    }
  }
  return best;
}

function makeRecommendation(
  kind: "catalog" | "custom",
  box: CatalogBox,
  ctx: FitContext,
  weight: number | null,
): BoxRecommendation | null {
  const fit = fitBox(box, ctx);
  if (!fit) return null;
  const compliance = checkAllModels(
    box.lengthMm,
    box.widthMm,
    box.heightMm,
    weight,
  );
  const pallet = bestPalletFit(box);
  const tech = checkTechAccess(box.lengthMm, box.widthMm, box.heightMm);
  return {
    kind,
    box,
    fit,
    compliance,
    pallet,
    tech,
    productionRoute: tech.route,
    isBest: false,
    isBestTech: false,
    warnings: buildWarnings(fit, compliance, pallet, tech),
  };
}

function rankKey(r: BoxRecommendation): [number, number, number, number, number] {
  const modelOk = r.compliance.filter((c) => c.ok).length;
  const palletScore = r.pallet.exact ? 2 : palletIsPractical(r.pallet) ? 1 : 0;
  // Не отсекаем вне техлимитов — лишь лёгкий бонус слоттеру
  const techBonus = r.tech.ok ? 0.15 : 0;
  return [modelOk, palletScore, r.pallet.coverage + techBonus, -r.fit.score, 0];
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
  const enumResult = enumerateLayouts({
    shape: input.shape,
    lengthMm: input.lengthMm,
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    diameterMm: input.diameterMm,
    quantity: input.quantity,
    packing: input.packing,
    flatLayout: input.flatLayout,
    occupiedVolumeLiters: input.occupiedVolumeLiters,
    allowOverlap: input.allowOverlap,
    overlapMm: input.overlapMm,
    rotateMode: input.rotateMode ?? "none",
    rowMatchTolMm: input.rowMatchTolMm,
    roundStepMm: input.roundStepMm,
    maxGroups: input.maxGroups,
    preferredGroupCounts: input.preferredGroupCounts,
    dividerMm: input.dividerMm,
    interStackGapMm: input.interStackGapMm,
    maxStackHeightMm: input.maxStackHeightMm,
    wallThicknessMm: input.wallThicknessMm,
    inflateStackFromVolume: input.inflateStackFromVolume,
    fillHeightFromVolume: input.fillHeightFromVolume,
    allowVoidFill: input.allowVoidFill,
    maxSideInsertMm: input.maxSideInsertMm,
    maxDividerMm: input.maxDividerMm,
    maxHeightInsertMm: input.maxHeightInsertMm,
  });

  const selectedLayout =
    (input.selectedLayoutId
      ? enumResult.layouts.find((l) => l.id === input.selectedLayoutId) ??
        enumResult.optimal.find((l) => l.id === input.selectedLayoutId) ??
        (enumResult.etalon.id === input.selectedLayoutId
          ? enumResult.etalon
          : null)
      : null) ?? enumResult.etalon;

  const productBlock = selectedLayout.productBlock;
  const requiredInner = selectedLayout.innerBox;
  const flatPack = resolveFlatPack(input);
  const geomLiters = volumeLiters(productBlock);
  const occupiedVolumeLiters =
    input.occupiedVolumeLiters != null && input.occupiedVolumeLiters > 0
      ? input.occupiedVolumeLiters
      : selectedLayout.productVolumeLiters || geomLiters;
  const weight = input.weightKg ?? null;
  const notes: string[] = [];

  const fitCtx: FitContext = { mode: "geom", required: requiredInner };

  if (input.shape === "cylinder") {
    notes.push(
      "Круглый / цилиндрический товар → квадратная или прямоугольная коробка по диаметру основания.",
    );
  }
  if (input.shape === "rect") {
    const square =
      Math.abs(input.lengthMm - input.widthMm) < 0.5 &&
      Math.abs(input.widthMm - input.heightMm) < 0.5;
    notes.push(
      square
        ? "Кубический / квадратный штучный товар."
        : "Прямоугольный штучный товар (квадрат — если стороны равны).",
    );
  }
  if (input.shape === "flat_stack") {
    const layout = input.flatLayout ?? "neat_stack";
    notes.push(
      layout === "neat_stack"
        ? `Аккуратная стопка: перебор укладок с S=1 (эталон) и сравнением.`
        : `Слои/россыпь: перебор 1…${input.maxGroups ?? 6} стопок, uniform/brick.`,
    );
    if (input.allowOverlap && (input.overlapMm ?? 0) > 0) {
      notes.push(
        `Наложение ${input.overlapMm} мм на стык в плоскости укладки.`,
      );
    }
  }
  notes.push(
    `Выбрана укладка: ${selectedLayout.summary} → внутр. ${requiredInner.lengthMm}×${requiredInner.widthMm}×${requiredInner.heightMm} мм.`,
  );
  if (input.rotateMode && input.rotateMode !== "none") {
    notes.push(
      input.rotateMode === "planar"
        ? "Поворот: только в плоскости (Д↔Ш)."
        : "Поворот: любой (в т.ч. на бок).",
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
    "Приоритет: укладка → паллет (≥90% в «оптимальных») → пустоты → техдоступ. Эталон (1 стопка) всегда.",
  );

  const customDims = requiredInner;
  const customBox: CatalogBox = {
    id: "custom",
    lengthMm: customDims.lengthMm,
    widthMm: customDims.widthMm,
    heightMm: customDims.heightMm,
    label: `${customDims.lengthMm}×${customDims.widthMm}×${customDims.heightMm}`,
  };
  const custom = makeRecommendation("custom", customBox, fitCtx, weight)!;

  let customTech: BoxRecommendation | null = null;
  // Tech custom from best optimal (or etalon) that already passes tech, else search
  const techFromLayouts = [enumResult.etalon, ...enumResult.optimal].find(
    (l) => l.tech.ok,
  );
  if (
    techFromLayouts &&
    (techFromLayouts.innerBox.lengthMm !== customDims.lengthMm ||
      techFromLayouts.innerBox.widthMm !== customDims.widthMm ||
      techFromLayouts.innerBox.heightMm !== customDims.heightMm)
  ) {
    const techBox: CatalogBox = {
      id: "custom-tech",
      lengthMm: techFromLayouts.innerBox.lengthMm,
      widthMm: techFromLayouts.innerBox.widthMm,
      heightMm: techFromLayouts.innerBox.heightMm,
      label: `${techFromLayouts.innerBox.lengthMm}×${techFromLayouts.innerBox.widthMm}×${techFromLayouts.innerBox.heightMm}`,
    };
    customTech = makeRecommendation(
      "custom",
      techBox,
      { mode: "geom", required: techFromLayouts.innerBox },
      weight,
    );
  } else {
    const techDims = customDimsForTech(fitCtx, occupiedVolumeLiters);
    if (
      techDims &&
      (techDims.lengthMm !== customDims.lengthMm ||
        techDims.widthMm !== customDims.widthMm ||
        techDims.heightMm !== customDims.heightMm)
    ) {
      const techBox: CatalogBox = {
        id: "custom-tech",
        lengthMm: techDims.lengthMm,
        widthMm: techDims.widthMm,
        heightMm: techDims.heightMm,
        label: `${techDims.lengthMm}×${techDims.widthMm}×${techDims.heightMm}`,
      };
      customTech = makeRecommendation("custom", techBox, fitCtx, weight);
    }
  }

  const catalogFits: BoxRecommendation[] = [];
  for (const box of BOX_CATALOG) {
    const rec = makeRecommendation("catalog", box, fitCtx, weight);
    if (rec) catalogFits.push(rec);
  }
  catalogFits.sort(compareRecs);

  const topAll = catalogFits.slice(0, 5);
  const topTech = catalogFits.filter((r) => r.tech.ok).slice(0, 4);
  const topDie = catalogFits.filter((r) => !r.tech.ok).slice(0, 3);
  const merged = new Map<string, BoxRecommendation>();
  for (const r of [...topAll, ...topTech, ...topDie]) {
    merged.set(r.box.id, r);
  }
  const top = [...merged.values()].sort(compareRecs).slice(0, 8);
  if (top[0]) top[0].isBest = true;
  const firstTech = top.find((r) => r.tech.ok);
  if (firstTech) firstTech.isBestTech = true;

  if (
    input.shape === "flat_stack" &&
    input.flatLayout === "loose_bulk" &&
    input.occupiedVolumeLiters != null &&
    input.occupiedVolumeLiters > 0
  ) {
    for (const rec of [custom, customTech, ...top].filter(
      Boolean,
    ) as BoxRecommendation[]) {
      const boxVol =
        (rec.box.lengthMm * rec.box.widthMm * rec.box.heightMm) / 1_000_000;
      if (boxVol + 0.05 < input.occupiedVolumeLiters) {
        rec.warnings.push(
          `Объём коробки ${boxVol.toFixed(1)} л < заявленной россыпи ${input.occupiedVolumeLiters.toFixed(1)} л — может быть тесно при вспухании.`,
        );
      }
    }
  }

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
    ? `Пример: 300×300×80 проходит сторону/сумму WB, но на европаллете 1200×800 даёт ${bad300.alongLength}×${bad300.alongWidth} с остатком ${bad300.leftoverLengthMm || bad300.leftoverWidthMm} мм (покрытие ${Math.round(bad300.coverage * 100)}%) — часто отклоняют при паллетировании. В «оптимальных» скрываем покрытие <90%.`
    : null;

  const techHint =
    "Техлимиты текущего станка: длина ≥ 240 мм, высота ≥ 80 мм, ширина+высота ≥ 280 мм. Подходящие помечены «Техдоступ»; остальные — «Самосбор · штанцформа» (можно заказать вырубной штамп любого размера).";

  return {
    productBlock,
    requiredInner,
    clearanceMm,
    occupiedVolumeLiters,
    flatPack,
    layouts: enumResult.layouts,
    etalon: enumResult.etalon,
    optimal: enumResult.optimal,
    selectedLayout,
    recommendations: top,
    custom,
    customTech,
    notes,
    markingHint,
    palletHint,
    techHint,
  };
}

/** Текущий кейс: 100 пакетиков, укладка с наложением; 6,6 л — вторичная проверка. */
export function presetSachets(): ProductInput {
  return {
    shape: "flat_stack",
    flatLayout: "loose_bulk",
    lengthMm: 150,
    widthMm: 105,
    heightMm: 1.5,
    quantity: 100,
    occupiedVolumeLiters: 6.6,
    allowOverlap: true,
    overlapMm: 15,
    rotateMode: "none",
    dividerMm: 0,
    allowVoidFill: true,
    maxDividerMm: 30,
    maxSideInsertMm: 50,
    maxHeightInsertMm: 80,
    inflateStackFromVolume: false,
    fillHeightFromVolume: false,
    weightKg: null,
    packing: "standard",
    preferredGroupCounts: [2, 4],
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

export function presetRectBox(): ProductInput {
  return {
    shape: "rect",
    lengthMm: 200,
    widthMm: 120,
    heightMm: 80,
    quantity: 1,
    weightKg: null,
    packing: "standard",
  };
}

export function presetSquare(): ProductInput {
  return {
    shape: "rect",
    lengthMm: 100,
    widthMm: 100,
    heightMm: 100,
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

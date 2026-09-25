/**
 * Перебор укладок товара в коробку.
 *
 * Канон = введённые Д×Ш×В (Ø×H). rotateMode: none | planar | full.
 * Score (меньше лучше): паллет exact → coverage; void; tech; поворот; divider.
 * ranked: лучшие по score (для UI: 1 главный + до 3 альтернатив).
 * Flat: neat_stack | stacks (2/4/6/8) | layers (nx×ny×nz без разделителя).
 * allowDivider: допуск картонного разделителя между стопками (не боковые вкладыши).
 */
import {
  bestPalletFit,
  snapToExactPalletBase,
  type PalletFit,
} from "./euro-pallet";
import {
  checkTechAccess,
  type TechAccessResult,
} from "./tech-access";

export type RotateMode = "none" | "planar" | "full";
export type LayoutPattern = "uniform" | "brick";
export type LayoutTag = "best" | "alt" | "weak_pallet";
/** Ось стопки в системе коробки (X=длина, Y=ширина, Z=высота). */
export type StackAxis = "x" | "y" | "z";
export type LayoutShape = "rect" | "cylinder" | "flat_stack";
export type LayoutPacking = "tight" | "standard" | "bubble" | "fragile";
/** neat_stack = одна стопка; stacks = 2/4/6/8; layers = слои без стопок; loose_bulk → stacks */
export type LayoutFlatMode =
  | "neat_stack"
  | "stacks"
  | "layers"
  | "loose_bulk";

export const OPTIMAL_PALLET_MIN_COVERAGE = 0.9;
export const DEFAULT_STACK_COUNTS = [2, 4, 6, 8] as const;
export const RANKED_LAYOUT_LIMIT = 4;

export interface Dims {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export interface UnitOrient {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

/** Поля ввода, нужные перебору (подмножество ProductInput). */
export interface LayoutEnumerateInput {
  shape: LayoutShape;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  diameterMm?: number;
  quantity: number;
  packing: LayoutPacking;
  flatLayout?: LayoutFlatMode;
  occupiedVolumeLiters?: number | null;
  allowOverlap?: boolean;
  overlapMm?: number;
  rotateMode?: RotateMode;
  rowMatchTolMm?: number;
  roundStepMm?: number;
  maxGroups?: number;
  preferredGroupCounts?: number[];
  /**
   * Допуск разделителя между стопками (модель подбирает 0…maxDividerMm).
   * Не раздувает L/W/H боковыми/высотными вкладышами.
   */
  allowDivider?: boolean;
  /** @deprecated → allowDivider */
  allowVoidFill?: boolean;
  /** Макс. толщина разделителя, мм (default 30) */
  maxDividerMm?: number;
  /** Фикс. разделитель, если allowDivider выкл; иначе подсказка */
  dividerMm?: number;
  /** @deprecated используйте dividerMm */
  interStackGapMm?: number;
  maxStackHeightMm?: number | null;
  wallThicknessMm?: number;
  inflateStackFromVolume?: boolean;
  fillHeightFromVolume?: boolean;
  /** Предпочитать exact-паллет в score */
  preferExactPallet?: boolean;
  /** Допустимый недобор объёма коробки к occupied, л */
  maxVolumeUnderfillLiters?: number | null;
}

export interface VoidFillInfo {
  /** Разделитель между стопками, мм */
  dividerMm: number;
  /** Запас по длине сверх 2×clearance, мм */
  sideInsertLMm: number;
  /** Запас по ширине сверх 2×clearance, мм */
  sideInsertWMm: number;
  /** Запас по высоте сверх стопки+2×clearance, мм */
  heightInsertMm: number;
  summary: string;
}

export interface LayoutCandidate {
  id: string;
  groupCount: number;
  perStack: number;
  nx: number;
  ny: number;
  nz: number;
  pattern: LayoutPattern;
  /** Куда растёт стопка: z=стоя, x/y=лёжа на паллете */
  stackAxis: StackAxis;
  unitOrient: UnitOrient;
  rotatedFromCanon: boolean;
  productBlock: Dims;
  innerBox: Dims;
  tEff: number;
  geomVolumeLiters: number;
  productVolumeLiters: number;
  pallet: PalletFit;
  tech: TechAccessResult;
  voidRatio: number;
  score: number;
  tags: LayoutTag[];
  summary: string;
  voidFill?: VoidFillInfo;
}

export interface EnumerateLayoutsResult {
  /** Все уникальные кандидаты, по score */
  layouts: LayoutCandidate[];
  /** Лучшие для UI: [0]=главный, далее до 3 альтернатив */
  ranked: LayoutCandidate[];
}

function clearanceForPacking(mode: LayoutPacking): number {
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

function volumeLiters(dims: Dims): number {
  return (dims.lengthMm * dims.widthMm * dims.heightMm) / 1_000_000;
}

/** Длина ряда с возможным наложением. */
export function spanWithOverlap(
  unitMm: number,
  count: number,
  overlapMm: number,
): number {
  const n = Math.max(1, Math.floor(count));
  if (n <= 1) return unitMm;
  const capped = Math.max(0, Math.min(overlapMm, unitMm * 0.45));
  const pitch = unitMm - capped;
  return unitMm + (n - 1) * pitch;
}

function roundUp(n: number, step: number): number {
  const s = Math.max(1, step);
  return Math.ceil(n / s) * s;
}

function roundUpDims(d: Dims, step: number): Dims {
  return {
    lengthMm: roundUp(d.lengthMm, step),
    widthMm: roundUp(d.widthMm, step),
    heightMm: roundUp(d.heightMm, step),
  };
}

function addClearanceDims(d: Dims, clearanceMm: number): Dims {
  const pad = clearanceMm * 2;
  return {
    lengthMm: d.lengthMm + pad,
    widthMm: d.widthMm + pad,
    heightMm: d.heightMm + pad,
  };
}

function sameOrient(a: UnitOrient, b: UnitOrient, eps = 0.05): boolean {
  return (
    Math.abs(a.lengthMm - b.lengthMm) < eps &&
    Math.abs(a.widthMm - b.widthMm) < eps &&
    Math.abs(a.heightMm - b.heightMm) < eps
  );
}

function uniqueOrients(list: UnitOrient[]): UnitOrient[] {
  const out: UnitOrient[] = [];
  for (const o of list) {
    if (!out.some((x) => sameOrient(x, o))) out.push(o);
  }
  return out;
}

function permute3(a: number, b: number, c: number): UnitOrient[] {
  return uniqueOrients([
    { lengthMm: a, widthMm: b, heightMm: c },
    { lengthMm: a, widthMm: c, heightMm: b },
    { lengthMm: b, widthMm: a, heightMm: c },
    { lengthMm: b, widthMm: c, heightMm: a },
    { lengthMm: c, widthMm: a, heightMm: b },
    { lengthMm: c, widthMm: b, heightMm: a },
  ]);
}

/** Ориентации единицы по rotateMode и форме. */
export function unitOrientations(input: LayoutEnumerateInput): {
  canon: UnitOrient;
  orients: UnitOrient[];
} {
  const mode = input.rotateMode ?? "none";

  if (input.shape === "cylinder") {
    const d = input.diameterMm ?? input.lengthMm;
    const h = input.heightMm;
    const canon: UnitOrient = { lengthMm: d, widthMm: d, heightMm: h };
    if (mode === "none" || mode === "planar") {
      return { canon, orients: [canon] };
    }
    return {
      canon,
      orients: uniqueOrients([
        canon,
        { lengthMm: h, widthMm: d, heightMm: d },
        { lengthMm: d, widthMm: h, heightMm: d },
      ]),
    };
  }

  const L = input.lengthMm;
  const W = input.widthMm;
  const H = input.heightMm;
  const canon: UnitOrient = { lengthMm: L, widthMm: W, heightMm: H };

  if (mode === "none") return { canon, orients: [canon] };
  if (mode === "planar") {
    return {
      canon,
      orients: uniqueOrients([
        canon,
        { lengthMm: W, widthMm: L, heightMm: H },
      ]),
    };
  }
  return { canon, orients: permute3(L, W, H) };
}

/** Эффективная толщина плоской единицы. */
export function effectiveThicknessMm(input: LayoutEnumerateInput): number {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const nominal = Math.max(0.1, input.heightMm);
  const inflate = input.inflateStackFromVolume === true;
  if (
    inflate &&
    input.shape === "flat_stack" &&
    input.occupiedVolumeLiters != null &&
    input.occupiedVolumeLiters > 0
  ) {
    const face = Math.max(1, input.lengthMm * input.widthMm);
    const tEff =
      (input.occupiedVolumeLiters * 1_000_000) / (face * qty);
    return Math.max(nominal, tEff);
  }
  return nominal;
}

function stackGapMm(input: LayoutEnumerateInput): number {
  return Math.max(0, input.dividerMm ?? input.interStackGapMm ?? 0);
}

/** Между стопками: разделитель; overlap только если разделителя нет. */
function planePackingGaps(input: LayoutEnumerateInput): {
  overlapMm: number;
  gapMm: number;
} {
  const gap = stackGapMm(input);
  if (gap > 0) return { overlapMm: 0, gapMm: gap };
  const overlap =
    input.allowOverlap && (input.overlapMm ?? 0) > 0 ? input.overlapMm! : 0;
  return { overlapMm: overlap, gapMm: 0 };
}

function spanAxis(
  unitMm: number,
  count: number,
  overlapMm: number,
  gapMm: number,
): number {
  const n = Math.max(1, Math.floor(count));
  if (n <= 1) return unitMm;
  if (overlapMm > 0) return spanWithOverlap(unitMm, n, overlapMm);
  return unitMm * n + Math.max(0, gapMm) * (n - 1);
}

/** Сетки nx×ny с nx*ny ≥ S (без огромного перебора). */
export function gridsForGroups(S: number): [number, number][] {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  const add = (nx: number, ny: number) => {
    if (nx * ny < S) return;
    const key = `${nx}x${ny}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([nx, ny]);
  };
  for (let nx = 1; nx <= S; nx++) {
    if (S % nx === 0) add(nx, S / nx);
  }
  for (let nx = 1; nx <= S; nx++) {
    const ny = Math.ceil(S / nx);
    add(nx, ny);
  }
  return pairs;
}

function scoreLayout(args: {
  pallet: PalletFit;
  voidRatio: number;
  techOk: boolean;
  rotatedFromCanon: boolean;
  preferred: boolean;
  maxSideMm: number;
  minSideMm: number;
  voidFill?: VoidFillInfo | null;
  underfillLiters?: number;
  preferExactPallet?: boolean;
  maxVolumeUnderfillLiters?: number | null;
}): number {
  const {
    pallet,
    voidRatio,
    techOk,
    rotatedFromCanon,
    preferred,
    maxSideMm,
    minSideMm,
    voidFill,
    preferExactPallet = true,
  } = args;
  let score = 0;
  if (pallet.exact) {
    score += 0;
  } else if (pallet.ok) {
    score += (1 - pallet.coverage) * 100;
    if (pallet.coverage < OPTIMAL_PALLET_MIN_COVERAGE) score += 50;
  } else {
    score += 120;
  }
  // Геометрическая пустота (блок товара vs коробка) — главный штраф плотности
  score += voidRatio * 120;
  // occupiedVolumeLiters не влияет на score — только справка в UI
  if (!techOk) score += 8;
  if (rotatedFromCanon) score += 2;
  if (preferred) score -= 3;
  if (preferExactPallet && pallet.exact) score -= 12;
  else if (pallet.exact) score -= 6;
  if (voidFill) {
    score += voidFill.dividerMm * 0.04;
    score += voidFill.sideInsertLMm * 0.4 + voidFill.sideInsertWMm * 0.4;
    score += voidFill.heightInsertMm * 0.2;
  }
  score += maxSideMm / 1000;
  // Отсев «лапши» 800×40 и подобных
  const aspect = maxSideMm / Math.max(minSideMm, 1);
  if (aspect > 4) score += (aspect - 4) * 25;
  if (maxSideMm > 500) score += (maxSideMm - 500) * 0.15;
  return score;
}

/** Запас по бокам при лучшем совмещении осей коробки и блока товара. */
function planarSideInserts(
  boxL: number,
  boxW: number,
  blockL: number,
  blockW: number,
  pad: number,
): { sideInsertLMm: number; sideInsertWMm: number } {
  const variants = [
    { l: boxL - blockL - pad, w: boxW - blockW - pad },
    { l: boxL - blockW - pad, w: boxW - blockL - pad },
  ];
  let best: { l: number; w: number } | null = null;
  for (const v of variants) {
    if (v.l < -0.05 || v.w < -0.05) continue;
    const score = Math.max(0, v.l) + Math.max(0, v.w);
    if (
      !best ||
      score < Math.max(0, best.l) + Math.max(0, best.w)
    ) {
      best = v;
    }
  }
  if (!best) {
    return {
      sideInsertLMm: Math.max(0, boxL - blockL - pad),
      sideInsertWMm: Math.max(0, boxW - blockW - pad),
    };
  }
  return {
    sideInsertLMm: Math.max(0, Math.round(best.l * 10) / 10),
    sideInsertWMm: Math.max(0, Math.round(best.w * 10) / 10),
  };
}

/** Длинная сторона основания → length (канон Д×Ш×В). */
function normalizeBaseOrientation(dims: Dims): Dims {
  if (dims.lengthMm + 0.05 >= dims.widthMm) return dims;
  return {
    lengthMm: dims.widthMm,
    widthMm: dims.lengthMm,
    heightMm: dims.heightMm,
  };
}

/** Кандидаты высоты при snap: номинал, техминимум, опционально объём. */
function snapHeightCandidates(args: {
  reqH: number;
  baseL: number;
  baseW: number;
  maxHeightInsert: number;
  roundStep: number;
  fillFromVolume: boolean;
  liters: number | null;
}): number[] {
  const {
    reqH,
    baseL,
    baseW,
    maxHeightInsert,
    roundStep,
    fillFromVolume,
    liters,
  } = args;
  const h0 = Math.max(80, roundUp(reqH, roundStep));
  const hCap = reqH + maxHeightInsert;
  const out = new Set<number>();
  if (h0 <= hCap + 0.05) out.add(h0);

  for (let h = h0; h <= hCap + 0.05; h += roundStep) {
    if (checkTechAccess(baseL, baseW, h).ok) {
      out.add(h);
      break;
    }
  }

  if (fillFromVolume && liters != null && liters > 0) {
    const needH = (liters * 1_000_000) / (baseL * baseW);
    const capped = Math.min(needH, hCap);
    if (capped + 0.05 >= reqH) {
      out.add(Math.max(h0, roundUp(capped, roundStep)));
    }
  }

  return [...out]
    .filter((h) => h + 0.05 >= reqH && h <= hCap + 0.05)
    .sort((a, b) => a - b);
}

function buildCandidate(args: {
  id: string;
  groupCount: number;
  perStack: number;
  nx: number;
  ny: number;
  nz: number;
  pattern: LayoutPattern;
  unitOrient: UnitOrient;
  canon: UnitOrient;
  productBlock: Dims;
  clearanceMm: number;
  roundStepMm: number;
  wallThicknessMm: number;
  productVolumeLiters: number;
  tEff: number;
  preferredGroupCounts?: number[];
  stackAxis?: StackAxis;
  forcedInner?: Dims;
  dividerMm?: number;
  preferExactPallet?: boolean;
}): LayoutCandidate {
  const {
    id,
    groupCount,
    perStack,
    nx,
    ny,
    nz,
    pattern,
    unitOrient,
    canon,
    productBlock,
    clearanceMm,
    roundStepMm,
    wallThicknessMm,
    productVolumeLiters,
    tEff,
    preferredGroupCounts,
    stackAxis = "z",
    forcedInner,
    dividerMm = 0,
    preferExactPallet = true,
  } = args;

  const rawInner =
    forcedInner ??
    roundUpDims(addClearanceDims(productBlock, clearanceMm), roundStepMm);
  // Канон подписи: длина ≥ ширины основания
  const innerBox = normalizeBaseOrientation(rawInner);
  const outer =
    wallThicknessMm > 0
      ? {
          lengthMm: innerBox.lengthMm + 2 * wallThicknessMm,
          widthMm: innerBox.widthMm + 2 * wallThicknessMm,
          heightMm: innerBox.heightMm + 2 * wallThicknessMm,
        }
      : innerBox;

  const pallet = bestPalletFit(outer);
  const tech = checkTechAccess(
    innerBox.lengthMm,
    innerBox.widthMm,
    innerBox.heightMm,
  );
  const boxVol = volumeLiters(innerBox);
  // Пустота = геометрия блока vs коробка (не заявленные литры россыпи)
  const geomProductVol = volumeLiters(productBlock);
  const voidRatio =
    boxVol > 0 ? Math.max(0, (boxVol - geomProductVol) / boxVol) : 1;
  const rotatedFromCanon = !sameOrient(unitOrient, canon);
  const preferred = Boolean(
    preferredGroupCounts?.includes(groupCount) && groupCount > 1,
  );
  const maxSideMm = Math.max(
    innerBox.lengthMm,
    innerBox.widthMm,
    innerBox.heightMm,
  );
  const minSideMm = Math.min(
    innerBox.lengthMm,
    innerBox.widthMm,
    innerBox.heightMm,
  );

  const pad = clearanceMm * 2;
  const { sideInsertLMm, sideInsertWMm } = planarSideInserts(
    innerBox.lengthMm,
    innerBox.widthMm,
    productBlock.lengthMm,
    productBlock.widthMm,
    pad,
  );
  const heightInsertMm = Math.max(
    0,
    Math.round((innerBox.heightMm - productBlock.heightMm - pad) * 10) / 10,
  );
  const hasFill =
    dividerMm > 0.05 ||
    sideInsertLMm > roundStepMm + 0.05 ||
    sideInsertWMm > roundStepMm + 0.05 ||
    heightInsertMm > roundStepMm + 0.05;
  const voidFill: VoidFillInfo | undefined =
    dividerMm > 0.05 || hasFill
      ? {
          dividerMm,
          sideInsertLMm,
          sideInsertWMm,
          heightInsertMm,
          summary: [
            dividerMm > 0.05 ? `разделитель ${dividerMm} мм` : null,
            sideInsertLMm > roundStepMm + 0.05 ||
            sideInsertWMm > roundStepMm + 0.05
              ? `бока +${Math.round(sideInsertLMm)}/+${Math.round(sideInsertWMm)} мм`
              : null,
            heightInsertMm > roundStepMm + 0.05
              ? `высота +${Math.round(heightInsertMm)} мм`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : undefined;

  const score = scoreLayout({
    pallet,
    voidRatio,
    techOk: tech.ok,
    rotatedFromCanon,
    preferred,
    maxSideMm,
    minSideMm,
    voidFill,
    preferExactPallet,
  });

  const tags: LayoutTag[] = [];
  if (
    !(
      pallet.ok &&
      (pallet.exact || pallet.coverage >= OPTIMAL_PALLET_MIN_COVERAGE)
    )
  ) {
    tags.push("weak_pallet");
  }

  const pose = stackAxis === "z" ? "стоя" : "лёжа";
  const fillNote = dividerMm > 0.05 ? ` · разделитель ${dividerMm} мм` : "";
  const summary = `${groupCount} гр. · ${pose}${fillNote} · сетка ${nx}×${ny}${nz > 1 ? `×${nz}` : ""} · ${pattern} · ${Math.round(unitOrient.lengthMm)}×${Math.round(unitOrient.widthMm)}×${Math.round(unitOrient.heightMm)}`;

  return {
    id,
    groupCount,
    perStack,
    nx,
    ny,
    nz,
    pattern,
    stackAxis,
    unitOrient,
    rotatedFromCanon,
    productBlock: {
      lengthMm: Math.round(productBlock.lengthMm * 10) / 10,
      widthMm: Math.round(productBlock.widthMm * 10) / 10,
      heightMm: Math.round(productBlock.heightMm * 10) / 10,
    },
    innerBox,
    tEff,
    geomVolumeLiters: volumeLiters(productBlock),
    productVolumeLiters,
    pallet,
    tech,
    voidRatio,
    score,
    tags,
    summary,
    voidFill,
  };
}

/**
 * Эталон удалён — функция оставлена как no-op совместимости (не используется).
 * @deprecated
 */
export function orientEtalonLying(
  standing: LayoutCandidate,
  _opts?: unknown,
): LayoutCandidate {
  return standing;
}

/** Footprint в плоскости; brick отклоняется, если ряды не сходятся по длине. */
export function planeFootprint(
  footL: number,
  footW: number,
  nx: number,
  ny: number,
  pattern: LayoutPattern,
  overlapMm: number,
  gapMm: number,
  rowMatchTolMm: number,
): { lengthMm: number; widthMm: number } | null {
  if (pattern === "uniform") {
    return {
      lengthMm: spanAxis(footL, nx, overlapMm, gapMm),
      widthMm: spanAxis(footW, ny, overlapMm, gapMm),
    };
  }

  const row1Len = spanAxis(footL, nx, overlapMm, gapMm);
  const row2Len = spanAxis(footW, nx, overlapMm, gapMm);
  if (Math.abs(row1Len - row2Len) > rowMatchTolMm) return null;

  const spanX = Math.max(row1Len, row2Len);
  let y = 0;
  for (let r = 0; r < ny; r++) {
    const depth = r % 2 === 0 ? footW : footL;
    y = r === 0 ? depth : y + depth + gapMm;
  }
  return { lengthMm: spanX, widthMm: y };
}

function dividerAllowed(input: LayoutEnumerateInput): boolean {
  return input.allowDivider === true || input.allowVoidFill === true;
}

function resolveFlatMode(
  input: LayoutEnumerateInput,
): "neat_stack" | "stacks" | "layers" {
  const m = input.flatLayout ?? "stacks";
  if (m === "neat_stack") return "neat_stack";
  if (m === "layers") return "layers";
  return "stacks"; // stacks | loose_bulk
}

function dividerCandidates(input: LayoutEnumerateInput): number[] {
  if (dividerAllowed(input)) {
    const maxD = Math.max(0, input.maxDividerMm ?? 30);
    const steps: number[] = [0];
    for (let d = 5; d <= maxD; d += 5) steps.push(d);
    if (maxD > 0 && !steps.includes(maxD)) steps.push(maxD);
    const hint = input.dividerMm ?? input.interStackGapMm;
    if (hint != null && hint > 0 && hint <= maxD && !steps.includes(hint)) {
      steps.push(hint);
    }
    return [...new Set(steps)].sort((a, b) => a - b);
  }
  return [stackGapMm(input)];
}

function stackGroupCounts(input: LayoutEnumerateInput, qty: number): number[] {
  const preferred = input.preferredGroupCounts?.length
    ? input.preferredGroupCounts
    : [...DEFAULT_STACK_COUNTS];
  const maxG = Math.min(input.maxGroups ?? 8, qty);
  return preferred
    .filter((s) => s >= 2 && s <= maxG && qty >= s)
    .sort((a, b) => a - b);
}

function enumerateFlat(
  input: LayoutEnumerateInput,
  canon: UnitOrient,
  orients: UnitOrient[],
  clearanceMm: number,
): LayoutCandidate[] {
  const mode = resolveFlatMode(input);
  if (mode === "layers") {
    return enumerateFlatLayers(input, canon, orients, clearanceMm);
  }

  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const tol = input.rowMatchTolMm ?? 8;
  const roundStep = input.roundStepMm ?? 5;
  const wall = input.wallThicknessMm ?? 0;
  const maxH = input.maxStackHeightMm ?? null;
  const tEff = effectiveThicknessMm(input);
  const productVolumeLiters =
    (input.lengthMm * input.widthMm * input.heightMm * qty) / 1_000_000;

  let groupCounts =
    mode === "neat_stack" ? [1] : stackGroupCounts(input, qty);
  if (groupCounts.length === 0) {
    groupCounts = [Math.min(2, qty)];
  }

  const dividers =
    mode === "neat_stack" ? [0] : dividerCandidates(input);
  const overlapOnly =
    input.allowOverlap &&
    (input.overlapMm ?? 0) > 0 &&
    !dividerAllowed(input)
      ? input.overlapMm!
      : input.allowOverlap && (input.overlapMm ?? 0) > 0
        ? input.overlapMm!
        : 0;

  const out: LayoutCandidate[] = [];
  let seq = 0;
  const scoreOpts = {
    preferExactPallet: input.preferExactPallet !== false,
  };

  for (const divider of dividers) {
    const overlap = divider > 0 ? 0 : overlapOnly;
    const gap = divider;

    for (const orient of orients) {
      const footL = orient.lengthMm;
      const footW = orient.widthMm;

      for (const S of groupCounts) {
        const k = Math.ceil(qty / S);
        const stackH = k * tEff;
        if (maxH != null && stackH > maxH) continue;

        for (const [nx, ny] of gridsForGroups(S)) {
          for (const pattern of ["uniform", "brick"] as LayoutPattern[]) {
            const fp = planeFootprint(
              footL,
              footW,
              nx,
              ny,
              pattern,
              overlap,
              gap,
              tol,
            );
            if (!fp) continue;

            seq += 1;
            out.push(
              buildCandidate({
                id: `flat-${seq}-d${divider}-${S}-${nx}x${ny}-${pattern}`,
                groupCount: S,
                perStack: k,
                nx,
                ny,
                nz: 1,
                pattern,
                unitOrient: {
                  lengthMm: footL,
                  widthMm: footW,
                  heightMm: tEff,
                },
                canon: {
                  lengthMm: canon.lengthMm,
                  widthMm: canon.widthMm,
                  heightMm: tEff,
                },
                productBlock: {
                  lengthMm: fp.lengthMm,
                  widthMm: fp.widthMm,
                  heightMm: stackH,
                },
                clearanceMm,
                roundStepMm: roundStep,
                wallThicknessMm: wall,
                productVolumeLiters,
                tEff,
                preferredGroupCounts: input.preferredGroupCounts ?? [
                  ...DEFAULT_STACK_COUNTS,
                ],
                dividerMm: divider,
                ...scoreOpts,
              }),
            );
          }
        }
      }
    }
  }

  return out;
}

/** Слои врассыпную: nx×ny в плоскости × nz по высоте, без разделителя стопок. */
function enumerateFlatLayers(
  input: LayoutEnumerateInput,
  canon: UnitOrient,
  orients: UnitOrient[],
  clearanceMm: number,
): LayoutCandidate[] {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const tol = input.rowMatchTolMm ?? 8;
  const roundStep = input.roundStepMm ?? 5;
  const wall = input.wallThicknessMm ?? 0;
  const tEff = effectiveThicknessMm(input);
  const productVolumeLiters =
    (input.lengthMm * input.widthMm * input.heightMm * qty) / 1_000_000;
  const overlap =
    input.allowOverlap && (input.overlapMm ?? 0) > 0 ? input.overlapMm! : 0;
  const scoreOpts = {
    preferExactPallet: input.preferExactPallet !== false,
  };

  const out: LayoutCandidate[] = [];
  let seq = 0;
  const maxCells = Math.min(qty, 24);

  for (const orient of orients) {
    const footL = orient.lengthMm;
    const footW = orient.widthMm;
    for (let nx = 1; nx <= maxCells; nx++) {
      for (let ny = 1; ny <= Math.ceil(maxCells / nx); ny++) {
        const perLayer = nx * ny;
        if (perLayer > qty && nx > 1 && ny > 1) continue;
        for (const pattern of ["uniform", "brick"] as LayoutPattern[]) {
          const fp = planeFootprint(
            footL,
            footW,
            nx,
            ny,
            pattern,
            overlap,
            0,
            tol,
          );
          if (!fp) continue;
          seq += 1;
          const cells = nx * ny;
          const perCell = Math.ceil(qty / cells);
          out.push(
            buildCandidate({
              id: `layers-${seq}-${nx}x${ny}x${perCell}-${pattern}`,
              groupCount: cells,
              perStack: perCell,
              nx,
              ny,
              nz: perCell,
              pattern,
              unitOrient: {
                lengthMm: footL,
                widthMm: footW,
                heightMm: tEff,
              },
              canon: {
                lengthMm: canon.lengthMm,
                widthMm: canon.widthMm,
                heightMm: tEff,
              },
              productBlock: {
                lengthMm: fp.lengthMm,
                widthMm: fp.widthMm,
                heightMm: perCell * tEff,
              },
              clearanceMm,
              roundStepMm: roundStep,
              wallThicknessMm: wall,
              productVolumeLiters,
              tEff,
              preferredGroupCounts: input.preferredGroupCounts,
              dividerMm: 0,
              ...scoreOpts,
            }),
          );
        }
      }
    }
  }
  return out;
}

function enumerateRect(
  input: LayoutEnumerateInput,
  canon: UnitOrient,
  orients: UnitOrient[],
  clearanceMm: number,
): LayoutCandidate[] {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const maxGroups = Math.max(1, Math.min(input.maxGroups ?? 6, qty));
  const { overlapMm: overlap, gapMm: gap } = planePackingGaps(input);
  const tol = input.rowMatchTolMm ?? 8;
  const roundStep = input.roundStepMm ?? 5;
  const wall = input.wallThicknessMm ?? 0;
  const maxH = input.maxStackHeightMm ?? null;
  const productVolumeLiters =
    (input.lengthMm * input.widthMm * input.heightMm * qty) / 1_000_000;

  const out: LayoutCandidate[] = [];
  let seq = 0;

  for (const orient of orients) {
    const uL = orient.lengthMm;
    const uW = orient.widthMm;
    const uH = orient.heightMm;

    for (let S = 1; S <= maxGroups; S++) {
      const k = Math.ceil(qty / S);
      const stackH = k * uH;
      if (maxH != null && stackH > maxH) continue;

      for (const [nx, ny] of gridsForGroups(S)) {
        for (const pattern of ["uniform", "brick"] as LayoutPattern[]) {
          const fp = planeFootprint(
            uL,
            uW,
            nx,
            ny,
            pattern,
            overlap,
            gap,
            tol,
          );
          if (!fp) continue;

          seq += 1;
          out.push(
            buildCandidate({
              id: `rect-${seq}-${S}-${nx}x${ny}-${pattern}`,
              groupCount: S,
              perStack: k,
              nx,
              ny,
              nz: k,
              pattern,
              unitOrient: orient,
              canon,
              productBlock: {
                lengthMm: fp.lengthMm,
                widthMm: fp.widthMm,
                heightMm: stackH,
              },
              clearanceMm,
              roundStepMm: roundStep,
              wallThicknessMm: wall,
              productVolumeLiters,
              tEff: uH,
              preferredGroupCounts: input.preferredGroupCounts,
            }),
          );
        }
      }
    }
  }

  return out;
}

function enumerateCylinder(
  input: LayoutEnumerateInput,
  canon: UnitOrient,
  orients: UnitOrient[],
  clearanceMm: number,
): LayoutCandidate[] {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const maxGroups = Math.max(1, Math.min(input.maxGroups ?? 6, qty));
  const gap = stackGapMm(input);
  const roundStep = input.roundStepMm ?? 5;
  const wall = input.wallThicknessMm ?? 0;
  const maxH = input.maxStackHeightMm ?? null;
  const d0 = input.diameterMm ?? input.lengthMm;
  const productVolumeLiters =
    (Math.PI * (d0 / 2) ** 2 * input.heightMm * qty) / 1_000_000;

  const out: LayoutCandidate[] = [];
  let seq = 0;

  for (const orient of orients) {
    const uL = orient.lengthMm;
    const uW = orient.widthMm;
    const uH = orient.heightMm;

    for (let S = 1; S <= maxGroups; S++) {
      const k = Math.ceil(qty / S);
      const stackH = k * uH;
      if (maxH != null && stackH > maxH) continue;

      for (const [nx, ny] of gridsForGroups(S)) {
        seq += 1;
        out.push(
          buildCandidate({
            id: `cyl-${seq}-${S}-${nx}x${ny}`,
            groupCount: S,
            perStack: k,
            nx,
            ny,
            nz: 1,
            pattern: "uniform",
            unitOrient: orient,
            canon,
            productBlock: {
              lengthMm: spanAxis(uL, nx, 0, gap),
              widthMm: spanAxis(uW, ny, 0, gap),
              heightMm: stackH,
            },
            clearanceMm,
            roundStepMm: roundStep,
            wallThicknessMm: wall,
            productVolumeLiters,
            tEff: uH,
            preferredGroupCounts: input.preferredGroupCounts,
          }),
        );
      }
    }
  }

  return out;
}

function dedupeLayouts(list: LayoutCandidate[]): LayoutCandidate[] {
  const map = new Map<string, LayoutCandidate>();
  for (const c of list) {
    const key = [
      c.groupCount,
      c.nx,
      c.ny,
      c.nz,
      c.pattern,
      Math.round(c.innerBox.lengthMm),
      Math.round(c.innerBox.widthMm),
      Math.round(c.innerBox.heightMm),
      Math.round(c.unitOrient.lengthMm),
      Math.round(c.unitOrient.widthMm),
      Math.round(c.unitOrient.heightMm),
    ].join("|");
    const prev = map.get(key);
    if (!prev || c.score < prev.score) map.set(key, c);
  }
  return [...map.values()];
}

/**
 * Snap к exact-паллету только если запас по бокам ≤ roundStep
 * (без толстых боковых/высотных вкладышей). Высота из объёма — только fillHeightFromVolume.
 * Tech: поднять H минимально, пока W+H позволяет (в пределах ~80 мм).
 */
export function snapLayoutsToExactPallet(
  layouts: LayoutCandidate[],
  input: LayoutEnumerateInput,
  clearanceMm: number,
  canon: UnitOrient,
): LayoutCandidate[] {
  const roundStep = input.roundStepMm ?? 5;
  const maxSide = roundStep;
  const maxTechH = 80;
  const wall = input.wallThicknessMm ?? 0;
  const fillVol = input.fillHeightFromVolume === true;
  const liters =
    input.occupiedVolumeLiters != null && input.occupiedVolumeLiters > 0
      ? input.occupiedVolumeLiters
      : null;
  const scoreOpts = {
    preferExactPallet: input.preferExactPallet !== false,
  };
  const extra: LayoutCandidate[] = [];

  for (const layout of layouts) {
    if (layout.groupCount < 1) continue;
    const pad = clearanceMm * 2;
    const reqL = layout.productBlock.lengthMm + pad;
    const reqW = layout.productBlock.widthMm + pad;
    const reqH = layout.productBlock.heightMm + pad;

    const snap = snapToExactPalletBase(reqL, reqW);
    if (!snap) continue;

    const base = normalizeBaseOrientation({
      lengthMm: snap.lengthMm,
      widthMm: snap.widthMm,
      heightMm: 0,
    });

    const sides = planarSideInserts(
      base.lengthMm,
      base.widthMm,
      layout.productBlock.lengthMm,
      layout.productBlock.widthMm,
      pad,
    );
    if (
      sides.sideInsertLMm > maxSide + 0.05 ||
      sides.sideInsertWMm > maxSide + 0.05
    ) {
      continue;
    }

    if (
      Math.abs(base.lengthMm - layout.innerBox.lengthMm) < 0.5 &&
      Math.abs(base.widthMm - layout.innerBox.widthMm) < 0.5 &&
      layout.pallet.exact
    ) {
      continue;
    }

    const heights = snapHeightCandidates({
      reqH,
      baseL: base.lengthMm,
      baseW: base.widthMm,
      // Не раздуваем H «ради техлимитов» — это создаёт 40%+ пустоты сверху.
      // Тех-кандидат с подъёмом H остаётся только если fillHeightFromVolume.
      maxHeightInsert: fillVol ? maxTechH : roundStep,
      roundStep,
      fillFromVolume: fillVol,
      liters,
    });

    const dividerMm = layout.voidFill?.dividerMm ?? 0;

    for (const h of heights) {
      // Не предлагать H = стороне основания ради «ровности» — только tech/объём
      const forcedInner: Dims = {
        lengthMm: base.lengthMm,
        widthMm: base.widthMm,
        heightMm: h,
      };

      if (
        !(
          (forcedInner.lengthMm + 0.05 >= reqL &&
            forcedInner.widthMm + 0.05 >= reqW) ||
          (forcedInner.lengthMm + 0.05 >= reqW &&
            forcedInner.widthMm + 0.05 >= reqL)
        ) ||
        forcedInner.heightMm + 0.05 < reqH
      ) {
        continue;
      }

      extra.push(
        buildCandidate({
          id: `${layout.id}-pallet-snap-h${h}`,
          groupCount: layout.groupCount,
          perStack: layout.perStack,
          nx: layout.nx,
          ny: layout.ny,
          nz: layout.nz,
          pattern: layout.pattern,
          unitOrient: layout.unitOrient,
          canon,
          productBlock: layout.productBlock,
          clearanceMm,
          roundStepMm: roundStep,
          wallThicknessMm: wall,
          productVolumeLiters: layout.productVolumeLiters,
          tEff: layout.tEff,
          preferredGroupCounts: input.preferredGroupCounts,
          stackAxis: layout.stackAxis,
          forcedInner,
          dividerMm,
          ...scoreOpts,
        }),
      );
    }
  }

  return extra;
}

/** Отсечь непрактичные коробки (лапша 800×40, огромный maxSide). */
export function isPracticalBox(box: Dims): boolean {
  const sides = [box.lengthMm, box.widthMm, box.heightMm].sort(
    (a, b) => b - a,
  );
  const maxS = sides[0]!;
  const minS = sides[2]!;
  if (maxS > 500) return false;
  if (maxS / Math.max(minS, 1) > 5) return false;
  return true;
}

/**
 * Полный перебор укладок → ranked (лучший + альтернативы).
 */
export function enumerateLayouts(
  input: LayoutEnumerateInput,
): EnumerateLayoutsResult {
  const clearanceMm = clearanceForPacking(input.packing);
  const { canon, orients } = unitOrientations(input);

  let raw: LayoutCandidate[] = [];
  if (input.shape === "flat_stack") {
    raw = enumerateFlat(input, canon, orients, clearanceMm);
  } else if (input.shape === "cylinder") {
    raw = enumerateCylinder(input, canon, orients, clearanceMm);
  } else {
    raw = enumerateRect(input, canon, orients, clearanceMm);
  }

  if (raw.length === 0) {
    const u = orients[0] ?? canon;
    raw = [
      buildCandidate({
        id: "fallback-1",
        groupCount: 1,
        perStack: Math.max(1, Math.floor(input.quantity) || 1),
        nx: 1,
        ny: 1,
        nz: 1,
        pattern: "uniform",
        unitOrient: u,
        canon,
        productBlock: {
          lengthMm: u.lengthMm,
          widthMm: u.widthMm,
          heightMm:
            u.heightMm * Math.max(1, Math.floor(input.quantity) || 1),
        },
        clearanceMm,
        roundStepMm: input.roundStepMm ?? 5,
        wallThicknessMm: input.wallThicknessMm ?? 0,
        productVolumeLiters: volumeLiters({
          lengthMm: input.lengthMm,
          widthMm: input.widthMm,
          heightMm: input.heightMm,
        }),
        tEff: u.heightMm,
        preferredGroupCounts: input.preferredGroupCounts,
        preferExactPallet: input.preferExactPallet !== false,
      }),
    ];
  }

  const snapped = snapLayoutsToExactPallet(raw, input, clearanceMm, canon);
  const layouts = dedupeLayouts([...raw, ...snapped]);
  layouts.sort((a, b) => a.score - b.score);

  const practical = layouts.filter((c) => isPracticalBox(c.innerBox));
  const strong = practical.filter(
    (c) =>
      c.pallet.ok &&
      (c.pallet.exact || c.pallet.coverage >= OPTIMAL_PALLET_MIN_COVERAGE),
  );
  const pool = (strong.length > 0 ? strong : practical.length > 0 ? practical : layouts);

  // Альтернативы: разные размеры / S, без почти-дублей
  const ranked: LayoutCandidate[] = [];
  const seenKey = new Set<string>();
  for (const c of pool) {
    const key = [
      Math.round(c.innerBox.lengthMm / 5) * 5,
      Math.round(c.innerBox.widthMm / 5) * 5,
      Math.round(c.innerBox.heightMm / 5) * 5,
      c.groupCount,
    ].join("|");
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    ranked.push({
      ...c,
      tags: [
        ...c.tags.filter((t) => t !== "best" && t !== "alt"),
        (ranked.length === 0 ? "best" : "alt") as LayoutTag,
      ],
    });
    if (ranked.length >= RANKED_LAYOUT_LIMIT) break;
  }

  return { layouts, ranked };
}

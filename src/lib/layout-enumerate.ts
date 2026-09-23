/**
 * Перебор укладок товара в коробку.
 *
 * Канон = введённые Д×Ш×В (Ø×H). rotateMode: none | planar | full.
 * Score (меньше лучше): паллет exact → coverage; void; tech; поворот от канона;
 * preferred groups −3; maxSide/1000.
 * optimal: только pallet.coverage ≥ 0.90 (или exact). etalon (S=1) всегда.
 * Brick: чётные ряды повёрнуты 90° в плоскости, если |span1−span2| ≤ rowMatchTolMm.
 * Cylinder v1: только uniform (без brick).
 */
import { bestPalletFit, type PalletFit } from "./euro-pallet";
import {
  checkTechAccess,
  type TechAccessResult,
} from "./tech-access";

export type RotateMode = "none" | "planar" | "full";
export type LayoutPattern = "uniform" | "brick";
export type LayoutTag = "etalon" | "optimal" | "weak_pallet";
export type LayoutShape = "rect" | "cylinder" | "flat_stack";
export type LayoutPacking = "tight" | "standard" | "bubble" | "fragile";
export type LayoutFlatMode = "neat_stack" | "loose_bulk";

export const OPTIMAL_PALLET_MIN_COVERAGE = 0.9;

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
  interStackGapMm?: number;
  maxStackHeightMm?: number | null;
  wallThicknessMm?: number;
}

export interface LayoutCandidate {
  id: string;
  groupCount: number;
  perStack: number;
  nx: number;
  ny: number;
  nz: number;
  pattern: LayoutPattern;
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
}

export interface EnumerateLayoutsResult {
  layouts: LayoutCandidate[];
  etalon: LayoutCandidate;
  optimal: LayoutCandidate[];
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

/** Эффективная толщина плоской единицы (вспухание из occupiedVolumeLiters). */
export function effectiveThicknessMm(input: LayoutEnumerateInput): number {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const nominal = Math.max(0.1, input.heightMm);
  if (
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
}): number {
  const { pallet, voidRatio, techOk, rotatedFromCanon, preferred, maxSideMm } =
    args;
  let score = 0;
  if (pallet.exact) {
    score += 0;
  } else if (pallet.ok) {
    score += (1 - pallet.coverage) * 100;
    if (pallet.coverage < OPTIMAL_PALLET_MIN_COVERAGE) score += 50;
  } else {
    score += 120;
  }
  score += voidRatio * 80;
  if (!techOk) score += 8;
  if (rotatedFromCanon) score += 2;
  if (preferred) score -= 3;
  score += maxSideMm / 1000;
  return score;
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
  } = args;

  const innerBox = roundUpDims(
    addClearanceDims(productBlock, clearanceMm),
    roundStepMm,
  );
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
  const voidRatio =
    boxVol > 0 ? Math.max(0, (boxVol - productVolumeLiters) / boxVol) : 1;
  const rotatedFromCanon = !sameOrient(unitOrient, canon);
  const preferred = Boolean(
    preferredGroupCounts?.includes(groupCount) && groupCount > 1,
  );
  const maxSideMm = Math.max(
    innerBox.lengthMm,
    innerBox.widthMm,
    innerBox.heightMm,
  );
  const score = scoreLayout({
    pallet,
    voidRatio,
    techOk: tech.ok,
    rotatedFromCanon,
    preferred,
    maxSideMm,
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

  const summary = `${groupCount} гр. · сетка ${nx}×${ny}${nz > 1 ? `×${nz}` : ""} · ${pattern} · ${Math.round(unitOrient.lengthMm)}×${Math.round(unitOrient.widthMm)}×${Math.round(unitOrient.heightMm)}`;

  return {
    id,
    groupCount,
    perStack,
    nx,
    ny,
    nz,
    pattern,
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
  };
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

function enumerateFlat(
  input: LayoutEnumerateInput,
  canon: UnitOrient,
  orients: UnitOrient[],
  clearanceMm: number,
): LayoutCandidate[] {
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const maxGroups = Math.max(1, Math.min(input.maxGroups ?? 6, qty));
  const overlap =
    input.allowOverlap && (input.overlapMm ?? 0) > 0 ? input.overlapMm! : 0;
  const gap = input.interStackGapMm ?? 0;
  const tol = input.rowMatchTolMm ?? 8;
  const roundStep = input.roundStepMm ?? 5;
  const wall = input.wallThicknessMm ?? 0;
  const maxH = input.maxStackHeightMm ?? null;
  const tEff = effectiveThicknessMm(input);
  const productVolumeLiters =
    input.occupiedVolumeLiters != null && input.occupiedVolumeLiters > 0
      ? input.occupiedVolumeLiters
      : (input.lengthMm * input.widthMm * input.heightMm * qty) / 1_000_000;

  const neatOnly = (input.flatLayout ?? "loose_bulk") === "neat_stack";
  const groupCounts = neatOnly
    ? [1]
    : Array.from({ length: maxGroups }, (_, i) => i + 1);

  const out: LayoutCandidate[] = [];
  let seq = 0;

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
              id: `flat-${seq}-${S}-${nx}x${ny}-${pattern}`,
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
              preferredGroupCounts: input.preferredGroupCounts,
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
  const overlap =
    input.allowOverlap && (input.overlapMm ?? 0) > 0 ? input.overlapMm! : 0;
  const gap = input.interStackGapMm ?? 0;
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
  const gap = input.interStackGapMm ?? 0;
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
 * Полный перебор укладок + классификация etalon / optimal.
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

  // Fallback: at least one unit
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
      }),
    ];
  }

  const layouts = dedupeLayouts(raw);
  layouts.sort((a, b) => a.score - b.score);

  const singles = layouts.filter((c) => c.groupCount === 1);
  singles.sort((a, b) => {
    if (a.rotatedFromCanon !== b.rotatedFromCanon) {
      return a.rotatedFromCanon ? 1 : -1;
    }
    return a.score - b.score;
  });
  const etalon = { ...(singles[0] ?? layouts[0]!) };
  etalon.tags = [
    ...etalon.tags.filter((t) => t !== "etalon"),
    "etalon",
  ];

  const optimalRaw = layouts
    .filter((c) => c.id !== etalon.id)
    .filter(
      (c) =>
        c.pallet.ok &&
        (c.pallet.exact ||
          c.pallet.coverage >= OPTIMAL_PALLET_MIN_COVERAGE),
    )
    .sort((a, b) => a.score - b.score);

  const optimalPrefer = [
    ...optimalRaw.filter((c) => c.groupCount >= 2),
    ...optimalRaw.filter((c) => c.groupCount === 1),
  ]
    .slice(0, 8)
    .map((c) => ({
      ...c,
      tags: [
        ...c.tags.filter((t) => t !== "optimal" && t !== "weak_pallet"),
        "optimal" as LayoutTag,
      ],
    }));

  return {
    layouts,
    etalon,
    optimal: optimalPrefer,
  };
}

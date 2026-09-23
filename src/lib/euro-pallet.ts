/** Европаллет WB: 120×80 см (деревянный евростандарт). */

export const EURO_PALLET_MM = {
  lengthMm: 1200,
  widthMm: 800,
} as const;

export interface PalletFit {
  /** Влезает на паллет без свеса */
  ok: boolean;
  /** Обе стороны паллета делятся без остатка */
  exact: boolean;
  countPerLayer: number;
  alongLength: number;
  alongWidth: number;
  baseLengthMm: number;
  baseWidthMm: number;
  leftoverLengthMm: number;
  leftoverWidthMm: number;
  /** Доля площади паллета, занятая коробами */
  coverage: number;
  summary: string;
}

/** baseA вдоль 1200, baseB вдоль 800 */
function evaluateBase(baseA: number, baseB: number): PalletFit | null {
  const palletL = EURO_PALLET_MM.lengthMm;
  const palletW = EURO_PALLET_MM.widthMm;
  if (baseA <= 0 || baseB <= 0) return null;
  if (baseA > palletL || baseB > palletW) return null;

  const alongL = Math.floor(palletL / baseA);
  const alongW = Math.floor(palletW / baseB);
  if (alongL < 1 || alongW < 1) return null;

  const leftoverL = palletL - alongL * baseA;
  const leftoverW = palletW - alongW * baseB;
  const used = alongL * baseA * (alongW * baseB);
  const coverage = used / (palletL * palletW);
  const exact = leftoverL === 0 && leftoverW === 0;

  return {
    ok: true,
    exact,
    countPerLayer: alongL * alongW,
    alongLength: alongL,
    alongWidth: alongW,
    baseLengthMm: baseA,
    baseWidthMm: baseB,
    leftoverLengthMm: leftoverL,
    leftoverWidthMm: leftoverW,
    coverage,
    summary: exact
      ? `Европаллет 1200×800: ${alongL}×${alongW} = ${alongL * alongW} шт/слой без зазоров (основание ${baseA}×${baseB}).`
      : `Европаллет 1200×800: ${alongL}×${alongW} = ${alongL * alongW} шт/слой, остаток ${leftoverL}×${leftoverW} мм (покрытие ${Math.round(coverage * 100)}%).`,
  };
}

/**
 * Лучшая укладка коробки на европаллет 1200×800.
 * Любая грань может быть основанием, но отбрасываем «постановку на ребро»:
 * меньшая сторона основания должна быть не меньше половины высоты слоя
 * (иначе 300×300×80 «ложится» как 300×80 с высотой 300 — на практике так не штабелируют).
 */
export function bestPalletFit(box: {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}): PalletFit {
  const dims = [box.lengthMm, box.widthMm, box.heightMm];
  const candidates: PalletFit[] = [];

  for (let i = 0; i < 3; i++) {
    const upright = dims[i]!;
    const a = dims[(i + 1) % 3]!;
    const b = dims[(i + 2) % 3]!;
    // Устойчивость: не ставим плоскую коробку на узкое ребро
    if (Math.min(a, b) * 2 < upright) continue;

    const f1 = evaluateBase(a, b);
    const f2 = evaluateBase(b, a);
    if (f1) candidates.push(f1);
    if (f2) candidates.push(f2);
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      exact: false,
      countPerLayer: 0,
      alongLength: 0,
      alongWidth: 0,
      baseLengthMm: box.lengthMm,
      baseWidthMm: box.widthMm,
      leftoverLengthMm: EURO_PALLET_MM.lengthMm,
      leftoverWidthMm: EURO_PALLET_MM.widthMm,
      coverage: 0,
      summary:
        "Не укладывается на европаллет 1200×800 без свеса устойчивым основанием.",
    };
  }

  candidates.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    if (b.countPerLayer !== a.countPerLayer) {
      return b.countPerLayer - a.countPerLayer;
    }
    return (
      a.leftoverLengthMm +
      a.leftoverWidthMm -
      (b.leftoverLengthMm + b.leftoverWidthMm)
    );
  });

  return candidates[0]!;
}

/** «Хорошо ложится»: без остатка или покрытие ≥ 95%. */
export function palletIsPractical(fit: PalletFit): boolean {
  return fit.ok && (fit.exact || fit.coverage >= 0.95);
}

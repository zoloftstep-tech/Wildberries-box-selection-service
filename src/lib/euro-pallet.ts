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

function divisors(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (n % i === 0) out.push(i);
  }
  return out;
}

/** Exact-основания: a | 1200 и b | 800 (практичный диапазон коробок). */
export function exactPalletBases(): { lengthMm: number; widthMm: number }[] {
  const out: { lengthMm: number; widthMm: number }[] = [];
  const seen = new Set<string>();
  for (const a of divisors(EURO_PALLET_MM.lengthMm)) {
    for (const b of divisors(EURO_PALLET_MM.widthMm)) {
      if (a < 80 || b < 80) continue;
      if (a > 600 || b > 400) continue;
      const key = `${a}x${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ lengthMm: a, widthMm: b });
    }
  }
  return out;
}

/**
 * Ближайшее (по площади) exact-основание a×b (a|1200, b|800),
 * в которое влезает reqL×reqW с поворотом в плоскости.
 * Длины коробки подписываются под оси товара (length↔reqL, width↔reqW).
 */
export function snapToExactPalletBase(
  reqLengthMm: number,
  reqWidthMm: number,
): { lengthMm: number; widthMm: number; fit: PalletFit } | null {
  const reqL = Math.max(1, reqLengthMm);
  const reqW = Math.max(1, reqWidthMm);
  let best: {
    lengthMm: number;
    widthMm: number;
    fit: PalletFit;
    area: number;
  } | null = null;

  for (const base of exactPalletBases()) {
    const a = base.lengthMm; // вдоль 1200
    const b = base.widthMm; // вдоль 800
    const fit = evaluateBase(a, b);
    if (!fit?.exact) continue;

    let lengthMm: number;
    let widthMm: number;
    if (a + 0.05 >= reqL && b + 0.05 >= reqW) {
      lengthMm = a;
      widthMm = b;
    } else if (a + 0.05 >= reqW && b + 0.05 >= reqL) {
      // паллетные оси ↔ товарные: подпись коробки по товару
      lengthMm = b;
      widthMm = a;
    } else if (b + 0.05 >= reqL && a + 0.05 >= reqW) {
      // на случай если exactPalletBases когда-нибудь отдаст пары иначе
      lengthMm = b;
      widthMm = a;
    } else {
      continue;
    }

    const area = a * b;
    if (!best || area < best.area) {
      best = { lengthMm, widthMm, fit, area };
    }
  }

  if (!best) return null;
  return {
    lengthMm: best.lengthMm,
    widthMm: best.widthMm,
    fit: best.fit,
  };
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
    // Среди exact: предпочитаем более широкое основание (240×160 лучше 120×160)
    if (a.exact && b.exact) {
      const minA = Math.min(a.baseLengthMm, a.baseWidthMm);
      const minB = Math.min(b.baseLengthMm, b.baseWidthMm);
      if (minB !== minA) return minB - minA;
      const areaA = a.baseLengthMm * a.baseWidthMm;
      const areaB = b.baseLengthMm * b.baseWidthMm;
      if (areaB !== areaA) return areaB - areaA;
    }
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

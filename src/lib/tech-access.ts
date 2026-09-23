/**
 * Техлимиты текущего производства (просечка / слоттер).
 * Не отсекают рекомендации: неподходящее → самосборная коробка под штанцформу.
 */
export const TECH_ACCESS = {
  minLengthMm: 240,
  minHeightMm: 80,
  minWidthPlusHeightMm: 280,
} as const;

export type ProductionRoute = "tech_slotter" | "custom_die";

export interface TechAccessResult {
  ok: boolean;
  route: ProductionRoute;
  /** Ориентация, в которой техлимиты выполняются (если ok) */
  orientation: { lengthMm: number; widthMm: number; heightMm: number } | null;
  messages: string[];
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

/**
 * Проверка: существует ли ориентация L×W×H, где
 * длина ≥ 240, высота ≥ 80, ширина+высота ≥ 280.
 */
export function checkTechAccess(
  lengthMm: number,
  widthMm: number,
  heightMm: number,
): TechAccessResult {
  const { minLengthMm, minHeightMm, minWidthPlusHeightMm } = TECH_ACCESS;
  let best: { lengthMm: number; widthMm: number; heightMm: number } | null =
    null;

  for (const [l, w, h] of permute3(lengthMm, widthMm, heightMm)) {
    if (l >= minLengthMm && h >= minHeightMm && w + h >= minWidthPlusHeightMm) {
      best = { lengthMm: l, widthMm: w, heightMm: h };
      break;
    }
  }

  if (best) {
    return {
      ok: true,
      route: "tech_slotter",
      orientation: best,
      messages: [
        `Подходит под техлимиты производства (L≥${minLengthMm}, H≥${minHeightMm}, W+H≥${minWidthPlusHeightMm}).`,
      ],
    };
  }

  const reasons: string[] = [];
  const maxSide = Math.max(lengthMm, widthMm, heightMm);
  const minSide = Math.min(lengthMm, widthMm, heightMm);
  if (maxSide < minLengthMm) {
    reasons.push(`нет стороны ≥ ${minLengthMm} мм`);
  }
  if (minSide < minHeightMm) {
    reasons.push(`нет высоты ≥ ${minHeightMm} мм в допустимой ориентации`);
  }
  reasons.push(
    `нет ориентации с шириной+высотой ≥ ${minWidthPlusHeightMm} мм при длине ≥ ${minLengthMm} мм`,
  );

  return {
    ok: false,
    route: "custom_die",
    orientation: null,
    messages: [
      `Вне техлимитов слоттера — лучше самосборная коробка под штанцформу (${reasons[0]}).`,
    ],
  };
}

export function productionLabel(route: ProductionRoute): string {
  return route === "tech_slotter" ? "Техдоступ" : "Самосбор · штанцформа";
}

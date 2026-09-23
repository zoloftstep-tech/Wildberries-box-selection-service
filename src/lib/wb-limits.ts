/** Лимиты Wildberries по моделям продаж (актуально по инструкциям seller.wildberries.ru, 2026). */

export type SalesModel =
  | "fbw_box"
  | "fbw_mono"
  | "fbs_sc"
  | "fbs_pvz";

export type SizeClass = "mgt" | "kgt_plus" | "sgt" | "oversized";

export interface ModelLimit {
  id: SalesModel;
  title: string;
  shortTitle: string;
  description: string;
  /** Макс. длина одной стороны, мм. null = без лимита в этой модели. */
  maxSideMm: number;
  /** Макс. сумма трёх сторон, мм. */
  maxSumMm: number;
  /** Вес строго меньше этого значения, кг. */
  maxWeightKgExclusive: number;
  notes?: string[];
}

export const WB_MODELS: Record<SalesModel, ModelLimit> = {
  fbw_box: {
    id: "fbw_box",
    title: "Склад WB (FBW) — короб / поштучная паллета",
    shortTitle: "FBW · короб",
    description:
      "Индивидуальная упаковка при поставке коробом или поштучной паллетой.",
    maxSideMm: 800,
    maxSumMm: 1600,
    maxWeightKgExclusive: 25,
    notes: [
      "Основание транспортировочного короба — не более 120×80 см.",
      "Коробка не должна сильно превышать размер товара; товар не должен болтаться.",
    ],
  },
  fbw_mono: {
    id: "fbw_mono",
    title: "Склад WB (FBW) — монопаллета",
    shortTitle: "FBW · монопаллета",
    description: "Индивидуальная упаковка при поставке монопаллетой.",
    maxSideMm: 1200,
    maxSumMm: 2000,
    maxWeightKgExclusive: 25,
    notes: [
      "Для одежды, обуви, продуктов и косметики: сторона ≤ 80 см, сумма ≤ 160 см.",
    ],
  },
  fbs_sc: {
    id: "fbs_sc",
    title: "Маркетплейс (FBS) — склад / СЦ",
    shortTitle: "FBS · СЦ",
    description:
      "Товар в индивидуальной упаковке при отгрузке на склад или в сортировочный центр.",
    maxSideMm: 1200,
    maxSumMm: 2000,
    maxWeightKgExclusive: 25,
    notes: [
      "FBS требует индивидуальную упаковку + транспортировочный короб.",
      "КГТ+: сторона 121–200 см, сумма 201–280 см, вес < 25 кг.",
      "СГТ: сторона 121–400 см, сумма 201–1200 см, вес 25–100 кг.",
    ],
  },
  fbs_pvz: {
    id: "fbs_pvz",
    title: "Маркетплейс (FBS) — отгрузка в ПВЗ",
    shortTitle: "FBS · ПВЗ",
    description:
      "Ограничения для единицы товара и транспортировочного короба при сдаче в ПВЗ.",
    maxSideMm: 800,
    maxSumMm: 1400,
    maxWeightKgExclusive: 25,
    notes: [
      "Сторона транспортировочного короба ≤ 80 см (например 80×80×80 принимается).",
      "Сумма трёх сторон единицы товара ≤ 140 см.",
    ],
  },
};

export interface ComplianceResult {
  model: ModelLimit;
  ok: boolean;
  maxSideMm: number;
  sumMm: number;
  weightKg: number | null;
  sideOk: boolean;
  sumOk: boolean;
  weightOk: boolean;
  sizeClass: SizeClass;
  messages: string[];
}

export function classifySize(
  maxSideMm: number,
  sumMm: number,
  weightKg: number | null,
): SizeClass {
  const heavy = weightKg != null && weightKg >= 25;
  if (
    maxSideMm >= 1210 &&
    maxSideMm <= 4000 &&
    sumMm >= 2010 &&
    sumMm <= 12000 &&
    (heavy || weightKg == null)
  ) {
    if (heavy || (weightKg != null && weightKg >= 25)) return "sgt";
  }
  if (
    maxSideMm >= 1210 &&
    maxSideMm <= 2000 &&
    sumMm >= 2010 &&
    sumMm <= 2800 &&
    (weightKg == null || weightKg < 25)
  ) {
    return "kgt_plus";
  }
  if (maxSideMm > 1200 || sumMm > 2000 || heavy) {
    if (maxSideMm <= 4000 && sumMm <= 12000) return "sgt";
    return "oversized";
  }
  return "mgt";
}

export function checkCompliance(
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  weightKg: number | null,
  modelId: SalesModel,
): ComplianceResult {
  const model = WB_MODELS[modelId];
  const sides = [lengthMm, widthMm, heightMm];
  const maxSideMm = Math.max(...sides);
  const sumMm = sides.reduce((a, b) => a + b, 0);
  const sideOk = maxSideMm <= model.maxSideMm;
  const sumOk = sumMm <= model.maxSumMm;
  const weightOk =
    weightKg == null ? true : weightKg < model.maxWeightKgExclusive;
  const sizeClass = classifySize(maxSideMm, sumMm, weightKg);
  const messages: string[] = [];

  if (!sideOk) {
    messages.push(
      `Сторона ${fmtCm(maxSideMm)} > лимита ${fmtCm(model.maxSideMm)} для ${model.shortTitle}.`,
    );
  }
  if (!sumOk) {
    messages.push(
      `Сумма сторон ${fmtCm(sumMm)} > лимита ${fmtCm(model.maxSumMm)} для ${model.shortTitle}.`,
    );
  }
  if (!weightOk && weightKg != null) {
    messages.push(
      `Вес ${weightKg} кг не допускается (нужно строго меньше ${model.maxWeightKgExclusive} кг).`,
    );
  }
  if (sideOk && sumOk && weightOk) {
    messages.push(`Подходит под ${model.shortTitle}.`);
  }

  return {
    model,
    ok: sideOk && sumOk && weightOk,
    maxSideMm,
    sumMm,
    weightKg,
    sideOk,
    sumOk,
    weightOk,
    sizeClass,
    messages,
  };
}

export function checkAllModels(
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  weightKg: number | null,
): ComplianceResult[] {
  return (Object.keys(WB_MODELS) as SalesModel[]).map((id) =>
    checkCompliance(lengthMm, widthMm, heightMm, weightKg, id),
  );
}

export function fmtCm(mm: number): string {
  const cm = mm / 10;
  return Number.isInteger(cm) ? `${cm} см` : `${cm.toFixed(1)} см`;
}

export function fmtMm(mm: number): string {
  return `${Math.round(mm)} мм`;
}

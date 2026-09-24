"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recommendBoxes,
  presetCandle,
  presetSachets,
  presetRectBox,
  presetSquare,
  type FlatLayout,
  type LayoutCandidate,
  type PackingMode,
  type ProductInput,
  type ProductShape,
  type BoxRecommendation,
  type RotateMode,
  type SizingResult,
} from "@/lib/sizing";
import { productionLabel } from "@/lib/tech-access";
import { fmtMm, checkAllModels, type SalesModel, WB_MODELS, type ComplianceResult } from "@/lib/wb-limits";
import { cn } from "@/lib/utils";

const LayoutPreview = dynamic(
  () =>
    import("@/components/layout-preview").then((m) => m.LayoutPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-[var(--radius-lg,14px)] border border-[var(--line)] bg-[var(--surface-muted)] text-sm text-[var(--muted)]">
        Загрузка 3D…
      </div>
    ),
  },
);

const PACKING_OPTIONS: { id: PackingMode; title: string; hint: string }[] = [
  { id: "tight", title: "Плотная", hint: "+2 мм" },
  { id: "standard", title: "Стандарт", hint: "+5 мм" },
  { id: "bubble", title: "С пузырчатой", hint: "+10 мм" },
  { id: "fragile", title: "Хрупкое", hint: "+20 мм" },
];

const ROTATE_OPTIONS: { id: RotateMode; title: string; hint: string }[] = [
  {
    id: "none",
    title: "Без поворота",
    hint: "Только канон из ввода Д×Ш×В / Ø×H",
  },
  {
    id: "planar",
    title: "Только в плоскости",
    hint: "Д↔Ш, высота канона без изменений",
  },
  {
    id: "full",
    title: "Любой поворот",
    hint: "В т.ч. на бок (цилиндр тоже)",
  },
];

const SHAPE_OPTIONS: { id: ProductShape; title: string; hint: string }[] = [
  {
    id: "flat_stack",
    title: "Плоский",
    hint: "Пакетики, вкладыши — стопка или врассыпную",
  },
  { id: "cylinder", title: "Круглый", hint: "Свеча, банка, тубус" },
  {
    id: "rect",
    title: "Прямоуг. / квадрат",
    hint: "Брикет, набор, куб",
  },
];

const FLAT_LAYOUT_OPTIONS: { id: FlatLayout; title: string; hint: string }[] = [
  {
    id: "neat_stack",
    title: "Стопка",
    hint: "Плотно друг на друга по толщине",
  },
  {
    id: "loose_bulk",
    title: "Слои / россыпь",
    hint: "Сетка в плоскости + опц. наложение",
  },
];

function num(v: string, fallback = 0): number {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function BoxCalculator() {
  const [shape, setShape] = useState<ProductShape>("flat_stack");
  const [flatLayout, setFlatLayout] = useState<FlatLayout>("loose_bulk");
  const [allowOverlap, setAllowOverlap] = useState(true);
  const [overlapMm, setOverlapMm] = useState("15");
  const [lengthMm, setLengthMm] = useState("150");
  const [widthMm, setWidthMm] = useState("105");
  const [heightMm, setHeightMm] = useState("1.5");
  const [diameterMm, setDiameterMm] = useState("150");
  const [quantity, setQuantity] = useState("100");
  const [volumeLiters, setVolumeLiters] = useState("6.6");
  const [weightKg, setWeightKg] = useState("");
  const [packing, setPacking] = useState<PackingMode>("standard");
  const [rotateMode, setRotateMode] = useState<RotateMode>("none");
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rowMatchTolMm, setRowMatchTolMm] = useState("8");
  const [allowVoidFill, setAllowVoidFill] = useState(true);
  const [dividerMm, setDividerMm] = useState("0");
  const [maxDividerMm, setMaxDividerMm] = useState("30");
  const [maxSideInsertMm, setMaxSideInsertMm] = useState("50");
  const [maxHeightInsertMm, setMaxHeightInsertMm] = useState("80");
  const [inflateFromVolume, setInflateFromVolume] = useState(false);
  const [maxStackHeightMm, setMaxStackHeightMm] = useState("");
  const [roundStepMm, setRoundStepMm] = useState("5");
  const [preferModel, setPreferModel] = useState<SalesModel | "any">("any");
  const [onlyCompliant, setOnlyCompliant] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SizingResult | null>(() =>
    recommendBoxes(presetSachets()),
  );

  const input: ProductInput = useMemo(
    () => ({
      shape,
      lengthMm: num(lengthMm),
      widthMm: num(widthMm),
      heightMm: num(heightMm),
      diameterMm: num(diameterMm, num(lengthMm)),
      quantity: Math.max(1, Math.floor(num(quantity, 1))),
      weightKg: weightKg.trim() === "" ? null : num(weightKg),
      packing,
      flatLayout: shape === "flat_stack" ? flatLayout : undefined,
      occupiedVolumeLiters:
        shape === "flat_stack" && flatLayout === "loose_bulk"
          ? num(volumeLiters, 0) || null
          : null,
      allowOverlap:
        shape === "flat_stack" && flatLayout === "loose_bulk"
          ? allowOverlap
          : false,
      overlapMm:
        shape === "flat_stack" && flatLayout === "loose_bulk" && allowOverlap
          ? num(overlapMm, 0)
          : 0,
      rotateMode,
      selectedLayoutId,
      rowMatchTolMm: num(rowMatchTolMm, 8),
      roundStepMm: num(roundStepMm, 5),
      allowVoidFill,
      dividerMm: num(dividerMm, 0),
      maxDividerMm: num(maxDividerMm, 30),
      maxSideInsertMm: num(maxSideInsertMm, 50),
      maxHeightInsertMm: num(maxHeightInsertMm, 80),
      inflateStackFromVolume: inflateFromVolume,
      maxStackHeightMm:
        maxStackHeightMm.trim() === "" ? null : num(maxStackHeightMm),
      preferredGroupCounts: [2, 4],
    }),
    [
      shape,
      flatLayout,
      allowOverlap,
      overlapMm,
      lengthMm,
      widthMm,
      heightMm,
      diameterMm,
      quantity,
      volumeLiters,
      weightKg,
      packing,
      rotateMode,
      selectedLayoutId,
      rowMatchTolMm,
      roundStepMm,
      allowVoidFill,
      dividerMm,
      maxDividerMm,
      maxSideInsertMm,
      maxHeightInsertMm,
      inflateFromVolume,
      maxStackHeightMm,
    ],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      startTransition(() => setResult(recommendBoxes(input)));
    }, 180);
    return () => window.clearTimeout(t);
  }, [input]);

  function applyPreset(
    kind: "sachets" | "candle" | "rect" | "square",
  ) {
    const p =
      kind === "sachets"
        ? presetSachets()
        : kind === "candle"
          ? presetCandle()
          : kind === "square"
            ? presetSquare()
            : presetRectBox();
    setShape(p.shape);
    setFlatLayout(p.flatLayout ?? "neat_stack");
    setAllowOverlap(Boolean(p.allowOverlap));
    setOverlapMm(String(p.overlapMm ?? 15));
    setLengthMm(String(p.lengthMm));
    setWidthMm(String(p.widthMm));
    setHeightMm(String(p.heightMm));
    setDiameterMm(String(p.diameterMm ?? p.lengthMm));
    setQuantity(String(p.quantity));
    setVolumeLiters(
      p.occupiedVolumeLiters != null ? String(p.occupiedVolumeLiters) : "",
    );
    setWeightKg("");
    setPacking(p.packing);
    setRotateMode(p.rotateMode ?? "none");
    setAllowVoidFill(Boolean(p.allowVoidFill));
    setDividerMm(String(p.dividerMm ?? 0));
    setMaxDividerMm(String(p.maxDividerMm ?? 30));
    setMaxSideInsertMm(String(p.maxSideInsertMm ?? 50));
    setMaxHeightInsertMm(String(p.maxHeightInsertMm ?? 80));
    setInflateFromVolume(Boolean(p.inflateStackFromVolume));
    setSelectedLayoutId(null);
    startTransition(() => setResult(recommendBoxes({ ...p, selectedLayoutId: null })));
  }

  function calculate() {
    startTransition(() => setResult(recommendBoxes(input)));
  }

  function selectLayout(id: string) {
    setSelectedLayoutId(id);
  }

  const visible = useMemo(() => {
    if (!result) return [];
    let list = result.recommendations;
    if (preferModel !== "any") {
      list = list.filter((r) =>
        r.compliance.some((c) => c.model.id === preferModel && c.ok),
      );
    }
    if (onlyCompliant) {
      list = list.filter((r) => r.compliance.some((c) => c.ok));
    }
    return list;
  }, [result, preferModel, onlyCompliant]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
      <section
        className="relative overflow-hidden rounded-[var(--radius-lg,14px)] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)] sm:p-7"
        aria-labelledby="calc-form-title"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--moss)]/10 blur-2xl" />
        <h2 id="calc-form-title" className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Параметры товара
        </h2>
        <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
          Универсальный подбор: плоский / круглый / прямоугольный товар.
          Коробка — только квадрат или прямоугольник. Техлимиты помечают
          вариант, но не отсекают самосбор.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset("sachets")}
            className="cursor-pointer rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--line-strong)] hover:bg-white"
          >
            Кейс: 100 пакетиков ~6,6 л
          </button>
          <button
            type="button"
            onClick={() => applyPreset("candle")}
            className="cursor-pointer rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--line-strong)] hover:bg-white"
          >
            Круглая свеча
          </button>
          <button
            type="button"
            onClick={() => applyPreset("rect")}
            className="cursor-pointer rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--line-strong)] hover:bg-white"
          >
            Прямоугольник
          </button>
          <button
            type="button"
            onClick={() => applyPreset("square")}
            className="cursor-pointer rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--line-strong)] hover:bg-white"
          >
            Квадрат / куб
          </button>
        </div>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Форма товара
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setShape(opt.id);
                  setSelectedLayoutId(null);
                  if (opt.id === "cylinder") {
                    setDiameterMm(lengthMm || "150");
                    setHeightMm(heightMm === "1.5" ? "105" : heightMm);
                    setQuantity("1");
                  }
                  if (opt.id === "flat_stack") {
                    setHeightMm("1.5");
                    setQuantity("100");
                    setFlatLayout("loose_bulk");
                    if (!volumeLiters) setVolumeLiters("6.6");
                  }
                  if (opt.id === "rect") {
                    setQuantity("1");
                    if (heightMm === "1.5") setHeightMm("80");
                  }
                }}
                className={cn(
                  "cursor-pointer rounded-[var(--radius-md,10px)] border px-3 py-3 text-left transition-all duration-150",
                  shape === opt.id
                    ? "border-[var(--moss)] bg-[var(--moss-soft)] shadow-[inset_0_0_0_1px_var(--moss)]"
                    : "border-[var(--line)] bg-[var(--surface-muted)] hover:border-[var(--line-strong)]",
                )}
              >
                <div className="text-sm font-semibold text-[var(--ink)]">
                  {opt.title}
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">{opt.hint}</div>
              </button>
            ))}
          </div>
        </fieldset>

        {shape === "flat_stack" && (
          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Укладка плоских
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {FLAT_LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setFlatLayout(opt.id);
                    setSelectedLayoutId(null);
                  }}
                  className={cn(
                    "cursor-pointer rounded-[var(--radius-md,10px)] border px-3 py-2.5 text-left transition-all duration-150",
                    flatLayout === opt.id
                      ? "border-[var(--moss)] bg-[var(--moss-soft)]"
                      : "border-[var(--line)] bg-[var(--surface-muted)] hover:border-[var(--line-strong)]",
                  )}
                >
                  <div className="text-sm font-semibold text-[var(--ink)]">
                    {opt.title}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {opt.hint}
                  </div>
                </button>
              ))}
            </div>
            {flatLayout === "loose_bulk" && (
              <div className="mt-3 space-y-3 rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink)]">
                  <Checkbox
                    checked={allowOverlap}
                    onCheckedChange={(v) => setAllowOverlap(Boolean(v))}
                  />
                  <span>
                    <span className="font-semibold">Наложение</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      Стык единиц чуть сжимает ряд (2×105 → ~190–195 вместо 210)
                    </span>
                  </span>
                </label>
                {allowOverlap && (
                  <Field
                    label="Нахлёст на стык, мм"
                    value={overlapMm}
                    onChange={setOverlapMm}
                    min={0}
                    step="1"
                    placeholder="15"
                  />
                )}
                <Field
                  label="Занимаемый объём, л (вторично)"
                  value={volumeLiters}
                  onChange={setVolumeLiters}
                  min={0.01}
                  step="0.1"
                  placeholder="например 6.6"
                />
                <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                  Размер коробки считается по сетке L×W×стопки. Объём — проверка
                  вспухания россыпи, не главный драйвер.
                </p>
              </div>
            )}
          </fieldset>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {shape === "cylinder" ? (
            <>
              <Field
                label="Диаметр, мм"
                hint="Положение в коробке по умолчанию"
                value={diameterMm}
                onChange={setDiameterMm}
                min={1}
              />
              <Field
                label="Высота, мм"
                hint="Положение в коробке по умолчанию"
                value={heightMm}
                onChange={setHeightMm}
                min={1}
              />
            </>
          ) : (
            <>
              <Field
                label="Длина, мм"
                hint="Положение товара в коробке по умолчанию"
                value={lengthMm}
                onChange={setLengthMm}
                min={1}
              />
              <Field
                label="Ширина, мм"
                hint="Положение товара в коробке по умолчанию"
                value={widthMm}
                onChange={setWidthMm}
                min={1}
              />
              <Field
                label={
                  shape === "flat_stack" ? "Толщина единицы, мм" : "Высота, мм"
                }
                hint="Положение товара в коробке по умолчанию"
                value={heightMm}
                onChange={setHeightMm}
                min={0.1}
                step="0.1"
              />
            </>
          )}
          <Field
            label="Количество, шт"
            value={quantity}
            onChange={setQuantity}
            min={1}
            step="1"
          />
          <Field
            label="Вес единицы/набора, кг (опц.)"
            value={weightKg}
            onChange={setWeightKg}
            min={0}
            step="0.01"
            placeholder="например 0.4"
          />
        </div>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Поворот единицы
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {ROTATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setRotateMode(opt.id);
                  setSelectedLayoutId(null);
                }}
                className={cn(
                  "cursor-pointer rounded-[var(--radius-md,10px)] border px-3 py-2.5 text-left transition-all duration-150",
                  rotateMode === opt.id
                    ? "border-[var(--moss)] bg-[var(--moss-soft)]"
                    : "border-[var(--line)] bg-[var(--surface-muted)] hover:border-[var(--line-strong)]",
                )}
              >
                <div className="text-sm font-semibold text-[var(--ink)]">
                  {opt.title}
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  {opt.hint}
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Запас на упаковку
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PACKING_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPacking(opt.id)}
                className={cn(
                  "cursor-pointer rounded-[var(--radius-md,10px)] border px-3 py-2.5 text-left transition-all duration-150",
                  packing === opt.id
                    ? "border-[var(--cta)] bg-[var(--cta)] text-white"
                    : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)] hover:border-[var(--line-strong)]",
                )}
              >
                <div className="text-sm font-semibold">{opt.title}</div>
                <div
                  className={cn(
                    "text-xs",
                    packing === opt.id ? "text-white/70" : "text-[var(--muted)]",
                  )}
                >
                  {opt.hint} на сторону
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--ink)]">
          <Checkbox
            checked={allowVoidFill}
            onCheckedChange={(v) => setAllowVoidFill(Boolean(v))}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">
              Разрешить заполнить пустоту (вкладыш)
            </span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Модель сама подбирает разделитель между стопками и прокладки по
              бокам / сверху-снизу в разумных пределах — чтобы выйти на
              exact-паллет и техлимиты.
            </span>
          </span>
        </label>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="cursor-pointer text-sm font-medium text-[var(--moss-deep)] underline-offset-2 hover:underline"
          >
            {showAdvanced ? "Скрыть дополнительно" : "Дополнительно"}
          </button>
          {showAdvanced && (
            <div className="mt-3 grid gap-3 rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] p-3 sm:grid-cols-2">
              {allowVoidFill ? (
                <>
                  <Field
                    label="Макс. разделитель, мм"
                    value={maxDividerMm}
                    onChange={setMaxDividerMm}
                    min={0}
                    step="1"
                    placeholder="30"
                  />
                  <Field
                    label="Макс. вкладыш по бокам, мм"
                    value={maxSideInsertMm}
                    onChange={setMaxSideInsertMm}
                    min={0}
                    step="1"
                    placeholder="50"
                  />
                  <Field
                    label="Макс. вкладыш по высоте, мм"
                    value={maxHeightInsertMm}
                    onChange={setMaxHeightInsertMm}
                    min={0}
                    step="1"
                    placeholder="80"
                  />
                  <Field
                    label="Подсказка разделителя, мм (опц.)"
                    value={dividerMm}
                    onChange={setDividerMm}
                    min={0}
                    step="1"
                    placeholder="0"
                  />
                </>
              ) : (
                <Field
                  label="Разделитель между стопками, мм"
                  value={dividerMm}
                  onChange={setDividerMm}
                  min={0}
                  step="1"
                  placeholder="10"
                />
              )}
              <Field
                label="Допуск brick-рядов, мм"
                value={rowMatchTolMm}
                onChange={setRowMatchTolMm}
                min={0}
                step="1"
              />
              <Field
                label="Шаг округления коробки, мм"
                value={roundStepMm}
                onChange={setRoundStepMm}
                min={1}
                step="1"
              />
              <Field
                label="Макс. высота стопки, мм (опц.)"
                value={maxStackHeightMm}
                onChange={setMaxStackHeightMm}
                min={1}
                step="1"
                placeholder="без ограничения"
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink)] sm:col-span-2">
                <Checkbox
                  checked={inflateFromVolume}
                  onCheckedChange={(v) => setInflateFromVolume(Boolean(v))}
                />
                <span>
                  <span className="font-semibold">
                    Раздувать высоту стопки из объёма
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    Выкл.: толщина номинальная (как 1,5 мм), объём только для
                    пустот. Вкл.: tEff из литров.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={calculate}
            className="inline-flex h-11 min-w-[200px] cursor-pointer items-center justify-center rounded-[var(--radius-md,10px)] bg-[var(--cta)] px-5 text-base font-semibold text-white transition hover:bg-[var(--cta-hover)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(65_90_193_/_0.25)]"
          >
            {isPending ? "Считаем…" : "Подобрать коробку"}
          </button>
          <p className="text-xs text-[var(--muted)]">
            Коробка только квадратная или прямоугольная — круглые исключены.
            Расчёт обновляется при изменении параметров.
          </p>
        </div>
      </section>

      <section
        className="min-h-[28rem] rounded-[var(--radius-lg,14px)] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)] sm:p-7"
        aria-live="polite"
      >
        {!result ? (
          <EmptyState />
        ) : (
          <Results
            result={result}
            shape={shape}
            quantity={Math.max(1, Math.floor(num(quantity, 1)))}
            nominalHeightMm={num(heightMm)}
            occupiedVolumeLiters={
              shape === "flat_stack" && flatLayout === "loose_bulk"
                ? num(volumeLiters, 0) || null
                : null
            }
            overlapMm={
              shape === "flat_stack" &&
              flatLayout === "loose_bulk" &&
              allowOverlap
                ? num(overlapMm, 0)
                : 0
            }
            gapMm={
              result.selectedLayout?.voidFill?.dividerMm ??
              num(dividerMm, 0)
            }
            weightKg={weightKg.trim() === "" ? null : num(weightKg)}
            visible={visible}
            preferModel={preferModel}
            setPreferModel={setPreferModel}
            onlyCompliant={onlyCompliant}
            setOnlyCompliant={setOnlyCompliant}
            onSelectLayout={selectLayout}
          />
        )}
      </section>
    </div>
  );
}

function volumeHint(result: SizingResult): string {
  const g =
    result.selectedLayout?.geomVolumeLiters ??
    result.flatPack?.geomVolumeLiters ??
    result.occupiedVolumeLiters;
  return g.toFixed(2);
}

function Field({
  label,
  hint,
  value,
  onChange,
  min,
  step,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[var(--ink)]">{label}</Label>
      {hint && (
        <p className="-mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
          {hint}
        </p>
      )}
      <Input
        inputMode="decimal"
        type="number"
        min={min}
        step={step ?? "1"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 border-[var(--line)] bg-[var(--surface-muted)] text-base focus-visible:border-[var(--moss)] focus-visible:ring-[var(--moss)]/20"
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[24rem] flex-col justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--moss)]">
          Результат
        </p>
        <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">
          Размер появится здесь
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          Сервис считает габаритный блок товара, добавляет зазор под фиксацию
          и сверяет коробку с лимитами FBS и FBW: сторона, сумма сторон, вес.
        </p>
      </div>
          <div className="mt-8 grid gap-3 text-sm text-[var(--muted)]">
        <RuleLine title="FBW · короб" text="сторона ≤ 80 см, сумма ≤ 160 см, вес < 25 кг" />
        <RuleLine title="FBS · СЦ" text="сторона ≤ 120 см, сумма ≤ 200 см, вес < 25 кг" />
        <RuleLine title="FBS · ПВЗ" text="товар: сумма ≤ 140 см; короб: сторона ≤ 80 см" />
        <RuleLine
          title="Европаллет"
          text="основание коробок должно укладываться на 1200×800 без большого остатка"
        />
      </div>
    </div>
  );
}

function RuleLine({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-[var(--line)] pt-3">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--moss)]" />
      <div>
        <div className="font-medium text-[var(--ink)]">{title}</div>
        <div>{text}</div>
      </div>
    </div>
  );
}

function Results({
  result,
  shape,
  quantity,
  nominalHeightMm,
  occupiedVolumeLiters,
  overlapMm,
  gapMm,
  weightKg,
  visible,
  preferModel,
  setPreferModel,
  onlyCompliant,
  setOnlyCompliant,
  onSelectLayout,
}: {
  result: SizingResult;
  shape: ProductShape;
  quantity: number;
  nominalHeightMm: number;
  occupiedVolumeLiters: number | null;
  overlapMm: number;
  gapMm: number;
  weightKg: number | null;
  visible: BoxRecommendation[];
  preferModel: SalesModel | "any";
  setPreferModel: (v: SalesModel | "any") => void;
  onlyCompliant: boolean;
  setOnlyCompliant: (v: boolean) => void;
  onSelectLayout: (id: string) => void;
}) {
  const block = result.productBlock;
  const need = result.requiredInner;
  const selectedId = result.selectedLayout.id;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--moss)]">
          Расчёт
        </p>
        <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
          Нужен внутренний размер{" "}
          <span className="font-mono whitespace-nowrap text-[var(--moss-deep)]">
            {need.lengthMm}×{need.widthMm}×{need.heightMm} мм
          </span>
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {result.selectedLayout.summary} · блок {fmtMm(block.lengthMm)} ×{" "}
          {fmtMm(block.widthMm)} × {fmtMm(block.heightMm)}, зазор{" "}
          {result.clearanceMm} мм на сторону · геометрия ~{volumeHint(result)} л
          {result.occupiedVolumeLiters > 0 &&
          Math.abs(result.occupiedVolumeLiters - result.selectedLayout.geomVolumeLiters) >
            0.05
            ? ` (заявлено ${result.occupiedVolumeLiters.toFixed(1)} л)`
            : ""}
          .
        </p>
      </div>

      <LayoutPreview
        layout={result.selectedLayout}
        shape={shape}
        quantity={quantity}
        overlapMm={overlapMm}
        gapMm={gapMm}
        nominalHeightMm={nominalHeightMm}
        occupiedVolumeLiters={occupiedVolumeLiters}
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">
          Эталон (1 стопка · лёжа на паллете)
        </h3>
        <LayoutCard
          layout={result.etalon}
          selected={selectedId === result.etalon.id}
          onSelect={() => onSelectLayout(result.etalon.id)}
          badge="Эталон · лёжа"
          weightKg={weightKg}
        />
      </div>

      {result.optimal.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--ink)]">
            Оптимальные укладки
            <span className="ml-2 font-normal text-[var(--muted)]">
              паллет ≥90%
            </span>
          </h3>
          {result.optimal.map((layout) => (
            <LayoutCard
              key={layout.id}
              layout={layout}
              selected={selectedId === layout.id}
              onSelect={() => onSelectLayout(layout.id)}
              badge="Оптимальная"
              weightKg={weightKg}
            />
          ))}
        </div>
      )}

      {result.notes.length > 0 && (
        <ul className="space-y-1 text-sm text-[var(--muted)]">
          {result.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}
      <p className="rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--ink)]">
        {result.techHint}
      </p>
      {result.markingHint && (
        <p className="rounded-[var(--radius-md,10px)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,white)] px-3 py-2 text-sm text-[#422006]">
          {result.markingHint}
        </p>
      )}
      {result.palletHint && (
        <p className="rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--ink)]">
          {result.palletHint}
        </p>
      )}

      <CustomBoxCard
        rec={result.custom}
        title={
          result.custom.tech.ok
            ? "Индивидуальный размер (от выбранной укладки)"
            : "Индивидуальный · самосбор / штанцформа"
        }
      />
      {result.customTech && (
        <CustomBoxCard
          rec={result.customTech}
          title="Индивидуальный · под техлимиты слоттера"
        />
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              active={preferModel === "any"}
              onClick={() => setPreferModel("any")}
            >
              Все модели
            </FilterChip>
            {(Object.keys(WB_MODELS) as SalesModel[]).map((id) => (
              <FilterChip
                key={id}
                active={preferModel === id}
                onClick={() => setPreferModel(id)}
              >
                {WB_MODELS[id].shortTitle}
              </FilterChip>
            ))}
            <ModelLimitsHelp />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <Checkbox
              checked={onlyCompliant}
              onCheckedChange={(v) => setOnlyCompliant(Boolean(v))}
            />
            Только подходящие под WB
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">
          Типовые коробки из каталога
          <span className="ml-2 font-normal text-[var(--muted)]">
            от выбранной укладки
          </span>
        </h3>
        {visible.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            В каталоге нет подходящего размера под выбранный фильтр. Возьмите
            индивидуальный размер выше или ослабьте фильтр.
          </p>
        ) : (
          visible.map((rec) => <CatalogCard key={rec.box.id} rec={rec} />)
        )}
      </div>
    </div>
  );
}

function LayoutCard({
  layout,
  selected,
  onSelect,
  badge,
  weightKg,
}: {
  layout: LayoutCandidate;
  selected: boolean;
  onSelect: () => void;
  badge: string;
  weightKg: number | null;
}) {
  const palletGood =
    layout.pallet.exact ||
    (layout.pallet.ok && layout.pallet.coverage >= 0.9);
  const compliance = checkAllModels(
    layout.innerBox.lengthMm,
    layout.innerBox.widthMm,
    layout.innerBox.heightMm,
    weightKg,
  );
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full cursor-pointer rounded-[var(--radius-lg,14px)] border p-4 text-left transition-shadow duration-150",
        selected
          ? "border-[var(--moss)] bg-[var(--moss-soft)] shadow-[var(--shadow-md)]"
          : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                badge === "Эталон"
                  ? "bg-[var(--moss)] text-white hover:bg-[var(--moss)]"
                  : "bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
              }
            >
              {badge}
            </Badge>
            {selected && (
              <Badge variant="secondary" className="border border-[var(--moss)]/30">
                Выбрана · каталог от неё
              </Badge>
            )}
            {layout.rotatedFromCanon && (
              <Badge variant="secondary">Поворот</Badge>
            )}
            {layout.tech.ok ? (
              <Badge className="bg-[var(--success)] text-white hover:bg-[var(--success)]">
                Техдоступ
              </Badge>
            ) : (
              <Badge className="bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]">
                Самосбор
              </Badge>
            )}
          </div>
          <p className="font-display mt-2 font-mono text-xl font-semibold text-[var(--ink)]">
            {layout.innerBox.lengthMm}×{layout.innerBox.widthMm}×
            {layout.innerBox.heightMm} мм
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {layout.summary} · пустоты {Math.round(layout.voidRatio * 100)}%
            {layout.rotatedFromCanon ? " · повёрнут от канона" : ""}
          </p>
          {layout.voidFill && (
            <p className="mt-1 text-xs text-[var(--moss-deep)]">
              Вкладыш: {layout.voidFill.summary}
            </p>
          )}
        </div>
      </div>
      <ModelFitBadges compliance={compliance} />
      <div
        className={cn(
          "mt-3 rounded-[var(--radius-md,10px)] border px-3 py-2 text-sm",
          palletGood
            ? "border-[var(--moss)]/40 bg-white/60 text-[var(--ink)]"
            : "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,white)] text-[#422006]",
        )}
      >
        {layout.pallet.exact
          ? `Паллет: ${layout.pallet.alongLength}×${layout.pallet.alongWidth} без зазоров`
          : layout.pallet.ok
            ? `Паллет: ${Math.round(layout.pallet.coverage * 100)}% · ${layout.pallet.alongLength}×${layout.pallet.alongWidth}`
            : "Паллет: не укладывается"}
      </div>
    </button>
  );
}

/** Зелёный = проходит модель, красный = нет. */
function ModelFitBadges({ compliance }: { compliance: ComplianceResult[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {compliance.map((c) => (
        <span
          key={c.model.id}
          title={c.messages.join(" ") || c.model.title}
          className={cn(
            "rounded-[var(--radius-sm,8px)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            c.ok
              ? "bg-[color-mix(in_srgb,var(--success)_14%,white)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_35%,transparent)]"
              : "bg-[color-mix(in_srgb,#dc2626_10%,white)] text-[#b91c1c] ring-1 ring-[color-mix(in_srgb,#dc2626_30%,transparent)]",
          )}
        >
          {c.model.shortTitle}
        </span>
      ))}
    </div>
  );
}

function ModelLimitsHelp() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rows: { id: SalesModel; side: string; sum: string; note: string }[] = [
    {
      id: "fbw_box",
      side: "≤ 80 см",
      sum: "≤ 160 см",
      note: "Поставка коробом / поштучной паллетой на склад WB",
    },
    {
      id: "fbw_mono",
      side: "≤ 120 см",
      sum: "≤ 200 см",
      note: "Монопаллета на склад WB (для части категорий жёстче)",
    },
    {
      id: "fbs_sc",
      side: "≤ 120 см",
      sum: "≤ 200 см",
      note: "FBS: отгрузка на склад или в сортировочный центр",
    },
    {
      id: "fbs_pvz",
      side: "≤ 80 см",
      sum: "≤ 140 см",
      note: "FBS: сдача в пункт выдачи (ПВЗ)",
    },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="wb-model-limits-help"
        aria-label="Справка по моделям продаж WB"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex size-8 cursor-pointer items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-150",
          open
            ? "border-[var(--moss)] bg-[var(--moss-soft)] text-[var(--moss-deep)]"
            : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]",
        )}
      >
        ?
      </button>
      {open && (
        <div
          id="wb-model-limits-help"
          role="dialog"
          aria-label="Лимиты моделей продаж Wildberries"
          className="absolute left-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-[var(--radius-lg,14px)] border border-[var(--line)] bg-[var(--panel)] p-3 shadow-[var(--shadow-md)] sm:left-auto sm:right-0 sm:w-[26rem]"
        >
          <p className="text-sm font-semibold text-[var(--ink)]">
            Фильтр каталога по модели отгрузки
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Чипы не пересчитывают размер — только показывают коробки, которые
            проходят выбранную схему. Вес во всех случаях &lt; 25 кг.
          </p>

          <dl className="mt-3 grid gap-1.5 text-xs text-[var(--muted)]">
            <div>
              <dt className="inline font-semibold text-[var(--ink)]">FBW</dt>
              <dd className="inline"> — склад Wildberries (фулфилмент WB)</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[var(--ink)]">FBS</dt>
              <dd className="inline">
                {" "}
                — маркетплейс (товар со своего склада продавца)
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[var(--ink)]">СЦ</dt>
              <dd className="inline"> — сортировочный центр</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[var(--ink)]">ПВЗ</dt>
              <dd className="inline"> — пункт выдачи заказов</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[var(--ink)]">Короб</dt>
              <dd className="inline">
                {" "}
                — поставка транспортировочными коробами
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[var(--ink)]">
                Монопаллета
              </dt>
              <dd className="inline">
                {" "}
                — один артикул на европаллете 120×80
              </dd>
            </div>
          </dl>

          <div className="mt-3 overflow-x-auto rounded-[var(--radius-md,10px)] border border-[var(--line)]">
            <table className="w-full min-w-[18rem] border-collapse text-left text-[11px] sm:text-xs">
              <thead className="bg-[var(--surface-muted)] text-[var(--muted)]">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Модель</th>
                  <th className="px-2 py-1.5 font-semibold">Сторона</th>
                  <th className="px-2 py-1.5 font-semibold">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--line)] text-[var(--ink)]"
                  >
                    <td className="px-2 py-1.5 align-top">
                      <div className="font-semibold">
                        {WB_MODELS[row.id].shortTitle}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-snug text-[var(--muted)] sm:text-[11px]">
                        {row.note}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 align-top font-mono">
                      {row.side}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 align-top font-mono">
                      {row.sum}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-[var(--radius-md,10px)] border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
        active
          ? "border-[var(--moss)] bg-[var(--moss-soft)] text-[var(--moss-deep)]"
          : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]",
      )}
    >
      {children}
    </button>
  );
}

function ProductionBadge({ rec }: { rec: BoxRecommendation }) {
  const tech = rec.tech.ok;
  return (
    <Badge
      className={cn(
        tech
          ? "bg-[var(--success)] text-white hover:bg-[var(--success)]"
          : "bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]",
      )}
      title={rec.tech.messages.join(" ")}
    >
      {productionLabel(rec.productionRoute)}
    </Badge>
  );
}

function CustomBoxCard({
  rec,
  title = "Индивидуальный размер",
}: {
  rec: BoxRecommendation;
  title?: string;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg,14px)] border p-4",
        rec.tech.ok
          ? "border-[var(--moss)]/35 bg-[var(--moss-soft)]"
          : "border-[var(--line-strong)] bg-[var(--surface-muted)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.14em]",
              rec.tech.ok ? "text-[var(--moss-deep)]" : "text-[var(--muted)]",
            )}
          >
            {title}
          </p>
          <p className="font-display mt-1 font-mono text-2xl font-semibold text-[var(--ink)]">
            {rec.box.label} мм
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Внутренний ·{" "}
            {rec.tech.ok
              ? "можно на текущем станке"
              : "заказ штанцформы под самосбор"}{" "}
            · пустоты {Math.round(rec.fit.unusedVolumeRatio * 100)}%
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ProductionBadge rec={rec} />
          <ComplianceBadges rec={rec} />
        </div>
      </div>
      <GapLine fit={rec.fit} />
      <PalletLine pallet={rec.pallet} />
      {rec.warnings.map((w) => (
        <p key={w} className="mt-2 text-xs text-amber-900">
          {w}
        </p>
      ))}
    </article>
  );
}

function CatalogCard({ rec }: { rec: BoxRecommendation }) {
  return (
    <article
      className={cn(
        "rounded-[var(--radius-lg,14px)] border bg-[var(--panel)] p-4 transition-shadow duration-150",
        rec.isBest
          ? "border-[var(--moss)] shadow-[var(--shadow-md)]"
          : "border-[var(--line)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display font-mono text-xl font-semibold text-[var(--ink)]">
              {rec.box.label} мм
            </p>
            <ProductionBadge rec={rec} />
            {rec.isBest && (
              <Badge className="bg-[var(--moss)] text-white hover:bg-[var(--moss)]">
                Лучший из каталога
              </Badge>
            )}
            {rec.isBestTech && !rec.isBest && (
              <Badge
                variant="secondary"
                className="border border-[var(--success)]/30"
              >
                Лучший под техдоступ
              </Badge>
            )}
            {rec.box.popular && !rec.isBest && (
              <Badge variant="secondary">Ходовой</Badge>
            )}
            {rec.pallet.exact && (
              <Badge className="bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]">
                Паллет без зазоров
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ориентация {rec.fit.orientation.lengthMm}×
            {rec.fit.orientation.widthMm}×{rec.fit.orientation.heightMm} ·
            пустоты {Math.round(rec.fit.unusedVolumeRatio * 100)}%
          </p>
        </div>
        <ComplianceBadges rec={rec} />
      </div>
      <GapLine fit={rec.fit} />
      <PalletLine pallet={rec.pallet} />
      {rec.warnings.map((w) => (
        <p key={w} className="mt-2 text-xs text-amber-900">
          {w}
        </p>
      ))}
    </article>
  );
}

function GapLine({
  fit,
}: {
  fit: BoxRecommendation["fit"];
}) {
  return (
    <p className="mt-3 text-xs text-[var(--muted)]">
      Зазоры: {Math.round(fit.gaps.lengthMm)} / {Math.round(fit.gaps.widthMm)} /{" "}
      {Math.round(fit.gaps.heightMm)} мм по осям после ориентации
    </p>
  );
}

function PalletLine({ pallet }: { pallet: BoxRecommendation["pallet"] }) {
  const good = pallet.exact || (pallet.ok && pallet.coverage >= 0.9);
  return (
    <div
      className={cn(
        "mt-3 rounded-[var(--radius-md,10px)] border px-3 py-2.5",
        pallet.exact
          ? "border-[var(--moss)]/40 bg-[var(--moss-soft)]"
          : good
            ? "border-[var(--line)] bg-[var(--surface-muted)]"
            : "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,white)]",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.14em]",
          good ? "text-[var(--moss-deep)]" : "text-[#422006]",
        )}
      >
        Европаллет 1200×800
      </p>
      <p
        className={cn(
          "mt-1 text-sm leading-snug",
          good ? "text-[var(--ink)]" : "text-[#422006]",
        )}
      >
        {pallet.exact
          ? `${pallet.alongLength}×${pallet.alongWidth} = ${pallet.countPerLayer} шт/слой без зазоров`
          : pallet.ok
            ? `${pallet.alongLength}×${pallet.alongWidth} = ${pallet.countPerLayer} шт/слой · остаток ${pallet.leftoverLengthMm}×${pallet.leftoverWidthMm} мм · ${Math.round(pallet.coverage * 100)}%`
            : "Не укладывается без свеса"}
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        Основание на паллете: {pallet.baseLengthMm}×{pallet.baseWidthMm} мм
      </p>
    </div>
  );
}

function ComplianceBadges({ rec }: { rec: BoxRecommendation }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {rec.compliance.map((c) => (
        <span
          key={c.model.id}
          title={c.messages.join(" ")}
          className={cn(
            "rounded-[var(--radius-sm,8px)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            c.ok
              ? "bg-[color-mix(in_srgb,var(--success)_14%,white)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_35%,transparent)]"
              : "bg-[color-mix(in_srgb,#dc2626_10%,white)] text-[#b91c1c] ring-1 ring-[color-mix(in_srgb,#dc2626_30%,transparent)]",
          )}
        >
          {c.model.shortTitle}
        </span>
      ))}
    </div>
  );
}

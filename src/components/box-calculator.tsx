"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recommendBoxes,
  presetCandle,
  presetSachets,
  type PackingMode,
  type ProductInput,
  type ProductShape,
  type BoxRecommendation,
  type SizingResult,
} from "@/lib/sizing";
import { fmtCm, fmtMm, type SalesModel, WB_MODELS } from "@/lib/wb-limits";
import { cn } from "@/lib/utils";

const PACKING_OPTIONS: { id: PackingMode; title: string; hint: string }[] = [
  { id: "tight", title: "Плотная", hint: "+2 мм" },
  { id: "standard", title: "Стандарт", hint: "+5 мм" },
  { id: "bubble", title: "С пузырчатой", hint: "+10 мм" },
  { id: "fragile", title: "Хрупкое", hint: "+20 мм" },
];

const SHAPE_OPTIONS: { id: ProductShape; title: string; hint: string }[] = [
  {
    id: "flat_stack",
    title: "Стопка плоских",
    hint: "Пакетики, вкладыши, саше",
  },
  { id: "cylinder", title: "Цилиндр", hint: "Свеча, банка, тубус" },
  { id: "rect", title: "Прямоугольный", hint: "Коробка, брикет, набор" },
];

function num(v: string, fallback = 0): number {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function BoxCalculator() {
  const [shape, setShape] = useState<ProductShape>("flat_stack");
  const [lengthMm, setLengthMm] = useState("150");
  const [widthMm, setWidthMm] = useState("105");
  const [heightMm, setHeightMm] = useState("1.5");
  const [diameterMm, setDiameterMm] = useState("150");
  const [quantity, setQuantity] = useState("100");
  const [weightKg, setWeightKg] = useState("");
  const [packing, setPacking] = useState<PackingMode>("standard");
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
    }),
    [
      shape,
      lengthMm,
      widthMm,
      heightMm,
      diameterMm,
      quantity,
      weightKg,
      packing,
    ],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      startTransition(() => setResult(recommendBoxes(input)));
    }, 180);
    return () => window.clearTimeout(t);
  }, [input]);

  function applyPreset(kind: "sachets" | "candle") {
    const p = kind === "sachets" ? presetSachets() : presetCandle();
    setShape(p.shape);
    setLengthMm(String(p.lengthMm));
    setWidthMm(String(p.widthMm));
    setHeightMm(String(p.heightMm));
    setDiameterMm(String(p.diameterMm ?? p.lengthMm));
    setQuantity(String(p.quantity));
    setWeightKg("");
    setPacking(p.packing);
    startTransition(() => setResult(recommendBoxes(p)));
  }

  function calculate() {
    startTransition(() => setResult(recommendBoxes(input)));
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
          Укажите форму и размеры — подберём внутренний размер квадратной или
          прямоугольной коробки под лимиты WB.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset("sachets")}
            className="cursor-pointer rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--line-strong)] hover:bg-white"
          >
            Пример: 100 пакетиков
          </button>
          <button
            type="button"
            onClick={() => applyPreset("candle")}
            className="cursor-pointer rounded-[var(--radius-md,10px)] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--line-strong)] hover:bg-white"
          >
            Пример: круглая свеча
          </button>
        </div>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Форма
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setShape(opt.id);
                  if (opt.id === "cylinder") {
                    setDiameterMm(lengthMm || "150");
                    setHeightMm(heightMm === "1.5" ? "105" : heightMm);
                    setQuantity("1");
                  }
                  if (opt.id === "flat_stack") {
                    setHeightMm("1.5");
                    setQuantity("100");
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {shape === "cylinder" ? (
            <>
              <Field
                label="Диаметр, мм"
                value={diameterMm}
                onChange={setDiameterMm}
                min={1}
              />
              <Field
                label="Высота, мм"
                value={heightMm}
                onChange={setHeightMm}
                min={1}
              />
            </>
          ) : (
            <>
              <Field
                label="Длина, мм"
                value={lengthMm}
                onChange={setLengthMm}
                min={1}
              />
              <Field
                label="Ширина, мм"
                value={widthMm}
                onChange={setWidthMm}
                min={1}
              />
              <Field
                label={
                  shape === "flat_stack" ? "Толщина единицы, мм" : "Высота, мм"
                }
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
            visible={visible}
            preferModel={preferModel}
            setPreferModel={setPreferModel}
            onlyCompliant={onlyCompliant}
            setOnlyCompliant={setOnlyCompliant}
          />
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  min,
  step,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[var(--ink)]">{label}</Label>
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
  visible,
  preferModel,
  setPreferModel,
  onlyCompliant,
  setOnlyCompliant,
}: {
  result: SizingResult;
  visible: BoxRecommendation[];
  preferModel: SalesModel | "any";
  setPreferModel: (v: SalesModel | "any") => void;
  onlyCompliant: boolean;
  setOnlyCompliant: (v: boolean) => void;
}) {
  const block = result.productBlock;
  const need = result.requiredInner;

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
          Блок товара {fmtMm(block.lengthMm)} × {fmtMm(block.widthMm)} ×{" "}
          {fmtMm(block.heightMm)}, зазор {result.clearanceMm} мм на сторону.
          Сумма сторон коробки под заказ:{" "}
          {fmtCm(
            result.custom.box.lengthMm +
              result.custom.box.widthMm +
              result.custom.box.heightMm,
          )}
          .
        </p>
      </div>

      {result.notes.length > 0 && (
        <ul className="space-y-1 text-sm text-[var(--muted)]">
          {result.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}
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

      <CustomBoxCard rec={result.custom} />

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
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
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          <Checkbox
            checked={onlyCompliant}
            onCheckedChange={(v) => setOnlyCompliant(Boolean(v))}
          />
          Только подходящие под WB
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">
          Типовые коробки из каталога
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

function CustomBoxCard({ rec }: { rec: BoxRecommendation }) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-lg,14px)] border border-[var(--moss)]/35 bg-[var(--moss-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--moss-deep)]">
            Индивидуальный размер
          </p>
          <p className="font-display mt-1 font-mono text-2xl font-semibold text-[var(--ink)]">
            {rec.box.label} мм
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Внутренний · округление до 5 мм · плотная посадка под WB
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
          <div className="flex items-center gap-2">
            <p className="font-display font-mono text-xl font-semibold text-[var(--ink)]">
              {rec.box.label} мм
            </p>
            {rec.isBest && (
              <Badge className="bg-[var(--moss)] text-white hover:bg-[var(--moss)]">
                Лучший из каталога
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
            {rec.fit.orientation.widthMm}×{rec.fit.orientation.heightMm} · пустоты{" "}
            {Math.round(rec.fit.unusedVolumeRatio * 100)}%
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
  const good = pallet.exact || (pallet.ok && pallet.coverage >= 0.95);
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
              ? "bg-[color-mix(in_srgb,var(--success)_12%,white)] text-[var(--success)]"
              : "bg-[var(--surface-muted)] text-[var(--muted)] line-through decoration-[var(--line-strong)]",
          )}
        >
          {c.model.shortTitle}
        </span>
      ))}
    </div>
  );
}

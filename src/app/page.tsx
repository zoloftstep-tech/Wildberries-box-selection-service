import { BoxCalculator } from "@/components/box-calculator";

export default function Home() {
  return (
    <div className="page-atmosphere relative flex-1">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden
            className="text-[var(--moss)]"
          >
            <rect
              x="4"
              y="8"
              width="20"
              height="20"
              rx="2"
              className="hero-box-stroke"
              stroke="currentColor"
              strokeWidth="2"
              fill="rgba(65,90,193,0.12)"
            />
            <rect
              x="12"
              y="4"
              width="20"
              height="20"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
              fill="rgba(255,255,255,0.85)"
            />
          </svg>
          <div>
            <p className="font-display text-lg font-semibold leading-none tracking-tight text-[var(--ink)] sm:text-xl">
              Коробомер
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              BoxMart · под стандарты WB
            </p>
          </div>
        </div>
        <a
          href="#rules"
          className="focus-ring text-sm font-semibold text-[var(--moss)] transition-colors hover:text-[var(--moss-deep)]"
        >
          Правила WB
        </a>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <section className="animate-rise pb-8 pt-2 sm:pb-10 sm:pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--moss)]">
            Картонные коробки · FBS / FBW
          </p>
          <h1 className="font-display mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] sm:text-5xl md:text-6xl">
            Коробомер
          </h1>
          <p className="animate-rise-delay mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Подбирает квадратную или прямоугольную коробку под плоский,
            круглый или прямоугольный товар и сверяет с лимитами Wildberries.
            Техлимиты станка помечают «Техдоступ» или «Самосбор · штанцформа».
          </p>
        </section>

        <div className="animate-rise-delay-2">
          <BoxCalculator />
        </div>

        <section id="rules" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            Лимиты, на которых строится расчёт
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            По официальным инструкциям seller.wildberries.ru (обновления 2026):
            упаковка не должна сильно превышать товар, товар не должен
            перемещаться внутри, коробка — целая, без посторонней маркировки.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <article className="border-t border-[var(--line)] pt-4">
              <h3 className="font-display text-xl font-semibold text-[var(--ink)]">
                Склад WB (FBW)
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                <li>
                  <strong className="text-[var(--ink)]">Короб / поштучная паллета:</strong>{" "}
                  сторона ≤ 80 см, сумма трёх сторон ≤ 160 см, вес &lt; 25 кг.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Монопаллета:</strong>{" "}
                  сторона ≤ 120 см, сумма ≤ 200 см, вес &lt; 25 кг (для одежды,
                  обуви, продуктов и косметики — как у короба).
                </li>
                <li>
                  Картонная коробка — высокий уровень защиты; закрывающие части
                  должны быть плотными.
                </li>
              </ul>
            </article>

            <article className="border-t border-[var(--line)] pt-4">
              <h3 className="font-display text-xl font-semibold text-[var(--ink)]">
                Маркетплейс (FBS)
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                <li>
                  <strong className="text-[var(--ink)]">Склад / СЦ:</strong>{" "}
                  сторона ≤ 120 см, сумма ≤ 200 см, вес &lt; 25 кг.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">ПВЗ:</strong> сторона
                  транспортировочного короба ≤ 80 см; сумма сторон единицы
                  товара ≤ 140 см; вес &lt; 25 кг.
                </li>
                <li>
                  Нужны индивидуальная упаковка и транспортировочный короб;
                  пустоты заполняют амортизатором.
                </li>
              </ul>
            </article>
            <article className="border-t border-[var(--line)] pt-4 md:col-span-2">
              <h3 className="font-display text-xl font-semibold text-[var(--ink)]">
                Европаллет 1200×800
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                <li>
                  Склады WB принимают поставки на деревянных паллетах
                  евростандарта:{" "}
                  <strong className="text-[var(--ink)]">120×80 см</strong>.
                </li>
                <li>
                  Коробка может проходить лимиты стороны/суммы, но{" "}
                  <strong className="text-[var(--ink)]">
                    плохо ложиться на паллет
                  </strong>{" "}
                  — например 300×300 даёт 4×2 = 8 шт/слой и остаток 200 мм по
                  стороне 800.
                </li>
                <li>
                  Удобные основания делят 1200 и 800 без остатка: 100, 160×100,
                  200, 400 и т.п.
                </li>
              </ul>
            </article>
            <article className="border-t border-[var(--line)] pt-4 md:col-span-2">
              <h3 className="font-display text-xl font-semibold text-[var(--ink)]">
                Техлимиты производства и самосбор
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                <li>
                  Текущий станок: длина ≥{" "}
                  <strong className="text-[var(--ink)]">240 мм</strong>, высота ≥{" "}
                  <strong className="text-[var(--ink)]">80 мм</strong>,
                  ширина+высота ≥{" "}
                  <strong className="text-[var(--ink)]">280 мм</strong>.
                </li>
                <li>
                  Варианты{" "}
                  <strong className="text-[var(--ink)]">вне техлимитов не скрываем</strong>{" "}
                  — их можно сделать самосборной коробкой под заказную
                  штанцформу.
                </li>
                <li>
                  Плоский товар «врассыпную» считаем по занимаемому объёму
                  (например 6,6 л), а не только по идеальной стопке.
                </li>
              </ul>
            </article>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-[var(--muted)]">
            Источники: «Упаковка товаров для модели Маркетплейс (FBS)»,
            «Упаковка товаров для модели Склад WB (FBW) — общие правила»,
            «Ограничения по весу и габаритам товаров для разных моделей
            продаж», инструкции по электронике FBS/FBW. Перед отгрузкой
            сверяйте актуальные правила в кабинете продавца WB — лимиты могут
            обновляться.
          </p>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--line)]/80 py-6 text-center text-xs text-[var(--muted)]">
        Коробомер · подбор коробок для продавцов Wildberries
      </footer>
    </div>
  );
}

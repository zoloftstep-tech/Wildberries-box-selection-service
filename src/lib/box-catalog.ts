/** Каталог типовых внутренних размеров картонных коробок (мм). */

export interface CatalogBox {
  id: string;
  /** Внутренние размеры, мм */
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  label: string;
  popular?: boolean;
}

/** Типовые квадратные и прямоугольные коробки под штучный товар и наборы. */
export const BOX_CATALOG: CatalogBox[] = [
  { id: "100-80-50", lengthMm: 100, widthMm: 80, heightMm: 50, label: "100×80×50" },
  { id: "100-100-50", lengthMm: 100, widthMm: 100, heightMm: 50, label: "100×100×50" },
  { id: "100-100-100", lengthMm: 100, widthMm: 100, heightMm: 100, label: "100×100×100", popular: true },
  { id: "120-80-60", lengthMm: 120, widthMm: 80, heightMm: 60, label: "120×80×60" },
  { id: "120-120-80", lengthMm: 120, widthMm: 120, heightMm: 80, label: "120×120×80" },
  { id: "150-100-50", lengthMm: 150, widthMm: 100, heightMm: 50, label: "150×100×50" },
  { id: "150-100-100", lengthMm: 150, widthMm: 100, heightMm: 100, label: "150×100×100", popular: true },
  { id: "150-120-80", lengthMm: 150, widthMm: 120, heightMm: 80, label: "150×120×80" },
  { id: "150-150-100", lengthMm: 150, widthMm: 150, heightMm: 100, label: "150×150×100", popular: true },
  { id: "150-150-150", lengthMm: 150, widthMm: 150, heightMm: 150, label: "150×150×150", popular: true },
  { id: "160-110-50", lengthMm: 160, widthMm: 110, heightMm: 50, label: "160×110×50" },
  { id: "160-110-160", lengthMm: 160, widthMm: 110, heightMm: 160, label: "160×110×160", popular: true },
  { id: "160-120-160", lengthMm: 160, widthMm: 120, heightMm: 160, label: "160×120×160", popular: true },
  { id: "160-160-120", lengthMm: 160, widthMm: 160, heightMm: 120, label: "160×160×120", popular: true },
  { id: "160-160-160", lengthMm: 160, widthMm: 160, heightMm: 160, label: "160×160×160", popular: true },
  { id: "170-120-70", lengthMm: 170, widthMm: 120, heightMm: 70, label: "170×120×70" },
  { id: "180-120-80", lengthMm: 180, widthMm: 120, heightMm: 80, label: "180×120×80" },
  { id: "180-150-100", lengthMm: 180, widthMm: 150, heightMm: 100, label: "180×150×100" },
  { id: "200-100-100", lengthMm: 200, widthMm: 100, heightMm: 100, label: "200×100×100" },
  { id: "200-150-100", lengthMm: 200, widthMm: 150, heightMm: 100, label: "200×150×100", popular: true },
  { id: "200-150-150", lengthMm: 200, widthMm: 150, heightMm: 150, label: "200×150×150", popular: true },
  { id: "200-200-100", lengthMm: 200, widthMm: 200, heightMm: 100, label: "200×200×100" },
  { id: "200-200-150", lengthMm: 200, widthMm: 200, heightMm: 150, label: "200×200×150", popular: true },
  { id: "200-200-200", lengthMm: 200, widthMm: 200, heightMm: 200, label: "200×200×200", popular: true },
  { id: "220-160-100", lengthMm: 220, widthMm: 160, heightMm: 100, label: "220×160×100" },
  { id: "250-150-100", lengthMm: 250, widthMm: 150, heightMm: 100, label: "250×150×100" },
  { id: "250-180-100", lengthMm: 250, widthMm: 180, heightMm: 100, label: "250×180×100" },
  { id: "250-200-150", lengthMm: 250, widthMm: 200, heightMm: 150, label: "250×200×150", popular: true },
  { id: "250-250-150", lengthMm: 250, widthMm: 250, heightMm: 150, label: "250×250×150" },
  { id: "250-250-250", lengthMm: 250, widthMm: 250, heightMm: 250, label: "250×250×250" },
  { id: "300-200-150", lengthMm: 300, widthMm: 200, heightMm: 150, label: "300×200×150", popular: true },
  { id: "300-200-200", lengthMm: 300, widthMm: 200, heightMm: 200, label: "300×200×200", popular: true },
  { id: "300-250-150", lengthMm: 300, widthMm: 250, heightMm: 150, label: "300×250×150" },
  { id: "300-300-200", lengthMm: 300, widthMm: 300, heightMm: 200, label: "300×300×200" },
  { id: "350-250-150", lengthMm: 350, widthMm: 250, heightMm: 150, label: "350×250×150" },
  { id: "350-250-200", lengthMm: 350, widthMm: 250, heightMm: 200, label: "350×250×200" },
  { id: "400-300-200", lengthMm: 400, widthMm: 300, heightMm: 200, label: "400×300×200", popular: true },
  { id: "400-300-300", lengthMm: 400, widthMm: 300, heightMm: 300, label: "400×300×300" },
  { id: "400-400-300", lengthMm: 400, widthMm: 400, heightMm: 300, label: "400×400×300" },
  { id: "500-300-300", lengthMm: 500, widthMm: 300, heightMm: 300, label: "500×300×300" },
  { id: "500-400-300", lengthMm: 500, widthMm: 400, heightMm: 300, label: "500×400×300", popular: true },
  { id: "500-400-400", lengthMm: 500, widthMm: 400, heightMm: 400, label: "500×400×400" },
  { id: "600-400-400", lengthMm: 600, widthMm: 400, heightMm: 400, label: "600×400×400", popular: true },
  { id: "600-500-400", lengthMm: 600, widthMm: 500, heightMm: 400, label: "600×500×400" },
  { id: "800-600-400", lengthMm: 800, widthMm: 600, heightMm: 400, label: "800×600×400" },
  { id: "800-600-600", lengthMm: 800, widthMm: 600, heightMm: 600, label: "800×600×600" },
];

export function boxVolume(box: Pick<CatalogBox, "lengthMm" | "widthMm" | "heightMm">): number {
  return box.lengthMm * box.widthMm * box.heightMm;
}

export function sortedDims(a: number, b: number, c: number): [number, number, number] {
  return [a, b, c].sort((x, y) => y - x) as [number, number, number];
}

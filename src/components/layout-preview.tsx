"use client";

import { Canvas } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { spanWithOverlap } from "@/lib/layout-enumerate";
import type { LayoutCandidate } from "@/lib/layout-enumerate";
import type { ProductShape } from "@/lib/sizing";

export interface LayoutPreviewProps {
  layout: LayoutCandidate;
  shape: ProductShape;
  quantity: number;
  overlapMm?: number;
  gapMm?: number;
  /** Номинальная толщина/высота единицы из ввода, мм */
  nominalHeightMm?: number;
  /** Заявленный объём россыпи, л — если задан, tEff может быть выше номинала */
  occupiedVolumeLiters?: number | null;
  className?: string;
}

export interface UnitInstance {
  x: number;
  y: number;
  z: number;
  /** Визуальный размер (чуть меньше реального — чтобы видеть швы) */
  l: number;
  w: number;
  h: number;
  rotY: number;
  /** Чередование цвета */
  tone: 0 | 1;
}

function pitch(unitMm: number, overlapMm: number, gapMm: number): number {
  if (overlapMm > 0) {
    const capped = Math.max(0, Math.min(overlapMm, unitMm * 0.45));
    return unitMm - capped;
  }
  return unitMm + Math.max(0, gapMm);
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

export interface DividerInstance {
  x: number;
  y: number;
  z: number;
  l: number;
  w: number;
  h: number;
}

/** Пластины разделителя между стопками (другой цвет в 3D). */
export function buildDividerInstances(
  layout: LayoutCandidate,
  gapMm: number,
): DividerInstance[] {
  const gap = Math.max(0, gapMm);
  if (gap < 0.5) return [];
  const { nx, ny, pattern, unitOrient, productBlock, groupCount } = layout;
  if (pattern === "brick") return []; // упрощение: только uniform
  const S = Math.max(1, Math.min(groupCount, nx * ny));
  if (S < 2) return [];

  const uL = Math.max(0.5, unitOrient.lengthMm);
  const uW = Math.max(0.5, unitOrient.widthMm);
  const blockH = Math.max(1, productBlock.heightMm);
  const out: DividerInstance[] = [];

  if (nx > 1) {
    const spanX = spanAxis(uL, nx, 0, gap);
    const pitchX = uL + gap;
    const start = -spanX / 2 + uL;
    for (let i = 0; i < nx - 1; i++) {
      out.push({
        x: start + i * pitchX + gap / 2,
        y: 0,
        z: 0,
        l: gap * 0.85,
        w: Math.min(productBlock.widthMm, spanAxis(uW, ny, 0, gap)),
        h: blockH * 0.92,
      });
    }
  }
  if (ny > 1 && nx === 1) {
    const spanY = spanAxis(uW, ny, 0, gap);
    const pitchY = uW + gap;
    const start = -spanY / 2 + uW;
    for (let i = 0; i < ny - 1; i++) {
      out.push({
        x: 0,
        y: start + i * pitchY + gap / 2,
        z: 0,
        l: Math.min(productBlock.lengthMm, uL),
        w: gap * 0.85,
        h: blockH * 0.92,
      });
    }
  }
  return out;
}

/** Визуальный зазор между соседними единицами (не влияет на расчёт коробки). */
function visualInset(sizeMm: number): number {
  // 8–12% или минимум 0.6 мм — чтобы тонкие пакетики (~4 мм) тоже разделялись
  return Math.min(sizeMm * 0.12, Math.max(0.6, sizeMm * 0.08));
}

/**
 * Ровно `quantity` единиц.
 * Позиции и шаг = как в enumerate (overlap/gap на обеих осях плоскости).
 * stackAxis x/y — стопка лёжа (эталон на паллете).
 */
export function buildUnitInstances(
  layout: LayoutCandidate,
  quantity: number,
  overlapMm = 0,
  gapMm = 0,
): UnitInstance[] {
  const qty = Math.max(1, Math.floor(quantity) || 1);
  const {
    nx,
    ny,
    pattern,
    unitOrient,
    tEff,
    groupCount,
    productBlock,
    stackAxis = "z",
  } = layout;
  const S = Math.max(1, Math.min(groupCount, nx * ny));
  const uL = Math.max(0.5, unitOrient.lengthMm);
  const uW = Math.max(0.5, unitOrient.widthMm);
  const uH = Math.max(0.5, tEff || unitOrient.heightMm);
  const ov = Math.max(0, overlapMm);
  const gap = Math.max(0, gapMm);

  const base = Math.floor(qty / S);
  const extra = qty % S;

  type Slot = {
    ix: number;
    iy: number;
    count: number;
    brick: boolean;
    fl: number;
    fw: number;
  };
  const slots: Slot[] = [];
  let si = 0;
  for (let iy = 0; iy < ny && si < S; iy++) {
    for (let ix = 0; ix < nx && si < S; ix++) {
      const brick = pattern === "brick" && iy % 2 === 1;
      slots.push({
        ix,
        iy,
        count: base + (si < extra ? 1 : 0),
        brick,
        fl: brick ? uW : uL,
        fw: brick ? uL : uW,
      });
      si += 1;
    }
  }

  const isBrick = pattern === "brick";

  let spanX: number;
  let spanY: number;
  let pitchX: number;
  const rowCenterY: number[] = [];

  if (!isBrick) {
    spanX = spanAxis(uL, nx, ov, gap);
    spanY = spanAxis(uW, ny, ov, gap);
    pitchX = pitch(uL, ov, gap);
    const pitchY = pitch(uW, ov, gap);
    for (let iy = 0; iy < ny; iy++) {
      rowCenterY.push(-spanY / 2 + uW / 2 + iy * pitchY);
    }
  } else {
    const row1Len = spanAxis(uL, nx, ov, gap);
    const row2Len = spanAxis(uW, nx, ov, gap);
    spanX = Math.max(row1Len, row2Len);
    let y = 0;
    const depths: number[] = [];
    for (let r = 0; r < ny; r++) {
      const depth = r % 2 === 0 ? uW : uL;
      depths.push(depth);
      y = r === 0 ? depth : y + depth + gap;
    }
    spanY = y;
    let yCursor = -spanY / 2;
    for (let iy = 0; iy < ny; iy++) {
      const d = depths[iy]!;
      rowCenterY.push(yCursor + d / 2);
      yCursor += d + gap;
    }
    pitchX = 0;
  }

  const maxStackH = Math.max(...slots.map((s) => s.count * uH), uH);
  const insetL = visualInset(uL);
  const insetW = visualInset(uW);
  const insetH = visualInset(uH);

  let instances: UnitInstance[] = [];
  for (const slot of slots) {
    if (slot.count <= 0) continue;

    let cx: number;
    let cy: number;
    if (!isBrick) {
      cx = -spanX / 2 + uL / 2 + slot.ix * pitchX;
      cy = rowCenterY[slot.iy]!;
    } else {
      const fl = slot.fl;
      const rowPitchX = pitch(fl, ov, gap);
      const rowSpanX = spanAxis(fl, nx, ov, gap);
      cx = -rowSpanX / 2 + fl / 2 + slot.ix * rowPitchX;
      cy = rowCenterY[slot.iy]!;
    }

    for (let iz = 0; iz < slot.count; iz++) {
      const cz = -maxStackH / 2 + iz * uH + uH / 2;
      instances.push({
        x: cx,
        y: cy,
        z: cz,
        l: Math.max(0.3, slot.fl - insetL),
        w: Math.max(0.3, slot.fw - insetW),
        h: Math.max(0.25, uH - insetH),
        rotY: slot.brick ? Math.PI / 2 : 0,
        tone: ((slot.ix + slot.iy + iz) % 2) as 0 | 1,
      });
    }
  }

  // Стоя → лёжа: ось стопки из Z в плоскость паллета
  if (stackAxis === "y") {
    instances = instances.map((i) => ({
      ...i,
      x: i.x,
      y: i.z,
      z: i.y,
      l: i.l,
      w: i.h,
      h: i.w,
    }));
  } else if (stackAxis === "x") {
    instances = instances.map((i) => ({
      ...i,
      x: i.z,
      y: i.y,
      z: i.x,
      l: i.h,
      w: i.w,
      h: i.l,
    }));
  }

  const fitted = fitIntoBlock(instances, productBlock);
  return fitted.slice(0, qty);
}

/** Масштаб только если AABB > productBlock. */
function fitIntoBlock(
  instances: UnitInstance[],
  block: { lengthMm: number; widthMm: number; heightMm: number },
): UnitInstance[] {
  if (instances.length === 0) return instances;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const i of instances) {
    minX = Math.min(minX, i.x - i.l / 2);
    maxX = Math.max(maxX, i.x + i.l / 2);
    minY = Math.min(minY, i.y - i.w / 2);
    maxY = Math.max(maxY, i.y + i.w / 2);
    minZ = Math.min(minZ, i.z - i.h / 2);
    maxZ = Math.max(maxZ, i.z + i.h / 2);
  }

  const contentL = maxX - minX;
  const contentW = maxY - minY;
  const contentH = maxZ - minZ;
  const sx = contentL > block.lengthMm + 0.05 ? block.lengthMm / contentL : 1;
  const sy = contentW > block.widthMm + 0.05 ? block.widthMm / contentW : 1;
  const sz = contentH > block.heightMm + 0.05 ? block.heightMm / contentH : 1;
  const s = Math.min(sx, sy, sz, 1);

  if (s >= 0.999) return instances;

  return instances.map((i) => ({
    ...i,
    x: i.x * s,
    y: i.y * s,
    z: i.z * s,
    l: i.l * s,
    w: i.w * s,
    h: i.h * s,
  }));
}

function BoxShell({
  lengthMm,
  widthMm,
  heightMm,
}: {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}) {
  return (
    <mesh>
      <boxGeometry args={[lengthMm, widthMm, heightMm]} />
      <meshStandardMaterial
        color="#c4a574"
        transparent
        opacity={0.12}
        depthWrite={false}
      />
      <Edges color="#8b6914" threshold={15} />
    </mesh>
  );
}

const COLOR_A = new THREE.Color("#3d6b4f");
const COLOR_B = new THREE.Color("#5a9a6e");
const COLOR_A_RECT = new THREE.Color("#4169a8");
const COLOR_B_RECT = new THREE.Color("#6a8fc4");

function UnitInstances({
  units,
  shape,
}: {
  units: UnitInstance[];
  shape: ProductShape;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const isCyl = shape === "cylinder";

  const sameFootprint = useMemo(() => {
    if (units.length === 0) return true;
    const a = units[0]!;
    return units.every(
      (u) =>
        Math.abs(u.l - a.l) < 0.05 &&
        Math.abs(u.w - a.w) < 0.05 &&
        Math.abs(u.h - a.h) < 0.05,
    );
  }, [units]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !sameFootprint || units.length === 0) return;
    const dummy = new THREE.Object3D();
    const c0 = shape === "flat_stack" ? COLOR_A : COLOR_A_RECT;
    const c1 = shape === "flat_stack" ? COLOR_B : COLOR_B_RECT;
    for (let i = 0; i < units.length; i++) {
      const u = units[i]!;
      dummy.position.set(u.x, u.y, u.z);
      if (isCyl) dummy.rotation.set(Math.PI / 2, u.rotY, 0);
      else dummy.rotation.set(0, 0, u.rotY);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, u.tone === 0 ? c0 : c1);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = units.length;
  }, [units, sameFootprint, isCyl, shape]);

  if (units.length === 0) return null;

  if (!sameFootprint) {
    return (
      <group>
        {units.map((u, i) => {
          const color =
            shape === "flat_stack"
              ? u.tone === 0
                ? "#3d6b4f"
                : "#5a9a6e"
              : u.tone === 0
                ? "#4169a8"
                : "#6a8fc4";
          return (
            <mesh
              key={i}
              position={[u.x, u.y, u.z]}
              rotation={isCyl ? [Math.PI / 2, u.rotY, 0] : [0, 0, u.rotY]}
            >
              {isCyl ? (
                <cylinderGeometry
                  args={[
                    Math.min(u.l, u.w) / 2,
                    Math.min(u.l, u.w) / 2,
                    u.h,
                    16,
                  ]}
                />
              ) : (
                <boxGeometry args={[u.l, u.w, u.h]} />
              )}
              <meshStandardMaterial
                color={color}
                roughness={0.5}
                metalness={0.04}
              />
            </mesh>
          );
        })}
      </group>
    );
  }

  const u0 = units[0]!;
  const r = Math.min(u0.l, u0.w) / 2;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, units.length]}
    >
      {isCyl ? (
        <cylinderGeometry args={[r, r, u0.h, 16]} />
      ) : (
        <boxGeometry args={[u0.l, u0.w, u0.h]} />
      )}
      <meshStandardMaterial roughness={0.5} metalness={0.04} />
    </instancedMesh>
  );
}

function DividerMeshes({ items }: { items: DividerInstance[] }) {
  if (items.length === 0) return null;
  return (
    <group>
      {items.map((d, i) => (
        <mesh key={i} position={[d.x, d.y, d.z]}>
          <boxGeometry args={[d.l, d.w, d.h]} />
          <meshStandardMaterial
            color="#c45c26"
            roughness={0.65}
            metalness={0.02}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scene({
  layout,
  shape,
  quantity,
  overlapMm,
  gapMm,
}: {
  layout: LayoutCandidate;
  shape: ProductShape;
  quantity: number;
  overlapMm: number;
  gapMm: number;
}) {
  const units = useMemo(
    () => buildUnitInstances(layout, quantity, overlapMm, gapMm),
    [layout, quantity, overlapMm, gapMm],
  );
  const dividers = useMemo(
    () => buildDividerInstances(layout, gapMm),
    [layout, gapMm],
  );
  const box = layout.innerBox;
  const maxSide = Math.max(box.lengthMm, box.widthMm, box.heightMm);

  return (
    <>
      <color attach="background" args={["#f3efe6"]} />
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[maxSide, maxSide * 1.2, maxSide]}
        intensity={1.15}
      />
      <directionalLight
        position={[-maxSide * 0.5, maxSide * 0.4, -maxSide * 0.3]}
        intensity={0.4}
      />

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <BoxShell
          lengthMm={box.lengthMm}
          widthMm={box.widthMm}
          heightMm={box.heightMm}
        />
        <UnitInstances units={units} shape={shape} />
        <DividerMeshes items={dividers} />
      </group>

      <OrbitControls makeDefault enablePan />
    </>
  );
}

export function LayoutPreview({
  layout,
  shape,
  quantity,
  overlapMm = 0,
  gapMm = 0,
  nominalHeightMm,
  occupiedVolumeLiters,
  className,
}: LayoutPreviewProps) {
  const box = layout.innerBox;
  const maxSide = Math.max(box.lengthMm, box.widthMm, box.heightMm, 80);
  const camDist = maxSide * 1.55;
  const qty = Math.max(1, Math.floor(quantity) || 1);
  const unitCount = useMemo(
    () => buildUnitInstances(layout, qty, overlapMm, gapMm).length,
    [layout, qty, overlapMm, gapMm],
  );

  const nomH = nominalHeightMm ?? layout.unitOrient.heightMm;
  const tEff = layout.tEff;
  const inflated =
    occupiedVolumeLiters != null &&
    occupiedVolumeLiters > 0 &&
    tEff > nomH + 0.05;

  const unitSizeLabel = inflated
    ? `${Math.round(layout.unitOrient.lengthMm)}×${Math.round(layout.unitOrient.widthMm)}×${fmtThin(nomH)} мм (эфф. ${fmtThin(tEff)} мм по ${fmtVol(occupiedVolumeLiters)} л)`
    : `${Math.round(layout.unitOrient.lengthMm)}×${Math.round(layout.unitOrient.widthMm)}×${fmtThin(tEff)} мм`;

  return (
    <div
      className={
        className ??
        "overflow-hidden rounded-[var(--radius-lg,14px)] border border-[var(--line)] bg-[#f3efe6]"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--moss-deep)]">
          Превью укладки
        </p>
        <p className="text-[11px] text-[var(--muted)]">
          {unitCount} шт · {layout.summary}
        </p>
      </div>
      <div className="h-[240px] w-full sm:h-[280px]">
        <Canvas
          key={`${layout.id}-${qty}-${overlapMm}-${gapMm}`}
          dpr={[1, 1.75]}
          gl={{ antialias: true }}
          camera={{
            position: [camDist * 0.75, camDist * 0.55, camDist * 0.85],
            fov: 42,
            near: Math.max(0.5, maxSide / 500),
            far: maxSide * 40,
          }}
        >
          <Scene
            layout={layout}
            shape={shape}
            quantity={qty}
            overlapMm={overlapMm}
            gapMm={gapMm}
          />
        </Canvas>
      </div>
      <p className="border-t border-[var(--line)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
        {unitCount} ед. · габарит единицы {unitSizeLabel}
        {overlapMm > 0 ? ` · наложение ${overlapMm} мм` : ""}
        {gapMm > 0.5 ? ` · разделитель ${gapMm} мм` : ""}
        {" · "}
        коробка {box.lengthMm}×{box.widthMm}×{box.heightMm} мм
      </p>
    </div>
  );
}

function fmtThin(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function fmtVol(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
}

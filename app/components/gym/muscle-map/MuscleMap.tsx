"use client";

import React, { useMemo } from "react";
import type { BodyPart } from "./bodyTypes";
import { bodyFront } from "./bodyFront";
import { bodyBack } from "./bodyBack";

type View = "front" | "back";

export type MuscleMapProps = {
  view?: View;
  workedSlugs?: string[]; // e.g. ["chest","biceps","upper-back"]
  height?: number;
  onToggleSlug?: (slug: string) => void; // optional click support
  className?: string;
};

function toArr(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function partPaths(part: BodyPart): { side: "common" | "left" | "right"; d: string }[] {
  const p: any = part.path;

  const common = toArr(p.common).map((d) => ({ side: "common" as const, d }));
  const left = toArr(p.left).map((d) => ({ side: "left" as const, d }));
  const right = toArr(p.right).map((d) => ({ side: "right" as const, d }));

  return [...common, ...left, ...right].filter((x) => typeof x.d === "string" && x.d.trim().length > 0);
}

export default function MuscleMap({
  view = "front",
  workedSlugs = [],
  height = 260,
  onToggleSlug,
  className,
}: MuscleMapProps) {
  const parts = (view === "front" ? (bodyFront as BodyPart[]) : (bodyBack as BodyPart[])) ?? [];

  const worked = useMemo(() => {
    // Normalize to lowercase, because your slugs are lowercase like "upper-back" [file:97]
    return new Set((workedSlugs || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean));
  }, [workedSlugs]);

  // Your TS paths use big coordinates (e.g. x ~ 1400 on back) [file:97]
  // So we compute a viewBox that fits the data by using known bounds from your dataset:
  // Front seems around 0..700 x 0..1400; Back around 700..1450 x 0..1400 based on path numbers. [file:98][file:97]
  const viewBox = view === "front" ? "0 0 700 1400" : "700 0 750 1400";

  return (
    <div className={className} style={{ width: "100%", height }}>
      <svg
        viewBox={viewBox}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        {/* background silhouette could be added if your dataset includes it; for now we render muscles only */}
        {parts.map((part) => {
          const slug = String(part.slug || "").toLowerCase();
          const isWorked = worked.has(slug);

          const fill = isWorked ? "#ff2d2d" : `#${(part.color || "3f3f3f").replace("#", "")}`;
          const stroke = isWorked ? "#ff6b6b" : "#2b2b2b";
          const opacity = isWorked ? 0.95 : 0.55;

          const paths = partPaths(part);

          return (
            <g
              key={slug}
              role={onToggleSlug ? "button" : undefined}
              tabIndex={onToggleSlug ? 0 : undefined}
              onClick={onToggleSlug ? () => onToggleSlug(slug) : undefined}
              onKeyDown={
                onToggleSlug
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") onToggleSlug(slug);
                    }
                  : undefined
              }
              style={{ cursor: onToggleSlug ? "pointer" : "default" }}
            >
              {paths.map((p, idx) => (
                <path
                  key={`${slug}-${p.side}-${idx}`}
                  d={p.d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.5}
                  opacity={opacity}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

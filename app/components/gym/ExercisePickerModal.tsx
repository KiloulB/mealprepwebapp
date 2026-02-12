"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import gymStyles from "../../gym/gym.module.css";
import homeStyles from "../../home.module.css";
import MuscleMap from "./muscle-map/MuscleMap";
import type { FreeExercise } from "../../lib/freeExerciseDb";
import {
  buildExerciseTags,
  getExerciseImageUrl,
  searchExercises,
} from "../../lib/freeExerciseDb";
import { musclesToSlugs } from "../../lib/muscleSlugMap";
import type { GymExerciseRef } from "../../types/gym";

function toRef(ex: FreeExercise): GymExerciseRef {
  const imgRel = (ex.images || [])[0] || "";
  return {
    exerciseId: String(ex.id),
    name: ex.name,
    image: imgRel ? getExerciseImageUrl(imgRel) : "",
    primaryMuscles: ex.primaryMuscles || [],
    secondaryMuscles: ex.secondaryMuscles || [],
    tags: buildExerciseTags(ex),
    equipment: ex.equipment ? [String(ex.equipment)] : [],
  };
}

export default function ExercisePickerModal({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (payload: { exercises: GymExerciseRef[]; musclesWorked: string[] }) => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, GymExerciseRef>>({});
  const [info, setInfo] = useState<FreeExercise | null>(null);

  // Dropdown filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [muscleFilters, setMuscleFilters] = useState<Set<string>>(new Set());

  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click (common pattern: document mousedown + ref.contains) [web:16]
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      const inMenu = filterMenuRef.current?.contains(t);
      const inBtn = filterBtnRef.current?.contains(t);
      if (!inMenu && !inBtn) setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Base search results
  const items = useMemo(() => searchExercises(q), [q]);

  // Available muscles from current results (keeps the menu relevant)
  const availableMuscleSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const ex of items) {
      musclesToSlugs(ex.primaryMuscles || [], ex.secondaryMuscles || []).forEach((x) => s.add(x));
    }
    return [...s].sort();
  }, [items]);

  // Apply instant muscle filtering
  const filteredItems = useMemo(() => {
    if (muscleFilters.size === 0) return items;
    return items.filter((ex) => {
      const exSlugs = musclesToSlugs(ex.primaryMuscles || [], ex.secondaryMuscles || []);
      return exSlugs.some((s) => muscleFilters.has(s));
    });
  }, [items, muscleFilters]);

  const selectedArr = useMemo(() => Object.values(selected), [selected]);

  const allMusclesWorked = useMemo(() => {
    const slugs = new Set<string>();
    for (const r of selectedArr) {
      musclesToSlugs(r.primaryMuscles, r.secondaryMuscles).forEach((s) => slugs.add(s));
    }
    return [...slugs];
  }, [selectedArr]);

  if (!open) return null;

  return (
    <div className={gymStyles.sheetOverlay} onClick={onClose}>
      <div className={gymStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={gymStyles.sheetHandle} />

        <div className={gymStyles.sheetHeaderRow}>
          <input
            className={gymStyles.searchInput}
            placeholder="Zoek oefeningen..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {/* Filter dropdown trigger (left of Add) */}
          <div style={{ position: "relative" }}>
            <button
              ref={filterBtnRef}
              className={gymStyles.iconBtn}
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={filtersOpen}
              title="Filters"
            >
              Filters ({muscleFilters.size})
            </button>

            {filtersOpen ? (
              <div
                ref={filterMenuRef}
                role="menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 60,
                  width: 320,
                  maxWidth: "calc(100vw - 24px)",
                  padding: 10,
                  borderRadius: 12,
                  background: "rgba(16,16,16,0.98)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={homeStyles.modalInfoText} style={{ marginBottom: 8 }}>
                  Click muscles to instantly filter (primary + secondary).
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    className={gymStyles.secondaryBtn}
                    type="button"
                    onClick={() => setMuscleFilters(new Set())}
                    disabled={muscleFilters.size === 0}
                    role="menuitem"
                  >
                    Clear
                  </button>

                  <button
                    className={gymStyles.secondaryBtn}
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    role="menuitem"
                  >
                    Close
                  </button>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {availableMuscleSlugs.map((slug) => {
                    const active = muscleFilters.has(slug);
                    return (
                      <button
                        key={slug}
                        type="button"
                        className={active ? gymStyles.primaryBtn : gymStyles.secondaryBtn}
                        onClick={() => {
                          setMuscleFilters((prev) => {
                            const next = new Set(prev);
                            next.has(slug) ? next.delete(slug) : next.add(slug);
                            return next;
                          });
                        }}
                        role="menuitem"
                        aria-pressed={active}
                        title={slug}
                      >
                        {slug}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <button
            className={gymStyles.iconBtn}
            type="button"
            onClick={() => {
              onStart({ exercises: selectedArr, musclesWorked: allMusclesWorked });
            }}
            disabled={selectedArr.length === 0}
            title="Add selected"
          >
            Add ({selectedArr.length})
          </button>
        </div>

        <div className={gymStyles.sheetExercise}>
          {filteredItems.slice(0, 200).map((ex) => {
            const ref = toRef(ex);
            const isSel = Boolean(selected[ref.exerciseId]);
            const img = ref.image || "";

            return (
              <div
                key={ref.exerciseId}
                className={gymStyles.exerciseRow}
                onClick={() => {
                  setSelected((prev) => {
                    const next = { ...prev };
                    if (next[ref.exerciseId]) delete next[ref.exerciseId];
                    else next[ref.exerciseId] = ref;
                    return next;
                  });
                }}
                style={{
                  border: isSel ? "1px solid #ff2d2d" : "1px solid transparent",
                }}
              >
                {img ? (
                  <img className={gymStyles.exerciseImg} alt="" src={img} />
                ) : (
                  <div className={gymStyles.exerciseImg} />
                )}

                <div className={gymStyles.exerciseMain}>
                  <div className={gymStyles.exerciseName}>{ref.name}</div>

                  <div className={gymStyles.exerciseMeta}>
                    {[
                      ...(ref.primaryMuscles || []),
                      ...(ref.secondaryMuscles || []),
                    ]
                      .slice(0, 4)
                      .join(" • ")}
                    {((ref.primaryMuscles?.length || 0) + (ref.secondaryMuscles?.length || 0)) > 4
                      ? ` • +${(ref.primaryMuscles!.length + ref.secondaryMuscles!.length) - 4} more`
                      : ""}
                  </div>

                  {/* Tags are still available if you want them back */}
                  {/* {ref.tags?.length ? (
                    <div className={gymStyles.tagRow}>
                      {ref.tags.slice(0, 6).map((t) => (
                        <span key={t} className={gymStyles.tagChip}>
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null} */}
                </div>

                <button
                  className={gymStyles.infoBtn}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfo(ex);
                  }}
                  title="Info"
                >
                  i
                </button>
              </div>
            );
          })}

          {filteredItems.length > 200 ? (
            <div className={homeStyles.modalInfoText} style={{ padding: "12px 0" }}>
              Showing first 200 results. Narrow your search/filters.
            </div>
          ) : null}
        </div>

        <button className={gymStyles.secondaryBtn} type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {/* Info sheet */}
      {info ? (
        <div className={gymStyles.sheetOverlay} onClick={() => setInfo(null)}>
          <div className={gymStyles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={gymStyles.sheetHandle} />
            <div className={homeStyles.modalTitle}>{info.name}</div>

            <div className={`${homeStyles.modalSectionTitle} ${homeStyles.modalSectionTitleSpaced}`}>
              Instructions
            </div>
            {(info.instructions || []).length ? (
              (info.instructions || []).map((line, idx) => (
                <div key={idx} className={homeStyles.normalText} style={{ marginBottom: 8 }}>
                  {line}
                </div>
              ))
            ) : (
              <div className={homeStyles.modalEmptyText}>No instructions available.</div>
            )}

            <div className={`${homeStyles.modalSectionTitle} ${homeStyles.modalSectionTitleSpaced}`}>
              Muscles
            </div>
            <div className={homeStyles.normalText} style={{ marginBottom: 10 }}>
              Primary: {(info.primaryMuscles || []).join(", ") || "—"}
              <br />
              Secondary: {(info.secondaryMuscles || []).join(", ") || "—"}
            </div>

            {(() => {
              const slugs = musclesToSlugs(info.primaryMuscles || [], info.secondaryMuscles || []);
              return (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div className={homeStyles.modalSectionTitle}>Front</div>
                    <MuscleMap view="front" workedSlugs={slugs} height={260} />
                  </div>
                  <div>
                    <div className={homeStyles.modalSectionTitle}>Back</div>
                    <MuscleMap view="back" workedSlugs={slugs} height={260} />
                  </div>
                </div>
              );
            })()}

            <button className={gymStyles.secondaryBtn} type="button" onClick={() => setInfo(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

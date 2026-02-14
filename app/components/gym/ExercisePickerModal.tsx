// components/gym/ExercisePickerModal.tsx
"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import gymStyles from "../../gym/gym.module.css";
import homeStyles from "../../home.module.css";
import MuscleMap from "./muscle-map/MuscleMap";
import { FiX } from "react-icons/fi";
import { FiChevronLeft, FiCheck } from "react-icons/fi";
import type { FreeExercise } from "../../lib/freeExerciseDb";
import {
  buildExerciseTags,
  getExerciseById,
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

function niceLabel(s: string) {
  return (s || "").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function muscleToCategory(primaryMuscles: string[] = []) {
  const raw = primaryMuscles[0] || "";
  const m = raw.toLowerCase();

  if (m.includes("ab") || m.includes("core") || m.includes("rectus") || m.includes("oblique"))
    return "Core";
  if (m.includes("back") || m.includes("lat") || m.includes("trap") || m.includes("rhombo"))
    return "Back";
  if (m.includes("chest") || m.includes("pec")) return "Chest";
  if (m.includes("shoulder") || m.includes("delt")) return "Shoulder";
  if (m.includes("bicep") || m.includes("tricep") || m.includes("forearm")) return "Arms";
  if (
    m.includes("quad") ||
    m.includes("ham") ||
    m.includes("glute") ||
    m.includes("calf") ||
    m.includes("leg")
  )
    return "Legs";
  if (m.includes("cardio")) return "Cardio";

  return raw ? niceLabel(raw) : "Other";
}

function ExerciseStepPlayer({
  images,
  alt,
  intervalMs = 750,
  className,
}: {
  images?: string[];
  alt: string;
  intervalMs?: number;
  className?: string;
}) {
  const resolved = useMemo(() => {
    const arr = Array.isArray(images) ? images.filter(Boolean) : [];
    return arr.map((rel) => getExerciseImageUrl(rel));
  }, [images]);

  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [resolved.length]);

  useEffect(() => {
    if (resolved.length <= 1) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % resolved.length), intervalMs);
    return () => window.clearInterval(id);
  }, [resolved.length, intervalMs]);

  if (resolved.length === 0) {
    return <div className={className} aria-label="No image" />;
  }

  return <img src={resolved[idx]} alt={alt} className={className} loading="lazy" draggable={false} />;
}


function equipmentToType(equipmentArr: string[] = []) {
  const raw = equipmentArr[0] || "";
  const e = raw.toLowerCase();

  if (!raw) return "";
  if (e.includes("bodyweight")) return "Bodyweight";
  if (e.includes("dumbbell")) return "Dumbbell";
  if (e.includes("barbell")) return "Barbell";
  if (e.includes("kettlebell")) return "Kettlebell";
  if (e.includes("machine")) return "Machine";
  if (e.includes("cable")) return "Cable";
  if (e.includes("band")) return "Band";
  if (e.includes("smith")) return "Machine";

  return niceLabel(raw);
}

function buildSubtitle(ref: GymExerciseRef) {
  const a = muscleToCategory(ref.primaryMuscles || []);
  const b = equipmentToType(ref.equipment || []);
  return b ? `${a} • ${b}` : a;
}

type RowModel = {
  ex: FreeExercise;
  ref: GymExerciseRef;
  subtitle: string;
};

const ExerciseRow = memo(function ExerciseRow(props: {
  model: RowModel;
  selected: boolean;
  onToggleSelect: (id: string, ref: GymExerciseRef) => void;
  onInfo: (ex: FreeExercise) => void;
}) {
  const { model, selected, onToggleSelect, onInfo } = props;

  return (
    <div
      className={gymStyles.exerciseRow}
      data-selected={selected ? "true" : "false"}
      onClick={() => onToggleSelect(model.ref.exerciseId, model.ref)}
    >
      {model.ref.image ? (
        <img className={gymStyles.exerciseImg} alt="" src={model.ref.image} />
      ) : (
        <div className={gymStyles.exerciseImg} />
      )}

      <div className={gymStyles.exerciseMain}>
        <div className={gymStyles.exerciseName}>{model.ref.name}</div>
        <div className={gymStyles.exerciseMeta}>{model.subtitle}</div>
      </div>

      <div className={gymStyles.rowActions}>
        {selected ? (
          <span className={gymStyles.rowIconBtn} aria-label="Geselecteerd" title="Geselecteerd" style={{ border: 'none', background: 'transparent', color: '#22c55e', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiCheck size={18} />
          </span>
        ) : (
          <button
            className={gymStyles.rowIconBtn}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInfo(model.ex);
            }}
            aria-label="Info"
            title="Info"
          >
            i
          </button>
        )}
      </div>
    </div>
  );
});

type InfoSource = "direct" | "list";

export default function ExercisePickerModal({
  open,
  onClose,
  onStart,
  initialInfoExerciseId,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (payload: { exercises: GymExerciseRef[]; musclesWorked: string[] }) => void;
  initialInfoExerciseId?: string | null;
}) {
  const [q, setQ] = useState("");
  const [info, setInfo] = useState<FreeExercise | null>(null);

  // NEW: where did “info view” come from?
  const [infoSource, setInfoSource] = useState<InfoSource>("list");

  // Selection (fast)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRefs, setSelectedRefs] = useState<Map<string, GymExerciseRef>>(new Map());

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [muscleFilters, setMuscleFilters] = useState<Set<string>>(new Set());

  // Selected chip (UI)
  const [selectedOnly, setSelectedOnly] = useState(false);

  // “Type” chip purely UI (visual)
  const [typeChipOn, setTypeChipOn] = useState(false);

  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  const infoOnlyMode = !!initialInfoExerciseId;

  // If modal is opened from workout page with an id: go straight to info
  useEffect(() => {
    if (!open) return;

    if (initialInfoExerciseId) {
      setInfoSource("direct");
      setInfo(getExerciseById(initialInfoExerciseId));
    } else {
      // normal open
      setInfoSource("list");
      setInfo(null);
    }
  }, [open, initialInfoExerciseId]);

  // Click outside closes popover
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && filtersOpen) {
        setFiltersOpen(false);
        filterBtnRef.current?.focus();
        return;
      }

      if (e.key === "Escape" && info && infoSource === "list") {
        // list → info: Esc should go back to list
        setInfo(null);
        return;
      }

      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtersOpen, info, infoSource, open, onClose]);

  const items = useMemo(() => searchExercises(q), [q]);

  const availableMuscleSlugs = useMemo(() => {
    const s = new Set<string>();
    for (const ex of items) {
      musclesToSlugs(ex.primaryMuscles || [], ex.secondaryMuscles || []).forEach((x) => s.add(x));
    }
    return [...s].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let base = items;

    if (muscleFilters.size > 0) {
      base = base.filter((ex) => {
        const exSlugs = musclesToSlugs(ex.primaryMuscles || [], ex.secondaryMuscles || []);
        return exSlugs.some((s) => muscleFilters.has(s));
      });
    }

    if (selectedOnly) {
      base = base.filter((ex) => selectedIds.has(String(ex.id)));
    }

    return base;
  }, [items, muscleFilters, selectedOnly, selectedIds]);

  const rows: RowModel[] = useMemo(() => {
    const arr = [...filteredItems].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return arr.slice(0, 100).map((ex) => {
      const ref = toRef(ex);
      return { ex, ref, subtitle: buildSubtitle(ref) };
    });
  }, [filteredItems]);

  const selectedCount = selectedIds.size;
  const selectedArr = useMemo(() => Array.from(selectedRefs.values()), [selectedRefs]);

  const allMusclesWorked = useMemo(() => {
    const slugs = new Set<string>();
    for (const r of selectedArr) {
      musclesToSlugs(r.primaryMuscles, r.secondaryMuscles).forEach((s) => slugs.add(s));
    }
    return [...slugs];
  }, [selectedArr]);

  const onToggleSelect = useCallback((id: string, ref: GymExerciseRef) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

    setSelectedRefs((prev) => {
      const next = new Map(prev);
      next.has(id) ? next.delete(id) : next.set(id, ref);
      return next;
    });
  }, []);

  const onInfoFromList = useCallback((ex: FreeExercise) => {
    setInfoSource("list");
    setInfo(ex);
  }, []);

  const toggleMuscle = useCallback((slug: string) => {
    setMuscleFilters((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }, []);

  const clearMuscles = useCallback(() => setMuscleFilters(new Set()), []);

  if (!open) return null;

  // If opened from workout: never show list, only info (or not-found)
  if (infoOnlyMode) {
    return (
      <div className={gymStyles.sheetOverlay} onClick={onClose}>
        <div className={gymStyles.sheet} onClick={(e) => e.stopPropagation()}>
          <div className={gymStyles.sheetHandle} />

          <div className={gymStyles.headerBlock}>
            <div className={gymStyles.headerTopRow}>
              <button className={gymStyles.closeX} type="button" onClick={onClose} aria-label="Close">
                <FiX size={20} />
              </button>
            </div>
          </div>

          {info ? (
            <div className={gymStyles.infoContainer}>
              <div className={homeStyles.modalTitle}>{info.name}</div>





              <div className={`${homeStyles.modalSectionTitle} ${homeStyles.modalSectionTitleSpaced}`}>
                Instructions
              </div>
                            <ExerciseStepPlayer
  images={info.images}
  alt={info.name}
  className={gymStyles.infoStepImg}
/>
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
<div className={gymStyles.infoMuscleMaps}>
  <div className={gymStyles.infoMuscleMapItem}>
    <div className={homeStyles.modalSectionTitle}>Front</div>
    <MuscleMap view="front" workedSlugs={slugs} height={250} />
  </div>

  <div className={gymStyles.infoMuscleMapItem}>
    <div className={homeStyles.modalSectionTitle}>Back</div>
    <MuscleMap view="back" workedSlugs={slugs} height={250} />
  </div>
</div>
                );
              })()}
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <div className={homeStyles.modalTitle}>Exercise not found</div>
              <div className={homeStyles.modalEmptyText} style={{ padding: "12px 0" }}>
                This workout exerciseId is not in exercises.json.
              </div>
              <button className={gymStyles.secondaryBtn} type="button" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Normal picker mode: show list, and if info is set show info overlay on top
  return (
    <div className={gymStyles.sheetOverlay} onClick={onClose}>
      <div className={gymStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={gymStyles.sheetHandle} />

        {/* Header */}
        <div className={gymStyles.headerBlock}>
          <div className={gymStyles.headerTopRow}>
            <button className={gymStyles.closeX} type="button" onClick={onClose} aria-label="Close">
              <FiX size={20} />
            </button>

            <button
              className={gymStyles.addBtn}
              type="button"
              onClick={() => onStart({ exercises: selectedArr, musclesWorked: allMusclesWorked })}
              disabled={selectedCount === 0}
              title="Add selected"
            >
              Add ({selectedCount})
            </button>
          </div>

          <div className={gymStyles.searchRow}>
            <input
              className={gymStyles.searchInput}
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className={gymStyles.chipRow}>
            <div style={{ position: "relative" }}>
              <button
                ref={filterBtnRef}
                type="button"
                className={`${gymStyles.chipBtn} ${muscleFilters.size ? gymStyles.chipBtnActive : ""}`}
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-haspopup="dialog"
              >
                Body
              </button>

              {filtersOpen ? (
                <div
                  ref={filterMenuRef}
                  className={gymStyles.popover}
                  role="dialog"
                  aria-label="Body filters"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={gymStyles.popoverHeader}>
                    <div className={gymStyles.popoverTitle}>Body</div>
                    <button
                      className={gymStyles.popoverLinkBtn}
                      type="button"
                      onClick={clearMuscles}
                      disabled={muscleFilters.size === 0}
                    >
                      Clear
                    </button>
                  </div>

                  <div className={gymStyles.popoverGrid}>
                    {availableMuscleSlugs.map((slug) => {
                      const active = muscleFilters.has(slug);
                      return (
                        <button
                          key={slug}
                          type="button"
                          className={`${gymStyles.popoverOption} ${
                            active ? gymStyles.popoverOptionActive : ""
                          }`}
                          onClick={() => toggleMuscle(slug)}
                          aria-pressed={active}
                          title={slug}
                        >
                          {niceLabel(slug)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={
                `${gymStyles.chipBtn} ${selectedOnly ? gymStyles.chipBtnActive : ""}` +
                (selectedCount > 0 ? ` ${gymStyles.chipBtnSelected}` : "")
              }
              onClick={() => setSelectedOnly((v) => !v)}
              aria-pressed={selectedOnly}
              title="Selected"
              style={selectedCount > 0 ? { color: '#8dcf42', background: '#1a2b07', borderColor: '#395716' } : {}}
            >
              Selected ({selectedCount})
            </button>
          </div>
        </div>

        {/* List */}
        <div className={gymStyles.sheetExercise}>
          {rows.map((model) => (
            <ExerciseRow
              key={model.ref.exerciseId}
              model={model}
              selected={selectedIds.has(model.ref.exerciseId)}
              onToggleSelect={onToggleSelect}
              onInfo={onInfoFromList}
            />
          ))}

          {filteredItems.length > 100 ? (
            <div className={homeStyles.modalInfoText} style={{ padding: "25px 0 15px" }}>
              Showing first 100 results. Narrow your search.
            </div>
          ) : null}

          {rows.length === 0 ? (
            <div className={homeStyles.modalEmptyText} style={{ padding: "12px 0" }}>
              No exercises match your filters.
            </div>
          ) : null}

        </div>
      </div>

      {/* Info overlay ONLY when user clicked info from list */}
      {info && infoSource === "list" ? (
        <div className={gymStyles.sheetOverlay} onClick={() => setInfo(null)}>
          <div className={gymStyles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={gymStyles.sheetHandle} />

            <div className={gymStyles.headerBlock}>
              <div className={gymStyles.headerTopRow}>
                {/* ✅ chevron: back to list */}
                <button
                  className={gymStyles.closeX}
                  type="button"
                  onClick={() => setInfo(null)}
                  aria-label="Back"
                  title="Back"
                >
                  <FiChevronLeft size={22} />
                </button>

                {/* Optional: keep an X on the right to close modal entirely */}
                <div style={{ flex: 1 }} />

                <button
                  className={gymStyles.closeX}
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  title="Close"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>

            <div className={gymStyles.infoContainer}>
              <div className={homeStyles.modalTitle}>{info.name}</div>


              <div className={`${homeStyles.modalSectionTitle} ${homeStyles.modalSectionTitleSpaced}`}>
                Instructions
              </div>
                                          <ExerciseStepPlayer
  images={info.images}
  alt={info.name}
  className={gymStyles.infoStepImg}
/>
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
<div className={gymStyles.infoMuscleMaps}>
  <div className={gymStyles.infoMuscleMapItem}>
    <div className={homeStyles.modalSectionTitle}>Front</div>
    <MuscleMap view="front" workedSlugs={slugs} height={250} />
  </div>

  <div className={gymStyles.infoMuscleMapItem}>
    <div className={homeStyles.modalSectionTitle}>Back</div>
    <MuscleMap view="back" workedSlugs={slugs} height={250} />
  </div>
</div>


                );
              })()}

              <button className={gymStyles.secondaryBtn} type="button" onClick={() => setInfo(null)}>
                Back to list
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

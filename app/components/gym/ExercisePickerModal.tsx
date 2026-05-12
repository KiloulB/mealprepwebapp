// components/gym/ExercisePickerModal.tsx
"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import gymStyles from "../../gym/gym.module.css";
import homeStyles from "../../home.module.css";
import MuscleMap from "./muscle-map/MuscleMap";
import { FiX, FiChevronLeft, FiCheck, FiInfo, FiSearch } from "react-icons/fi";
import { IoBodyOutline } from "react-icons/io5";
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
    return "Rug";
  if (m.includes("chest") || m.includes("pec")) return "Borst";
  if (m.includes("shoulder") || m.includes("delt")) return "Schouder";
  if (m.includes("bicep") || m.includes("tricep") || m.includes("forearm")) return "Armen";
  if (
    m.includes("quad") ||
    m.includes("ham") ||
    m.includes("glute") ||
    m.includes("calf") ||
    m.includes("leg")
  )
    return "Benen";
  if (m.includes("cardio")) return "Cardio";

  return raw ? niceLabel(raw) : "Overig";
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
  if (e.includes("bodyweight")) return "Eigen lichaamsgewicht";
  if (e.includes("dumbbell")) return "Dumbbell";
  if (e.includes("barbell")) return "Barbell";
  if (e.includes("kettlebell")) return "Kettlebell";
  if (e.includes("machine")) return "Machine";
  if (e.includes("cable")) return "Cable";
  if (e.includes("band")) return "Weerstandsband";
  if (e.includes("smith")) return "Machine";

  return niceLabel(raw);
}

function buildSubtitle(ref: GymExerciseRef) {
  const a = muscleToCategory(ref.primaryMuscles || []);
  const b = equipmentToType(ref.equipment || []);
  return b ? `${a} · ${b}` : a;
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
      className={`${gymStyles.pickerExRow} ${selected ? gymStyles.pickerExRowSelected : ""}`}
      onClick={() => onToggleSelect(model.ref.exerciseId, model.ref)}
    >
      {model.ref.image ? (
        <img className={gymStyles.pickerExImg} alt="" src={model.ref.image} loading="lazy" />
      ) : (
        <div className={gymStyles.pickerExImgEmpty}>
          <IoBodyOutline size={22} />
        </div>
      )}

      <div className={gymStyles.pickerExMain}>
        <div className={gymStyles.pickerExName}>{model.ref.name}</div>
        <div className={gymStyles.pickerExSub}>{model.subtitle}</div>
      </div>

      <div className={gymStyles.pickerExAction}>
        {selected ? (
          <div className={gymStyles.pickerExCheckOn} aria-label="Geselecteerd">
            <FiCheck size={14} />
          </div>
        ) : (
          <button
            className={gymStyles.pickerExInfoBtn}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInfo(model.ex);
            }}
            aria-label="Info"
          >
            <FiInfo size={14} />
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
  const [infoSource, setInfoSource] = useState<InfoSource>("list");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRefs, setSelectedRefs] = useState<Map<string, GymExerciseRef>>(new Map());

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [muscleFilters, setMuscleFilters] = useState<Set<string>>(new Set());
  const [selectedOnly, setSelectedOnly] = useState(false);

  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const infoOnlyMode = !!initialInfoExerciseId;

  useEffect(() => {
    if (!open) return;
    if (initialInfoExerciseId) {
      setInfoSource("direct");
      setInfo(getExerciseById(initialInfoExerciseId));
    } else {
      setInfoSource("list");
      setInfo(null);
    }
  }, [open, initialInfoExerciseId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && filtersOpen) {
        setFiltersOpen(false);
        filterBtnRef.current?.focus();
        return;
      }
      if (e.key === "Escape" && info && infoSource === "list") {
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

  /* ── Info-only mode (opened from workout page) ── */
  if (infoOnlyMode) {
    return (
      <div className={gymStyles.sheetOverlay} onClick={onClose}>
        <div className={gymStyles.infoSheet} onClick={(e) => e.stopPropagation()}>
          <div className={gymStyles.sheetHandle} />
          <div className={gymStyles.headerBlock}>
            <div className={gymStyles.headerTopRow}>
              <button className={gymStyles.closeX} type="button" onClick={onClose} aria-label="Sluiten">
                <FiX size={20} />
              </button>
            </div>
          </div>
          {info ? (
            <InfoContent info={info} onBack={null} />
          ) : (
            <div style={{ padding: 16 }}>
              <div className={homeStyles.modalTitle}>Oefening niet gevonden</div>
              <div className={homeStyles.modalEmptyText} style={{ padding: "12px 0" }}>
                Dit workout exerciseId staat niet in exercises.json.
              </div>
              <button className={gymStyles.secondaryBtn} type="button" onClick={onClose}>
                Sluiten
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Normal picker mode ── */
  return (
    <>
      <div className={gymStyles.pickerScreen}>
        {/* Nav bar */}
        <div className={gymStyles.pickerNavBar}>
          <div className={gymStyles.pickerNavSpacer} />
          <div className={gymStyles.pickerNavTitle}>Oefening kiezen</div>
          <button className={gymStyles.closeX} type="button" onClick={onClose} aria-label="Sluiten">
            <FiX size={18} />
          </button>
        </div>

        {/* Search */}
        <div className={gymStyles.pickerSearchZone}>
          <div className={gymStyles.pickerSearchWrap}>
            <span className={gymStyles.pickerSearchIcon}>
              <FiSearch size={16} />
            </span>
            <input
              className={gymStyles.pickerSearchInput}
              placeholder="Zoek oefening…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                className={gymStyles.pickerSearchClear}
                type="button"
                onClick={() => setQ("")}
                aria-label="Wissen"
              >
                <FiX size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className={gymStyles.pickerChipScroll}>
          <button
            ref={filterBtnRef}
            type="button"
            className={`${gymStyles.pickerChip} ${muscleFilters.size > 0 ? gymStyles.pickerChipActive : ""}`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            {muscleFilters.size > 0 ? `Spieren (${muscleFilters.size})` : "Spieren"}
          </button>
          {selectedCount > 0 && (
            <button
              type="button"
              className={`${gymStyles.pickerChip} ${selectedOnly ? gymStyles.pickerChipActive : gymStyles.pickerChipSelected}`}
              onClick={() => setSelectedOnly((v) => !v)}
              aria-pressed={selectedOnly}
            >
              {selectedCount} geselecteerd
            </button>
          )}
        </div>

        {/* Muscle filter panel */}
        {filtersOpen && (
          <div className={gymStyles.pickerFilterPanel}>
            <div className={gymStyles.pickerFilterHeader}>
              <span className={gymStyles.pickerFilterTitle}>Spiergroep</span>
              <button
                className={gymStyles.pickerFilterClear}
                type="button"
                onClick={clearMuscles}
                disabled={muscleFilters.size === 0}
              >
                Wissen
              </button>
            </div>
            <div className={gymStyles.pickerFilterGrid}>
              {availableMuscleSlugs.map((slug) => {
                const active = muscleFilters.has(slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    className={`${gymStyles.pickerChip} ${active ? gymStyles.pickerChipActive : ""}`}
                    onClick={() => toggleMuscle(slug)}
                    aria-pressed={active}
                  >
                    {niceLabel(slug)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={gymStyles.pickerSeparator} />

        {/* Exercise list */}
        <div className={gymStyles.pickerScroll}>
          {rows.map((model) => (
            <ExerciseRow
              key={model.ref.exerciseId}
              model={model}
              selected={selectedIds.has(model.ref.exerciseId)}
              onToggleSelect={onToggleSelect}
              onInfo={onInfoFromList}
            />
          ))}

          {filteredItems.length > 100 && (
            <div className={gymStyles.pickerOverflowNote}>
              Alleen de eerste 100 resultaten worden getoond. Verfijn je zoekopdracht.
            </div>
          )}

          {rows.length === 0 && (
            <div className={gymStyles.pickerEmptyState}>
              Geen oefeningen gevonden. Pas je zoekopdracht of filters aan.
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className={gymStyles.pickerFooterBar}>
          <button
            className={gymStyles.sheetFooterBtn}
            type="button"
            onClick={() => onStart({ exercises: selectedArr, musclesWorked: allMusclesWorked })}
            disabled={selectedCount === 0}
          >
            {selectedCount === 0
              ? "Selecteer oefeningen om te beginnen"
              : `Start workout · ${selectedCount} oefening${selectedCount !== 1 ? "en" : ""}`}
          </button>
        </div>
      </div>

      {/* Info overlay — stacks above the fullscreen picker */}
      {info && infoSource === "list" && (
        <div className={gymStyles.pickerInfoOverlay} onClick={() => setInfo(null)}>
          <div className={gymStyles.infoSheet} onClick={(e) => e.stopPropagation()}>
            <div className={gymStyles.sheetHandle} />
            <div className={gymStyles.headerBlock}>
              <div className={gymStyles.headerTopRow}>
                <button
                  className={gymStyles.closeX}
                  type="button"
                  onClick={() => setInfo(null)}
                  aria-label="Terug"
                >
                  <FiChevronLeft size={22} />
                </button>
                <div style={{ flex: 1 }} />
                <button
                  className={gymStyles.closeX}
                  type="button"
                  onClick={onClose}
                  aria-label="Sluiten"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>
            <InfoContent
              info={info}
              onBack={() => setInfo(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ── Shared info panel ── */
function InfoContent({
  info,
  onBack,
}: {
  info: FreeExercise;
  onBack: (() => void) | null;
}) {
  const slugs = musclesToSlugs(info.primaryMuscles || [], info.secondaryMuscles || []);

  return (
    <div className={gymStyles.infoContainer}>
      <div className={homeStyles.modalTitle}>{info.name}</div>

      <ExerciseStepPlayer
        images={info.images}
        alt={info.name}
        className={gymStyles.infoStepImg}
      />

      <div className={`${homeStyles.modalSectionTitle} ${homeStyles.modalSectionTitleSpaced}`}>
        Instructies
      </div>
      {(info.instructions || []).length ? (
        (info.instructions || []).map((line, idx) => (
          <div key={idx} className={homeStyles.normalText} style={{ marginBottom: 8 }}>
            {line}
          </div>
        ))
      ) : (
        <div className={homeStyles.modalEmptyText}>Geen instructies beschikbaar.</div>
      )}

      <div className={`${homeStyles.modalSectionTitle} ${homeStyles.modalSectionTitleSpaced}`}>
        Spieren
      </div>
      <div className={homeStyles.normalText} style={{ marginBottom: 10 }}>
        Primair: {(info.primaryMuscles || []).join(", ") || "—"}
        <br />
        Secundair: {(info.secondaryMuscles || []).join(", ") || "—"}
      </div>

      <div className={gymStyles.infoMuscleMaps}>
        <div className={gymStyles.infoMuscleMapItem}>
          <div className={homeStyles.modalSectionTitle}>Voorkant</div>
          <MuscleMap view="front" workedSlugs={slugs} height={250} />
        </div>
        <div className={gymStyles.infoMuscleMapItem}>
          <div className={homeStyles.modalSectionTitle}>Achterkant</div>
          <MuscleMap view="back" workedSlugs={slugs} height={250} />
        </div>
      </div>

      {onBack && (
        <button className={gymStyles.secondaryBtn} type="button" onClick={onBack}>
          Terug naar lijst
        </button>
      )}
    </div>
  );
}

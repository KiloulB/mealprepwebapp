// components/gym/TemplateMakerModal.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import gymStyles from "../../gym/gym.module.css";
import homeStyles from "../../home.module.css";
import { FiX } from "react-icons/fi";
import { FaRegTrashAlt } from "react-icons/fa";

import ExercisePickerModal from "./ExercisePickerModal";
import MuscleMap from "./muscle-map/MuscleMap";

import type { GymExerciseRef, GymTemplate, GymTemplateExercise, GymTemplateSet } from "../../types/gym";
import { musclesToSlugs } from "../../lib/muscleSlugMap";
import { saveGymTemplate } from "../../firebase/gymService";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultTemplateSets(): GymTemplateSet[] {
  // Example default for first time. User can edit per set.
  return [
    { id: id(), targetReps: 12, targetKg: 0 },
    { id: id(), targetReps: 10, targetKg: 0 },
    { id: id(), targetReps: 8, targetKg: 0 },
  ];
}

function toTemplateExercises(refs: GymExerciseRef[]): GymTemplateExercise[] {
  return refs.map((ref) => ({
    id: id(),
    ref,
    sets: defaultTemplateSets(),
  }));
}

export default function TemplateMakerModal({
  open,
  uid,
  onClose,
  onSaved,
}: {
  open: boolean;
  uid: string;
  onClose: () => void;
  onSaved?: (templateId: string) => void;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<GymTemplateExercise[]>([]);
  const [busy, setBusy] = useState(false);

  // internal picker
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    setName("");
    setEditing([]);
    setBusy(false);
    setPickerOpen(false);
  }, [open]);

  const selectedCount = editing.length;

  const musclesWorked = useMemo(() => {
    const slugs = new Set<string>();
    for (const ex of editing) {
      musclesToSlugs(ex.ref.primaryMuscles || [], ex.ref.secondaryMuscles || []).forEach((s) => slugs.add(s));
    }
    return [...slugs];
  }, [editing]);

  const canSave =
    !!uid &&
    name.trim().length > 0 &&
    editing.length > 0 &&
    editing.every((ex) => Array.isArray(ex.sets) && ex.sets.length > 0);

  const updateSetField = useCallback(
    (templateExerciseId: string, templateSetId: string, field: "targetKg" | "targetReps", raw: string) => {
      const parsed =
        raw.trim() === ""
          ? 0
          : field === "targetKg"
          ? Number(raw)
          : parseInt(raw, 10);

      setEditing((prev) =>
        prev.map((ex) => {
          if (ex.id !== templateExerciseId) return ex;
          return {
            ...ex,
            sets: (ex.sets || []).map((s) => (s.id === templateSetId ? { ...s, [field]: parsed } : s)),
          };
        })
      );
    },
    []
  );

  const addSet = useCallback((templateExerciseId: string) => {
    setEditing((prev) =>
      prev.map((ex) => {
        if (ex.id !== templateExerciseId) return ex;
        const last = ex.sets?.[ex.sets.length - 1];
        const nextSet: GymTemplateSet = {
          id: id(),
          targetReps: typeof last?.targetReps === "number" ? last.targetReps : 8,
          targetKg: typeof last?.targetKg === "number" ? last.targetKg : 0,
        };
        return { ...ex, sets: [...(ex.sets || []), nextSet] };
      })
    );
  }, []);

  const deleteSet = useCallback((templateExerciseId: string, templateSetId: string) => {
    setEditing((prev) =>
      prev.map((ex) => {
        if (ex.id !== templateExerciseId) return ex;
        const nextSets = (ex.sets || []).filter((s) => s.id !== templateSetId);
        return { ...ex, sets: nextSets };
      })
    );
  }, []);

  const removeExercise = useCallback((templateExerciseId: string) => {
    setEditing((prev) => prev.filter((ex) => ex.id !== templateExerciseId));
  }, []);

  async function handleSave() {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      const payload: Omit<GymTemplate, "id"> = {
        name: name.trim(),
        createdAt: Date.now(),
        musclesWorked,
        exercises: editing,
      };

      const templateId = await saveGymTemplate(uid, payload as any);
      onClose();
      onSaved?.(templateId);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className={gymStyles.sheetOverlay} onClick={onClose}>
      <div
        className={gymStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Make template"
      >
        <div className={gymStyles.sheetHandle} />

        <div className={gymStyles.headerBlock}>
          <div className={gymStyles.headerTopRow}>
            <button className={gymStyles.closeX} type="button" onClick={onClose} aria-label="Close">
              <FiX size={20} />
            </button>

            <button
              className={gymStyles.addBtn}
              type="button"
              onClick={handleSave}
              disabled={!canSave || busy}
              title={!uid ? "Sign in to save templates" : "Save template"}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>

          <div className={gymStyles.searchRow}>
            <input
              className={gymStyles.searchInput}
              placeholder="Template name (e.g. Workout A, PPL)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className={gymStyles.chipRow}>
            <button
              type="button"
              className={gymStyles.chipBtn}
              onClick={() => setPickerOpen(true)}
              disabled={!uid || busy}
              title={!uid ? "Sign in to pick exercises" : "Pick exercises"}
            >
              Pick exercises ({selectedCount})
            </button>
          </div>
        </div>

        <div className={gymStyles.sheetExercise}>
          {editing.length === 0 ? (
            <div className={homeStyles.modalEmptyText} style={{ padding: "12px 15px" }}>
              No exercises yet. Tap “Pick exercises”.
            </div>
          ) : (
            <>
              {/* Optional: show muscles for the template */}
              <div className={homeStyles.modalSectionTitle} style={{ padding: "10px 15px 0" }}>
                Muscles (template)
              </div>
              <div className={gymStyles.muscleMaps}>
                <div className={gymStyles.muscleMapItem}>
                  <MuscleMap view="front" workedSlugs={musclesWorked} height={260} />
                </div>
                <div className={gymStyles.muscleMapItem}>
                  <MuscleMap view="back" workedSlugs={musclesWorked} height={260} />
                </div>
              </div>

              <div className={homeStyles.modalSectionTitle} style={{ padding: "10px 15px 0" }}>
                Exercises & sets
              </div>

              {editing.map((ex, exIdx) => (
                <div key={ex.id} style={{ padding: "10px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className={gymStyles.exerciseName}>
                        {ex.ref?.name || `Exercise ${exIdx + 1}`}
                      </div>
                      <div className={gymStyles.exerciseMeta}>
                        {(ex.sets || []).length} sets
                      </div>
                    </div>

                    <button
                      type="button"
                      className={gymStyles.rowIconBtn}
                      onClick={() => removeExercise(ex.id)}
                      disabled={busy}
                      aria-label="Remove exercise"
                      title="Remove exercise"
                    >
                      ×
                    </button>
                  </div>

                  {/* Set header */}
                  <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 44px", gap: 10, marginTop: 10 }}>
                    <div className={gymStyles.exerciseMeta}>Set</div>
                    <div className={gymStyles.exerciseMeta}>Kg</div>
                    <div className={gymStyles.exerciseMeta}>Reps</div>
                    <div />
                  </div>

                  {/* Sets */}
                  {(ex.sets || []).map((s, idx) => {
                    const kgValue =
                      s.targetKg === 0 || typeof s.targetKg === "number" ? String(s.targetKg) : "";
                    const repsValue =
                      s.targetReps === 0 || typeof s.targetReps === "number" ? String(s.targetReps) : "";

                    return (
                      <div
                        key={s.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "40px 1fr 1fr 44px",
                          gap: 10,
                          alignItems: "center",
                          marginTop: 8,
                        }}
                      >
                        <div className={gymStyles.exerciseName} style={{ fontSize: 14 }}>
                          {idx + 1}
                        </div>

                        <input
                          className={gymStyles.searchInput}
                          style={{ height: 40, borderRadius: 12 }}
                          type="text"
                          inputMode="numeric"
                          step="0.5"
                          value={kgValue}
                          onChange={(e) => updateSetField(ex.id, s.id, "targetKg", e.target.value)}
                          disabled={busy}
                          aria-label="Template kg"
                        />

                        <input
                          className={gymStyles.searchInput}
                          style={{ height: 40, borderRadius: 12 }}
                          type="text"
                          inputMode="numeric"
                          step="1"
                          value={repsValue}
                          onChange={(e) => updateSetField(ex.id, s.id, "targetReps", e.target.value)}
                          disabled={busy}
                          aria-label="Template reps"
                        />

                        <button
                          type="button"
                          className={gymStyles.rowIconBtn}
                          onClick={() => deleteSet(ex.id, s.id)}
                          disabled={busy || (ex.sets?.length ?? 0) <= 1}
                          aria-label="Delete set"
                          title={(ex.sets?.length ?? 0) <= 1 ? "At least 1 set required" : "Delete set"}
                        >
                          <FaRegTrashAlt size={16} />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className={gymStyles.secondaryBtn}
                    onClick={() => addSet(ex.id)}
                    disabled={busy}
                    style={{ marginTop: 10 }}
                  >
                    Add set
                  </button>
                </div>
              ))}
            </>
          )}


        </div>

        {/* Exercise picker */}
        <ExercisePickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onStart={({ exercises }) => {
            setPickerOpen(false);
            // Replace current selection with new selection (simple/clear)
            setEditing(toTemplateExercises(exercises));
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronLeft } from "react-icons/fi";
import { FaRegTrashAlt } from "react-icons/fa";

import ExercisePickerModal from "./ExercisePickerModal";
import MuscleMap from "./muscle-map/MuscleMap";

import type { GymExerciseRef, GymTemplate, GymTemplateExercise, GymTemplateSet } from "../../types/gym";
import { musclesToSlugs } from "../../lib/muscleSlugMap";
import { saveGymTemplate, updateGymTemplate } from "../../firebase/gymService";

import styles from "../food/RecipeAddModal.module.css";
import gymStyles from "../../gym/gym.module.css";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultSets(): GymTemplateSet[] {
  return [
    { id: uid(), targetReps: 12, targetKg: 0 },
    { id: uid(), targetReps: 10, targetKg: 0 },
    { id: uid(), targetReps: 8, targetKg: 0 },
  ];
}

function toTemplateExercises(refs: GymExerciseRef[]): GymTemplateExercise[] {
  return refs.map((ref) => ({ id: uid(), ref, sets: defaultSets() }));
}

export default function TemplateMakerModal({
  open,
  uid: firebaseUid,
  onClose,
  onSaved,
  initialTemplate,
}: {
  open: boolean;
  uid: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
  initialTemplate?: GymTemplate;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [exercises, setExercises] = useState<GymTemplateExercise[]>(initialTemplate?.exercises ?? []);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleClose() {
    setStep(1);
    setName("");
    setExercises([]);
    setBusy(false);
    setPickerOpen(false);
    onClose();
  }

  const musclesWorked = useMemo(() => {
    const slugs = new Set<string>();
    for (const ex of exercises) {
      musclesToSlugs(ex.ref.primaryMuscles || [], ex.ref.secondaryMuscles || []).forEach((s) => slugs.add(s));
    }
    return [...slugs];
  }, [exercises]);

  const canNext = name.trim().length > 0 && exercises.length > 0;
  const canSave =
    canNext &&
    exercises.every((ex) => Array.isArray(ex.sets) && ex.sets.length > 0) &&
    !busy;

  const updateSetField = useCallback(
    (exId: string, setId: string, field: "targetKg" | "targetReps", raw: string) => {
      const parsed = raw.trim() === "" ? 0 : field === "targetKg" ? Number(raw) : parseInt(raw, 10);
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id !== exId ? ex : { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: parsed } : s)) }
        )
      );
    },
    []
  );

  const addSet = useCallback((exId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { id: uid(), targetReps: last?.targetReps ?? 8, targetKg: last?.targetKg ?? 0 }] };
      })
    );
  }, []);

  const deleteSet = useCallback((exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
      )
    );
  }, []);

  const removeExercise = useCallback((exId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exId));
  }, []);

  async function handleSave() {
    if (!canSave) return;
    setBusy(true);
    try {
      const payload: Omit<GymTemplate, "id"> = {
        name: name.trim(),
        createdAt: initialTemplate?.createdAt ?? Date.now(),
        musclesWorked,
        exercises,
      };
      let templateId: string;
      if (initialTemplate) {
        await updateGymTemplate(firebaseUid, initialTemplate.id, payload as any);
        templateId = initialTemplate.id;
      } else {
        templateId = await saveGymTemplate(firebaseUid, payload as any);
      }
      handleClose();
      onSaved?.(templateId);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay}>
      {/* Top bar */}
      <div className={styles.topBar}>
        {step === 1 ? (
          <button className={styles.cancelBtn} onClick={handleClose}>
            Annuleren
          </button>
        ) : (
          <button className={styles.backBtn} onClick={() => setStep(1)}>
            <FiChevronLeft size={16} style={{ verticalAlign: "middle" }} /> Terug
          </button>
        )}

        <span className={styles.topTitle}>
          {step === 1 ? (initialTemplate ? "Template bewerken" : "Nieuw template") : "Sets instellen"}
        </span>

        {step === 1 ? (
          <button className={styles.nextBtn} disabled={!canNext} onClick={() => setStep(2)}>
            Volgende →
          </button>
        ) : (
          <button className={styles.saveBtn} disabled={!canSave} onClick={handleSave}>
            {busy ? "Opslaan…" : "Opslaan"}
          </button>
        )}
      </div>

      {/* Step dots */}
      <div className={styles.stepDots}>
        <div className={`${styles.dot} ${step === 1 ? styles.dotActive : ""}`} />
        <div className={`${styles.dot} ${step === 2 ? styles.dotActive : ""}`} />
      </div>

      {/* Body */}
      <div className={styles.body}>

        {/* â”€â”€ Step 1 â”€â”€ */}
        {step === 1 && (
          <>
            <input
              className={styles.nameInput}
              placeholder="Template naam (bijv. Push, Pull, Benen)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <div className={styles.sectionLabel}>Oefeningen</div>
            <p className={styles.sectionHint}>
              Kies de oefeningen voor dit template.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                className={`${styles.chip} ${exercises.length > 0 ? styles.chipActive : ""}`}
                style={{ width: "fit-content" }}
                onClick={() => setPickerOpen(true)}
              >
                <span className={styles.chipLabel}>
                  {exercises.length > 0 ? `${exercises.length} oefeningen gekozen` : "Oefeningen kiezen"}
                </span>
                {exercises.length > 0 && <span className={styles.chipCheck}>✓</span>}
              </button>
            </div>

            {exercises.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {exercises.map((ex) => (
                  <div key={ex.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "var(--bg-card-2)",
                    borderRadius: 14,
                    padding: "10px 12px",
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 10,
                      overflow: "hidden", background: "rgba(255,255,255,0.06)",
                      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {ex.ref.image
                        ? <img src={ex.ref.image} alt={ex.ref.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        : null
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ex.ref.name}
                      </div>
                      {(ex.ref.primaryMuscles || []).length > 0 && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(ex.ref.primaryMuscles || []).join(", ")}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeExercise(ex.id)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, flexShrink: 0, display: "flex", alignItems: "center" }}
                      aria-label="Verwijder"
                    >
                      <FaRegTrashAlt size={14} />
                    </button>
                  </div>
                ))}

                <button
                  style={{
                    width: "100%", background: "none", border: "1px dashed var(--bg-card-3)",
                    borderRadius: 12, padding: "10px", color: "#A1A1A1",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 2,
                  }}
                  onClick={() => setPickerOpen(true)}
                >
                  + Oefeningen aanpassen
                </button>
              </div>
            )}
          </>
        )}

        {/* â”€â”€ Step 2 â”€â”€ */}
        {step === 2 && (
          <>
            {/* Muscle map */}
            <div className={gymStyles.muscleMaps} style={{ marginBottom: 20 }}>
              <div className={gymStyles.muscleMapItem}>
                <MuscleMap view="front" workedSlugs={musclesWorked} height={200} />
              </div>
              <div className={gymStyles.muscleMapItem}>
                <MuscleMap view="back" workedSlugs={musclesWorked} height={200} />
              </div>
            </div>

            {exercises.map((ex, exIdx) => (
              <div key={ex.id} style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 10 }}>
                  <div className={gymStyles.exerciseName}>{ex.ref?.name || `Oefening ${exIdx + 1}`}</div>
                  <div className={gymStyles.exerciseMeta}>{ex.sets.length} sets</div>
                </div>

                {/* Set header */}
                <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 40px", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#A1A1A1" }}>Set</span>
                  <span style={{ fontSize: 12, color: "#A1A1A1" }}>Kg</span>
                  <span style={{ fontSize: 12, color: "#A1A1A1" }}>Reps</span>
                  <span />
                </div>

                {ex.sets.map((s, idx) => (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 40px", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{idx + 1}</span>
                    <input
                      style={{ background: "var(--bg-card-2)", border: "1px solid var(--bg-card-3)", borderRadius: 10, color: "#fff", fontSize: 14, padding: "8px", textAlign: "center", outline: "none", width: "100%" }}
                      type="text"
                      inputMode="numeric"
                      value={typeof s.targetKg === "number" ? String(s.targetKg) : ""}
                      onChange={(e) => updateSetField(ex.id, s.id, "targetKg", e.target.value)}
                      disabled={busy}
                      aria-label="Kg"
                    />
                    <input
                      style={{ background: "var(--bg-card-2)", border: "1px solid var(--bg-card-3)", borderRadius: 10, color: "#fff", fontSize: 14, padding: "8px", textAlign: "center", outline: "none", width: "100%" }}
                      type="text"
                      inputMode="numeric"
                      value={typeof s.targetReps === "number" ? String(s.targetReps) : ""}
                      onChange={(e) => updateSetField(ex.id, s.id, "targetReps", e.target.value)}
                      disabled={busy}
                      aria-label="Reps"
                    />
                    <button
                      style={{ background: "none", border: "none", color: ex.sets.length <= 1 ? "var(--text-dim)" : "#A1A1A1", cursor: ex.sets.length <= 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      onClick={() => deleteSet(ex.id, s.id)}
                      disabled={busy || ex.sets.length <= 1}
                      aria-label="Verwijder set"
                    >
                      <FaRegTrashAlt size={14} />
                    </button>
                  </div>
                ))}

                <button
                  style={{ width: "100%", background: "none", border: "1px dashed var(--bg-card-3)", borderRadius: 10, color: "var(--accent)", fontSize: 13, fontWeight: 600, padding: "8px", marginTop: 4, cursor: "pointer" }}
                  onClick={() => addSet(ex.id)}
                  disabled={busy}
                >
                  + Set toevoegen
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onStart={({ exercises: picked }) => {
          setPickerOpen(false);
          setExercises(toTemplateExercises(picked));
        }}
      />
    </div>,
    document.body
  );
}

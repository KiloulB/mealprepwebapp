"use client";

import React, { useMemo, useState } from "react";
import homeStyles from "../../home.module.css";
import modalStyles from "./GymModal.module.css";
import { IoAdd, IoClose, IoTrashOutline } from "react-icons/io5";

import type { GymPlan, GymWorkout, GymPlanExercise } from "../../types/gym";
import { saveGymPlan, updateGymPlan, deleteGymPlan } from "../../firebase/gymService";
import ExercisePickerModal, { type PickPayload } from "./ExercisePickerModal";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const defaultExercise = (x: PickPayload): GymPlanExercise => ({
  exerciseId: x.exerciseId,
  name: x.name,
  imageUrl: x.imageUrl,

  primaryMuscles: x.primaryMuscles || [],
  secondaryMuscles: x.secondaryMuscles || [],

  sets: 3,
  repMin: 6,
  repMax: 10,
  restSec: 90,

  currentWeightKg: 0,
  stepKg: 2.5,
  requireAllSets: true,
});

export default function GymPlanModal({
  userId,
  plan,
  onClose,
}: {
  userId: string;
  plan: GymPlan | null;
  onClose: () => void;
}) {
  const isEdit = !!plan;

  const [title, setTitle] = useState(plan?.title || "");
  const [workouts, setWorkouts] = useState<GymWorkout[]>(
    plan?.workouts?.length ? plan.workouts : [{ id: uid(), name: "Workout A", items: [] }],
  );

  const [pickerForWorkoutId, setPickerForWorkoutId] = useState<string | null>(null);

  const nextWorkoutName = useMemo(() => {
    const n = workouts.length;
    const letter = String.fromCharCode("A".charCodeAt(0) + n);
    return `Workout ${letter}`;
  }, [workouts.length]);

  const addWorkout = () => {
    setWorkouts((prev) => [...prev, { id: uid(), name: nextWorkoutName, items: [] }]);
  };

  const renameWorkout = (id: string, name: string) => {
    setWorkouts((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
  };

  const removeWorkout = (id: string) => {
    setWorkouts((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.id !== id)));
  };

  const addExerciseToWorkout = (workoutId: string, x: PickPayload) => {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== workoutId) return w;
        if (w.items.some((it) => it.exerciseId === x.exerciseId)) return w;
        return { ...w, items: [...w.items, defaultExercise(x)] };
      }),
    );
  };

  const updateExercise = (workoutId: string, exerciseId: string, patch: Partial<GymPlanExercise>) => {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? { ...w, items: w.items.map((it) => (it.exerciseId === exerciseId ? { ...it, ...patch } : it)) }
          : w,
      ),
    );
  };

  const removeExercise = (workoutId: string, exerciseId: string) => {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId ? { ...w, items: w.items.filter((it) => it.exerciseId !== exerciseId) } : w,
      ),
    );
  };

  const onSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const data = { title: cleanTitle, workouts };

    if (isEdit && plan) await updateGymPlan(userId, plan.id, data);
    else await saveGymPlan(userId, data as any);

    onClose();
  };

  const onDelete = async () => {
    if (!plan) return;
    await deleteGymPlan(userId, plan.id);
    onClose();
  };

  return (
    <div className={homeStyles.modalOverlay} role="dialog" aria-modal="true">
      <div className={cx(homeStyles.modalCard, modalStyles.modalWide)}>
        <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
          <h3 className={homeStyles.modalTitle}>{isEdit ? "Plan bewerken" : "Nieuw plan"}</h3>

          <div className={modalStyles.headerRight}>
            {isEdit && (
              <button className={modalStyles.trashBtn} onClick={onDelete} type="button" aria-label="Delete">
                <IoTrashOutline size={20} />
              </button>
            )}
            <button className={homeStyles.iconButton} onClick={onClose} type="button" aria-label="Close">
              <IoClose size={22} />
            </button>
          </div>
        </div>

        <div className={modalStyles.body}>
          <div className={modalStyles.field}>
            <div className={modalStyles.label}>Plan title</div>
            <input className={modalStyles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className={modalStyles.sectionHeader}>
            <div className={modalStyles.sectionTitle}>Workouts</div>
            <button className={modalStyles.circleBtn} type="button" onClick={addWorkout}>
              <IoAdd size={18} />
            </button>
          </div>

          {workouts.map((w) => (
            <div key={w.id} className={modalStyles.workoutCard}>
              <div className={modalStyles.workoutTop}>
                <input
                  className={modalStyles.workoutName}
                  value={w.name}
                  onChange={(e) => renameWorkout(w.id, e.target.value)}
                />
                <button className={modalStyles.smallDanger} type="button" onClick={() => removeWorkout(w.id)}>
                  Delete
                </button>
              </div>

              <div className={modalStyles.workoutActions}>
                <button className={modalStyles.secondaryBtn} type="button" onClick={() => setPickerForWorkoutId(w.id)}>
                  Add exercise
                </button>
              </div>

              {(w.items || []).map((it) => (
                <div key={it.exerciseId} className={modalStyles.exerciseRow}>
                  <div className={modalStyles.exerciseLeft}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={modalStyles.exerciseThumb} src={it.imageUrl} alt={it.name} loading="lazy" />
                      ) : (
                        <div className={modalStyles.exerciseThumbPlaceholder} />
                      )}
                      <div>
                        <div className={modalStyles.exerciseTitle}>{it.name}</div>
                        <div className={modalStyles.exerciseSub}>
                          {it.sets}x {it.repMin}-{it.repMax} • {it.currentWeightKg}kg (+{it.stepKg})
                        </div>
                      </div>
                    </div>
                  </div>

                  <button className={modalStyles.removeBtn} type="button" onClick={() => removeExercise(w.id, it.exerciseId)}>
                    <IoClose size={18} />
                  </button>

                  <div className={modalStyles.exerciseGrid}>
                    <input
                      className={modalStyles.smallInput}
                      value={String(it.sets)}
                      inputMode="numeric"
                      placeholder="sets"
                      onChange={(e) => updateExercise(w.id, it.exerciseId, { sets: parseInt(e.target.value || "0", 10) || 0 })}
                    />
                    <input
                      className={modalStyles.smallInput}
                      value={String(it.repMin)}
                      inputMode="numeric"
                      placeholder="min"
                      onChange={(e) => updateExercise(w.id, it.exerciseId, { repMin: parseInt(e.target.value || "0", 10) || 0 })}
                    />
                    <input
                      className={modalStyles.smallInput}
                      value={String(it.repMax)}
                      inputMode="numeric"
                      placeholder="max"
                      onChange={(e) => updateExercise(w.id, it.exerciseId, { repMax: parseInt(e.target.value || "0", 10) || 0 })}
                    />
                    <input
                      className={modalStyles.smallInput}
                      value={String(it.currentWeightKg)}
                      inputMode="decimal"
                      placeholder="kg"
                      onChange={(e) =>
                        updateExercise(w.id, it.exerciseId, { currentWeightKg: parseFloat(e.target.value || "0") || 0 })
                      }
                    />
                    <input
                      className={modalStyles.smallInput}
                      value={String(it.stepKg)}
                      inputMode="decimal"
                      placeholder="+kg"
                      onChange={(e) => updateExercise(w.id, it.exerciseId, { stepKg: parseFloat(e.target.value || "0") || 0 })}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}

          <button className={modalStyles.primaryBtn} type="button" onClick={onSave}>
            Save plan
          </button>
        </div>
      </div>

      {pickerForWorkoutId && (
        <ExercisePickerModal
          onClose={() => setPickerForWorkoutId(null)}
          onPick={(x) => {
            addExerciseToWorkout(pickerForWorkoutId, x);
            setPickerForWorkoutId(null);
          }}
        />
      )}
    </div>
  );
}

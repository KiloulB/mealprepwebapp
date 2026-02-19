// components/gym/TemplateStartModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import gymStyles from "../../gym/gym.module.css";
import homeStyles from "../../home.module.css";
import { FiX } from "react-icons/fi";
import type { GymSessionExercise, GymSet, GymTemplate } from "../../types/gym";
import { subscribeToGymTemplates } from "../../firebase/gymTemplateService";
import { getLatestSessionForTemplate } from "../../firebase/gymSessionQueries";
import { createGymSession } from "../../firebase/gymService";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneToSessionSet(tset: { id: string; targetReps: number; targetKg: number }, override?: Partial<GymSet>) {
  return {
    id: id(),
    templateSetId: tset.id,
    targetReps: tset.targetReps,
    targetKg: tset.targetKg,
    done: false,
    ...(override || {}),
  } satisfies GymSet;
}

export default function TemplateStartModal({
  open,
  uid,
  onClose,
  onStarted,
}: {
  open: boolean;
  uid: string;
  onClose: () => void;
  onStarted: (sessionId: string) => void;
}) {
  const [templates, setTemplates] = useState<GymTemplate[]>([]);
  const [busyId, setBusyId] = useState<string>("");

  useEffect(() => {
    if (!open || !uid) return;
    return subscribeToGymTemplates(uid, setTemplates);
  }, [open, uid]);

  const hasTemplates = templates.length > 0;

  async function startFromTemplate(t: GymTemplate) {
    if (!uid) return;
    if (busyId) return;

    setBusyId(t.id);
    try {
      const prev = await getLatestSessionForTemplate(uid, t.id);

      // Build a lookup from prev session: templateSetId -> {kg,reps}
      const prevByTemplateSetId = new Map<string, { kg: number; reps: number }>();
      if (prev?.exercises) {
        for (const ex of prev.exercises) {
          for (const s of ex.sets || []) {
            if (s.templateSetId && typeof s.targetKg === "number" && typeof s.targetReps === "number") {
              prevByTemplateSetId.set(s.templateSetId, { kg: s.targetKg, reps: s.targetReps });
            }
          }
        }
      }

      // If you want to "remember previous set-count too", easiest is:
      // - if prev exists and has an exercise match, use prev.sets length
      // Matching exercise: templateExerciseId first, fallback to exerciseId.
      const prevExerciseByTemplateExerciseId = new Map<string, any>();
      const prevExerciseByExerciseId = new Map<string, any>();
      if (prev?.exercises) {
        for (const ex of prev.exercises) {
          if ((ex as any).templateExerciseId) prevExerciseByTemplateExerciseId.set((ex as any).templateExerciseId, ex);
          const exId = ex.ref?.exerciseId;
          if (exId) prevExerciseByExerciseId.set(exId, ex);
        }
      }

      const sessionExercises: GymSessionExercise[] = (t.exercises || []).map((tex) => {
        const prevEx =
          prevExerciseByTemplateExerciseId.get(tex.id) ??
          prevExerciseByExerciseId.get(tex.ref.exerciseId) ??
          null;

        let sets: GymSet[] = [];

        if (prevEx && Array.isArray(prevEx.sets) && prevEx.sets.length > 0) {
          // Copy previous set count + previous reps/kg, but keep templateSetId mapping if possible.
          // We build sets by aligning to template sets first; if prev has more sets than template, extend using prev values.
          const baseTemplateSets = tex.sets || [];

          for (let i = 0; i < prevEx.sets.length; i++) {
            const prevSet = prevEx.sets[i];
            const tset = baseTemplateSets[i] ?? baseTemplateSets[baseTemplateSets.length - 1]; // fallback last template set
            // If template has no sets at all, create a dummy id mapping:
            const templateSetId = tset?.id ?? `legacy-${tex.id}-${i}`;

            const fromMap = prevByTemplateSetId.get(prevSet.templateSetId ?? templateSetId);

            sets.push({
              id: id(),
              templateSetId,
              targetReps: typeof fromMap?.reps === "number" ? fromMap.reps : (prevSet.targetReps ?? tset?.targetReps ?? 8),
              targetKg: typeof fromMap?.kg === "number" ? fromMap.kg : (prevSet.targetKg ?? tset?.targetKg ?? 0),
              done: false,
            });
          }
        } else {
          // No previous: use template sets as-is
          sets = (tex.sets || []).map((tset) => cloneToSessionSet(tset));
        }

        // Done false always
        return {
          id: id(),
          templateExerciseId: tex.id,
          ref: tex.ref,
          sets,
          done: false,
        };
      });

      const sessionId = await createGymSession(uid, {
        name: t.name || "Workout",
        startedAt: Date.now(),
        exercises: sessionExercises,
        musclesWorked: t.musclesWorked || [],
        templateId: t.id,
      } as any);

      onClose();
      onStarted(sessionId);
    } finally {
      setBusyId("");
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
        aria-label="Start workout from template"
      >
        <div className={gymStyles.sheetHandle} />

        <div className={gymStyles.headerBlock}>
          <div className={gymStyles.headerTopRow}>
            <button className={gymStyles.closeX} type="button" onClick={onClose} aria-label="Close">
              <FiX size={20} />
            </button>

            <div className={homeStyles.cardTitle} style={{ paddingLeft: 6 }}>
              Start from template
            </div>

            <div style={{ width: 40 }} />
          </div>
        </div>

        <div className={gymStyles.sheetExercise}>
          {!hasTemplates ? (
            <div className={homeStyles.modalEmptyText} style={{ padding: "12px 0" }}>
              No templates yet. Use “Make template” first.
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className={gymStyles.exerciseRow}
                role="button"
                tabIndex={0}
                onClick={() => startFromTemplate(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") startFromTemplate(t);
                }}
                aria-disabled={!!busyId}
                style={{ paddingTop: 22, paddingBottom: 22, margin: "0 0 20px 0", background: "#ffffff0f", opacity: busyId && busyId !== t.id ? 0.5 : 1 }}
              >
                <div className={gymStyles.exerciseMain}>
                  <div className={gymStyles.exerciseName}>{t.name}</div>
                  <div className={gymStyles.exerciseMeta}>
                    {(t.exercises || []).length} exercises
                    {busyId === t.id ? " • Starting…" : ""}
                  </div>
                </div>
              </div>
            ))
          )}


        </div>
      </div>
    </div>
  );
}

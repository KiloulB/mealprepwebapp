// components/gym/TemplateStartModal.tsx
"use client";

import { useEffect, useState } from "react";
import gymStyles from "../../gym/gym.module.css";
import { FiChevronLeft } from "react-icons/fi";
import { IoChevronForward, IoListOutline, IoFlashOutline, IoClose } from "react-icons/io5";
import type { GymExerciseRef, GymSessionExercise, GymSet, GymTemplate } from "../../types/gym";
import { subscribeToGymTemplates } from "../../firebase/gymTemplateService";
import { getLatestSessionForTemplate } from "../../firebase/gymSessionQueries";
import { createGymSession } from "../../firebase/gymService";
import ExercisePickerModal from "./ExercisePickerModal";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneToSessionSet(tset: { id: string; targetReps: number; targetKg: number }): GymSet {
  return {
    id: uid(),
    templateSetId: tset.id,
    targetReps: tset.targetReps,
    targetKg: tset.targetKg,
    done: false,
  };
}

type View = "choice" | "templates" | "picker";

export default function TemplateStartModal({
  open,
  uid: firebaseUid,
  onClose,
  onStarted,
}: {
  open: boolean;
  uid: string;
  onClose: () => void;
  onStarted: (sessionId: string) => void;
  initialTemplate?: GymTemplate;
}) {
  const [view, setView] = useState<View>("choice");
  const [templates, setTemplates] = useState<GymTemplate[]>([]);
  const [busyId, setBusyId] = useState<string>("");
  const [busyEmpty, setBusyEmpty] = useState(false);

  useEffect(() => {
    if (!open || !firebaseUid) return;
    return subscribeToGymTemplates(firebaseUid, setTemplates);
  }, [open, firebaseUid]);

  useEffect(() => {
    if (!open) setView("choice");
  }, [open]);

  async function startFromTemplate(t: GymTemplate) {
    if (!firebaseUid || busyId) return;
    setBusyId(t.id);
    try {
      const prev = await getLatestSessionForTemplate(firebaseUid, t.id);

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
          const baseTemplateSets = tex.sets || [];
          for (let i = 0; i < prevEx.sets.length; i++) {
            const prevSet = prevEx.sets[i];
            const tset = baseTemplateSets[i] ?? baseTemplateSets[baseTemplateSets.length - 1];
            const templateSetId = tset?.id ?? `legacy-${tex.id}-${i}`;
            const fromMap = prevByTemplateSetId.get(prevSet.templateSetId ?? templateSetId);
            sets.push({
              id: uid(),
              templateSetId,
              targetReps: typeof fromMap?.reps === "number" ? fromMap.reps : (prevSet.targetReps ?? tset?.targetReps ?? 8),
              targetKg: typeof fromMap?.kg === "number" ? fromMap.kg : (prevSet.targetKg ?? tset?.targetKg ?? 0),
              done: false,
            });
          }
        } else {
          sets = (tex.sets || []).map((tset) => cloneToSessionSet(tset));
        }

        return {
          id: uid(),
          templateExerciseId: tex.id,
          ref: tex.ref,
          sets,
          done: false,
        };
      });

      const sessionId = await createGymSession(firebaseUid, {
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

  async function startFromPicker(picked: GymExerciseRef[], musclesWorked: string[]) {
    if (!firebaseUid || busyEmpty) return;
    setBusyEmpty(true);
    try {
      const sessionExercises: GymSessionExercise[] = picked.map((ref) => ({
        id: uid(),
        ref,
        sets: [
          { id: uid(), targetReps: 8, targetKg: 0, done: false },
          { id: uid(), targetReps: 8, targetKg: 0, done: false },
          { id: uid(), targetReps: 8, targetKg: 0, done: false },
        ] as GymSet[],
        done: false,
      }));

      const sessionId = await createGymSession(firebaseUid, {
        name: "Workout",
        startedAt: Date.now(),
        exercises: sessionExercises,
        musclesWorked,
      } as any);

      onClose();
      onStarted(sessionId);
    } finally {
      setBusyEmpty(false);
    }
  }

  if (!open) return null;

  const busy = !!busyId || busyEmpty;

  return (
    <>
      {view !== "picker" && (
        <div className={gymStyles.sheetOverlay} onClick={onClose}>
          <div className={gymStyles.tsSheet} onClick={(e) => e.stopPropagation()}>
            <div className={gymStyles.sheetHandle} />

            {/* ── Choice view ── */}
            {view === "choice" && (
              <>
                <div className={gymStyles.tsHeader}>
                  <div className={gymStyles.tsTitle}>Workout starten</div>
                  <div className={gymStyles.tsSubtitle}>Kies hoe je wil beginnen</div>
                </div>

                <div className={gymStyles.tsChoiceList}>
                  <button
                    className={gymStyles.tsChoiceCard}
                    onClick={() => setView("templates")}
                  >
                    <div className={gymStyles.tsChoiceIcon}>
                      <IoListOutline size={22} color="#FC9158" />
                    </div>
                    <div className={gymStyles.tsChoiceBody}>
                      <div className={gymStyles.tsChoiceLabel}>Vanuit template</div>
                      <div className={gymStyles.tsChoiceSub}>Start met een opgeslagen schema</div>
                    </div>
                    <IoChevronForward size={18} color="#555" />
                  </button>

                  <button
                    className={gymStyles.tsChoiceCard}
                    onClick={() => setView("picker")}
                  >
                    <div className={gymStyles.tsChoiceIcon}>
                      <IoFlashOutline size={22} color="#FC9158" />
                    </div>
                    <div className={gymStyles.tsChoiceBody}>
                      <div className={gymStyles.tsChoiceLabel}>Zonder template</div>
                      <div className={gymStyles.tsChoiceSub}>Kies oefeningen en start direct</div>
                    </div>
                    <IoChevronForward size={18} color="#555" />
                  </button>
                </div>
              </>
            )}

            {/* ── Templates view ── */}
            {view === "templates" && (
              <>
                <div className={gymStyles.tsViewBar}>
                  <button
                    className={gymStyles.tsViewBackBtn}
                    onClick={() => setView("choice")}
                  >
                    <FiChevronLeft size={19} />
                    Terug
                  </button>
                  <div className={gymStyles.tsViewTitle}>Template kiezen</div>
                  <button
                    className={gymStyles.closeX}
                    onClick={onClose}
                    aria-label="Sluiten"
                  >
                    <IoClose size={18} />
                  </button>
                </div>

                <div className={gymStyles.tsTemplateList}>
                  {templates.length === 0 ? (
                    <div className={gymStyles.tsEmpty}>
                      <div className={gymStyles.tsEmptyIcon}>
                        <IoListOutline size={40} />
                      </div>
                      <div className={gymStyles.tsEmptyText}>Nog geen templates</div>
                      <div className={gymStyles.tsEmptySub}>
                        Maak eerst een template aan via het plusteken
                      </div>
                    </div>
                  ) : (
                    templates.map((t) => (
                      <button
                        key={t.id}
                        className={gymStyles.tsTemplateItem}
                        onClick={() => startFromTemplate(t)}
                        disabled={busy}
                        style={busyId && busyId !== t.id ? { opacity: 0.4 } : undefined}
                      >
                        <div className={gymStyles.tsTemplateBody}>
                          <div className={gymStyles.tsTemplateName}>{t.name}</div>
                          <div className={gymStyles.tsTemplateExs}>
                            {(t.exercises || []).map((e) => e.ref.name).join(" · ") || "Geen oefeningen"}
                          </div>
                          {(t.musclesWorked || []).length > 0 && (
                            <div className={gymStyles.tsMusclePills}>
                              {(t.musclesWorked || []).slice(0, 4).map((m) => (
                                <span key={m} className={gymStyles.tsMusclePill}>{m}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {busyId === t.id ? (
                          <div className={gymStyles.tsSpinner} />
                        ) : (
                          <IoChevronForward size={18} color="#FC9158" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ExercisePickerModal
        open={view === "picker"}
        onClose={() => setView("choice")}
        onStart={({ exercises, musclesWorked }) => startFromPicker(exercises, musclesWorked)}
      />
    </>
  );
}

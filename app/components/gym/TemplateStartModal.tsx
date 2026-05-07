// components/gym/TemplateStartModal.tsx
"use client";

import { useEffect, useState } from "react";
import gymStyles from "../../gym/gym.module.css";
import { FiX, FiChevronLeft } from "react-icons/fi";
import { IoChevronForward, IoListOutline, IoFlashOutline } from "react-icons/io5";
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 20px",
          }}
          onClick={onClose}
        >
          <div
            style={{
              background: "#18181A",
              borderRadius: 24,
              width: "100%",
              maxWidth: 420,
              padding: "24px 20px 20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Keuze view ── */}
            {view === "choice" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Workout starten</div>
                  <button
                    onClick={onClose}
                    style={{ background: "none", border: "none", color: "#A1A1A1", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}
                    aria-label="Sluiten"
                  >
                    <FiX size={20} />
                  </button>
                </div>

                <button
                  onClick={() => setView("templates")}
                  style={{
                    width: "100%",
                    background: "#232325",
                    border: "none",
                    borderRadius: 16,
                    padding: "16px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    cursor: "pointer",
                    marginBottom: 10,
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 42, height: 42,
                    background: "rgba(252,145,88,0.12)",
                    borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <IoListOutline size={20} color="#FC9158" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Vanuit template</div>
                    <div style={{ fontSize: 13, color: "#A1A1A1", marginTop: 3 }}>Start met een opgeslagen schema</div>
                  </div>
                  <IoChevronForward size={16} color="#555" style={{ flexShrink: 0 }} />
                </button>

                <button
                  onClick={() => setView("picker")}
                  style={{
                    width: "100%",
                    background: "#232325",
                    border: "none",
                    borderRadius: 16,
                    padding: "16px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 42, height: 42,
                    background: "rgba(252,145,88,0.08)",
                    borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <IoFlashOutline size={20} color="#FC9158" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Zonder template</div>
                    <div style={{ fontSize: 13, color: "#A1A1A1", marginTop: 3 }}>Kies oefeningen en start direct</div>
                  </div>
                  <IoChevronForward size={16} color="#555" style={{ flexShrink: 0 }} />
                </button>
              </>
            )}

            {/* ── Template lijst view ── */}
            {view === "templates" && (
              <>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
                  <button
                    onClick={() => setView("choice")}
                    style={{ background: "none", border: "none", color: "#FC9158", cursor: "pointer", display: "flex", alignItems: "center", gap: 2, fontSize: 15, fontWeight: 600, padding: "4px 0" }}
                  >
                    <FiChevronLeft size={18} /> Terug
                  </button>
                  <div style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 700, color: "#fff" }}>
                    Template kiezen
                  </div>
                  <div style={{ width: 60 }} />
                </div>

                {templates.length === 0 ? (
                  <div style={{ color: "#666", fontSize: 14, textAlign: "center", padding: "12px 0" }}>
                    Nog geen templates. Maak er eerst één aan.
                  </div>
                ) : (
                  templates.map((t) => (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => startFromTemplate(t)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startFromTemplate(t); }}
                      aria-disabled={busy}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "#232325",
                        borderRadius: 16,
                        padding: "14px 14px",
                        marginBottom: 10,
                        cursor: busy ? "default" : "pointer",
                        opacity: busyId && busyId !== t.id ? 0.4 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={gymStyles.templateRowName}>{t.name}</div>
                        <div className={gymStyles.templateRowExercises}>
                          {(t.exercises || []).map((e) => e.ref.name).join(" · ")}
                          {busyId === t.id ? " • Bezig…" : ""}
                        </div>
                      </div>
                      <IoChevronForward size={18} color="#FC9158" style={{ flexShrink: 0, marginLeft: 8 }} />
                    </div>
                  ))
                )}
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

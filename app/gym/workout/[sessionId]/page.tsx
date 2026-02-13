// app/gym/workout/[sessionId]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/config";
import styles from "./workout.module.css";
import { FiChevronLeft } from "react-icons/fi";

import ExercisePickerModal from "../../../components/gym/ExercisePickerModal";

function normalizeParam(p: string | string[] | undefined): string {
  if (!p) return "";
  return Array.isArray(p) ? p[0] ?? "" : p;
}

type WorkoutSet = {
  id: string;
  targetReps?: number;
  targetKg?: number;
  done?: boolean;
};

type WorkoutExerciseRef = {
  exerciseId?: string;
  name?: string;
  image?: string;
  equipment?: string[];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  tags?: string[];
};

type WorkoutExercise = {
  id: string;
  done?: boolean;
  ref?: WorkoutExerciseRef;
  sets?: WorkoutSet[];
};

type WorkoutSession = {
  id: string;
  name?: string;
  musclesWorked?: string[];
  exercises?: WorkoutExercise[];
  startedAt?: number;
  status?: "unfinished" | "finished";
  createdAt?: any;
  updatedAt?: any;
};

function formatDateLong(epochMs: number) {
  try {
    return new Date(epochMs).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function WorkoutSessionPage() {
  const router = useRouter();
  const params = useParams<{ sessionId?: string | string[] }>();

  const sessionId = useMemo(
    () => normalizeParam(params?.sessionId),
    [params?.sessionId]
  );

  const [uid, setUid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [session, setSession] = useState<WorkoutSession | null>(null);

  const [tick, setTick] = useState(0);

  // modal control
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInfoId, setPickerInfoId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? "");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    if (!uid) {
      setLoading(false);
      setError("Not signed in. Go to /auth and sign in.");
      setSession(null);
      return;
    }

    setLoading(true);
    setError("");
    setSession(null);

    const ref = doc(db, "users", uid, "gymSessions", sessionId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError("Workout session not found.");
          setSession(null);
          setLoading(false);
          return;
        }

        setSession({
          id: snap.id,
          ...(snap.data() as Omit<WorkoutSession, "id">),
        });
        setLoading(false);
      },
      (e) => {
        setError(e?.message ?? "Failed to load workout.");
        setSession(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [sessionId, uid]);

  // Stop timer once finished
  useEffect(() => {
    if (!session?.startedAt) return;
    if (session.status === "finished") return;

    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session?.startedAt, session?.status]);

  async function persistExercises(nextExercises: WorkoutExercise[]) {
    if (!sessionId || !uid) return;
    setSaving(true);
    setError("");
    try {
      const ref = doc(db, "users", uid, "gymSessions", sessionId);
      await updateDoc(ref, {
        exercises: nextExercises,
        updatedAt: new Date(),
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSetDone(exerciseId: string, setId: string) {
    // LOCK: no changes when finished
    if (session?.status === "finished") return;
    if (!session?.exercises) return;

    const nextExercises: WorkoutExercise[] = session.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;

      const nextSets = (ex.sets ?? []).map((s) =>
        s.id === setId ? { ...s, done: !s.done } : s
      );
      const allDone = nextSets.length > 0 && nextSets.every((s) => !!s.done);
      return { ...ex, sets: nextSets, done: allDone };
    });

    setSession((prev) => (prev ? { ...prev, exercises: nextExercises } : prev));
    await persistExercises(nextExercises);
  }

  async function updateSetField(
    exerciseId: string,
    setId: string,
    field: "targetKg" | "targetReps",
    raw: string
  ) {
    // LOCK: no changes when finished
    if (session?.status === "finished") return;
    if (!session?.exercises) return;

    const parsed =
      raw.trim() === ""
        ? undefined
        : field === "targetKg"
        ? Number(raw)
        : parseInt(raw, 10);

    const nextExercises: WorkoutExercise[] = session.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;

      const nextSets = (ex.sets ?? []).map((s) =>
        s.id === setId ? { ...s, [field]: parsed } : s
      );
      const allDone = nextSets.length > 0 && nextSets.every((s) => !!s.done);
      return { ...ex, sets: nextSets, done: allDone };
    });

    setSession((prev) => (prev ? { ...prev, exercises: nextExercises } : prev));
    await persistExercises(nextExercises);
  }

  if (!sessionId) {
    return (
      <div className={styles.screen}>
        <div className={styles.centerCard}>
          <h2 className={styles.h2}>Missing sessionId</h2>
          <p className={styles.muted}>
            URL must be <code>/gym/workout/&lt;sessionId&gt;</code>
          </p>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>
            Go home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.screen}>
        <div className={styles.centerCard}>
          <p className={styles.muted}>Loading workout…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.screen}>
        <div className={styles.centerCard}>
          <h2 className={styles.h2}>Error</h2>
          <p className={styles.error}>{error}</p>
          <p className={styles.muted}>
            sessionId: <code>{sessionId}</code>
          </p>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>
            Go home
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.screen}>
        <div className={styles.centerCard}>
          <h2 className={styles.h2}>Workout not found</h2>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>
            Go home
          </button>
        </div>
      </div>
    );
  }

  const startedAt = session.startedAt ?? Date.now();
  const topDate = formatDateLong(startedAt);
  const duration = session.startedAt
    ? formatDuration(Date.now() - session.startedAt)
    : "00:00:00";

  const locked = session.status === "finished";

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button
          className={styles.ghostCircle}
          type="button"
          aria-label="Back to gym"
          onClick={() => {
            if (locked) {
              router.push("/?tab=gym");
              return;
            }

            const ok = window.confirm(
              "Workout not finished yet.\n\nYour progress will be saved. Leave this workout?"
            );
            if (ok) router.push("/?tab=gym");
          }}
        >
          <FiChevronLeft size={22} />
        </button>

        <button
          className={styles.finishBtn}
          type="button"
          disabled={saving} // allow finishing even if already finished? keep enabled/disabled as you want
          onClick={async () => {
            if (!sessionId || !uid || !session) return;

            const hasUndoneSet = (session.exercises ?? []).some((ex) =>
              (ex.sets ?? []).some((s) => !s.done)
            );

            if (hasUndoneSet) {
              const ok = window.confirm(
                "Sets are not done.\n\nProgress will be saved and this workout will be marked as unfinished. Finish anyway?"
              );
              if (!ok) return;
            }

            setSaving(true);
            setError("");
            try {
              await updateDoc(doc(db, "users", uid, "gymSessions", sessionId), {
                status: hasUndoneSet ? "unfinished" : "finished",
                updatedAt: new Date(),
              });

              router.push("/?tab=gym");
            } catch (e: any) {
              setError(e?.message ?? "Failed to finish. Try again.");
            } finally {
              setSaving(false);
            }
          }}
        >
          Finish
        </button>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.titleWrap}>
          <div className={styles.title}>{session.name ?? "Workout"}</div>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaIcon} aria-hidden="true">
            ▦
          </span>
          <span className={styles.metaText}>{topDate || " "}</span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaIcon} aria-hidden="true">
            ◷
          </span>
          <span className={styles.metaText}>{duration}</span>
        </div>
      </div>

      <div className={styles.list}>
        {Array.isArray(session.exercises) && session.exercises.length > 0 ? (
          session.exercises.map((ex, exIdx) => (
            <section key={ex.id ?? exIdx} className={styles.exerciseCard}>
              <div className={styles.exerciseHeader}>
                <div className={styles.exerciseLeft}>
                  <div className={styles.exerciseThumb}>
                    {ex.ref?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ex.ref.image}
                        alt={ex.ref?.name ?? "Exercise"}
                        className={styles.exerciseImg}
                      />
                    ) : (
                      <div className={styles.thumbFallback} />
                    )}
                  </div>

                  <div className={styles.exerciseName}>
                    {ex.ref?.name ?? `Exercise ${exIdx + 1}`}
                  </div>
                </div>

<button
  className={styles.infoBtn}
  type="button"
  aria-label="Exercise info"
  onClick={(e) => {
    e.stopPropagation();
    setPickerInfoId(ex.ref?.exerciseId ?? null);
    setPickerOpen(true);
  }}
>
  i
</button>

              </div>

              <div className={styles.setHeaderRow}>
                <div className={styles.setHeaderCell}>Set</div>
                <div className={styles.setHeaderCell}>Previous</div>
                <div className={styles.setHeaderCell}>+kg</div>
                <div className={styles.setHeaderCell}>Reps</div>
                <div className={styles.setHeaderCell} />
              </div>

              <div className={styles.setList}>
                {(ex.sets ?? []).length > 0 ? (
                  (ex.sets ?? []).map((set, setIdx) => {
                    const kgValue =
                      set.targetKg === 0 || typeof set.targetKg === "number"
                        ? String(set.targetKg)
                        : "";
                    const repsValue =
                      set.targetReps === 0 || typeof set.targetReps === "number"
                        ? String(set.targetReps)
                        : "";

                    return (
                      <div
                        key={set.id ?? setIdx}
                        className={`${styles.setRow} ${
                          set.done ? styles.setRowDone : ""
                        }`}
                      >
                        <div className={styles.setCellSet}>{setIdx + 1}</div>
                        <div className={styles.setCellPrev}>-</div>

                        <div className={styles.setCellKg}>
                          <input
                            className={styles.kgInput}
                            type="text"
                            inputMode="numeric"
                            step="0.5"
                            value={kgValue}
                            onChange={(e) =>
                              updateSetField(
                                ex.id,
                                set.id,
                                "targetKg",
                                e.target.value
                              )
                            }
                            disabled={saving || locked}
                            aria-label="Target kg"
                          />
                        </div>

                        <input
                          className={styles.repsInput}
                          type="text"
                          inputMode="numeric"
                          step="1"
                          value={repsValue}
                          onChange={(e) =>
                            updateSetField(
                              ex.id,
                              set.id,
                              "targetReps",
                              e.target.value
                            )
                          }
                          disabled={saving || locked}
                          aria-label="Target reps"
                        />

                        <button
                          type="button"
                          className={styles.checkBtn}
                          onClick={() => toggleSetDone(ex.id, set.id)}
                          disabled={saving || locked}
                          aria-label="Toggle set done"
                        >
                          <span
                            className={`${styles.check} ${
                              set.done ? styles.checkOn : styles.checkOff
                            }`}
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.noSets}>No sets</div>
                )}
              </div>

{!locked && (
  <button
    className={styles.addSetBtn}
    type="button"
    onClick={() => {
      // TODO: your Add Set logic here
    }}
  >
    <span className={styles.addPlus} aria-hidden="true">
      +
    </span>
    Add Set
  </button>
)}

            </section>
          ))
        ) : (
          <div className={styles.empty}>No exercises in this workout.</div>
        )}
      </div>

      {saving ? <div className={styles.savingToast}>Saving…</div> : null}

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerInfoId(null);
        }}
        onStart={() => {
          setPickerOpen(false);
          setPickerInfoId(null);
        }}
        initialInfoExerciseId={pickerInfoId}
      />
    </div>
  );
}

// app/gym/workout/[sessionId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/config";
import styles from "./workout.module.css";
import { FiChevronLeft } from "react-icons/fi";
import { IoCalendarOutline, IoAdd, IoTrashOutline } from "react-icons/io5";

import ExercisePickerModal from "../../../components/gym/ExercisePickerModal";
import { getPreviousSessionForTemplate } from "../../../firebase/gymSessionQueries";

function normalizeParam(p: string | string[] | undefined): string {
  if (!p) return "";
  return Array.isArray(p) ? p[0] ?? "" : p;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type WorkoutSet = {
  id: string;
  targetReps?: number;
  targetKg?: number;
  done?: boolean;
  templateSetId?: string;
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
  templateExerciseId?: string;
  ref?: WorkoutExerciseRef;
  sets?: WorkoutSet[];
};

type WorkoutSession = {
  id: string;
  name?: string;
  musclesWorked?: string[];
  exercises?: WorkoutExercise[];
  startedAt?: number;
  finishedAt?: number;
  status?: "unfinished" | "finished";
  createdAt?: any;
  updatedAt?: any;
  templateId?: string;
};

function formatDateLong(epochMs: number) {
  try {
    return new Date(epochMs).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
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
  const sessionId = useMemo(() => normalizeParam(params?.sessionId), [params?.sessionId]);

  const [uid, setUid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [, setTick] = useState(0);

  // "info" mode: open picker on a specific exercise for info only
  // "add" mode: open picker to add exercises to workout
  const [pickerMode, setPickerMode] = useState<"info" | "add">("info");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInfoId, setPickerInfoId] = useState<string | null>(null);

  const [prevSession, setPrevSession] = useState<WorkoutSession | null>(null);

  const prevByTemplateSetId = useMemo(() => {
    const m = new Map<string, { kg?: number; reps?: number }>();
    if (!prevSession?.exercises) return m;
    for (const ex of prevSession.exercises) {
      const exId = ex.ref?.exerciseId ?? "";
      (ex.sets ?? []).forEach((s, idx) => {
        const key = s.templateSetId || (exId ? `${exId}:${idx}` : `ex-${ex.id}:${idx}`);
        m.set(key, { kg: s.targetKg, reps: s.targetReps });
      });
    }
    return m;
  }, [prevSession]);

  // Progress
  const totalSets = useMemo(
    () => (session?.exercises ?? []).reduce((sum, ex) => sum + (ex.sets ?? []).length, 0),
    [session?.exercises]
  );
  const doneSets = useMemo(
    () => (session?.exercises ?? []).reduce((sum, ex) => sum + (ex.sets ?? []).filter((s) => s.done).length, 0),
    [session?.exercises]
  );
  const progressPct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? ""));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (!uid) {
      setLoading(false);
      setError("Niet ingelogd.");
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
          setError("Workout niet gevonden.");
          setSession(null);
          setLoading(false);
          return;
        }
        setSession({ id: snap.id, ...(snap.data() as Omit<WorkoutSession, "id">) });
        setLoading(false);
      },
      (e) => {
        setError(e?.message ?? "Laden mislukt.");
        setSession(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [sessionId, uid]);

  useEffect(() => {
    async function run() {
      if (!uid || !sessionId || !session?.templateId) {
        setPrevSession(null);
        return;
      }
      try {
        const prev = await getPreviousSessionForTemplate(uid, session.templateId, sessionId);
        setPrevSession(prev as any);
      } catch {
        setPrevSession(null);
      }
    }
    run();
  }, [uid, sessionId, session?.templateId]);

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
      await updateDoc(doc(db, "users", uid, "gymSessions", sessionId), {
        exercises: nextExercises,
        updatedAt: new Date(),
      });
    } catch (e: any) {
      setError(e?.message ?? "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSetDone(exerciseId: string, setId: string) {
    if (session?.status === "finished" || !session?.exercises) return;
    const nextExercises = session.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const nextSets = (ex.sets ?? []).map((s) => (s.id === setId ? { ...s, done: !s.done } : s));
      return { ...ex, sets: nextSets, done: nextSets.length > 0 && nextSets.every((s) => !!s.done) };
    });
    setSession((prev) => (prev ? { ...prev, exercises: nextExercises } : prev));
    await persistExercises(nextExercises);
  }

  async function updateSetField(exerciseId: string, setId: string, field: "targetKg" | "targetReps", raw: string) {
    if (session?.status === "finished" || !session?.exercises) return;
    const parsed = raw.trim() === "" ? undefined : field === "targetKg" ? Number(raw) : parseInt(raw, 10);
    const nextExercises = session.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const nextSets = (ex.sets ?? []).map((s) => (s.id === setId ? { ...s, [field]: parsed } : s));
      return { ...ex, sets: nextSets, done: nextSets.length > 0 && nextSets.every((s) => !!s.done) };
    });
    setSession((prev) => (prev ? { ...prev, exercises: nextExercises } : prev));
    await persistExercises(nextExercises);
  }

  async function addSet(exerciseId: string) {
    if (!session?.exercises) return;
    const nextExercises = session.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const last = (ex.sets ?? []).at(-1);
      const newSet: WorkoutSet = {
        id: genId(),
        targetReps: typeof last?.targetReps === "number" ? last.targetReps : 8,
        targetKg: typeof last?.targetKg === "number" ? last.targetKg : 0,
        done: false,
      };
      return { ...ex, sets: [...(ex.sets ?? []), newSet] };
    });
    setSession((prev) => (prev ? { ...prev, exercises: nextExercises } : prev));
    persistExercises(nextExercises);
  }

  async function addExercises(picked: WorkoutExerciseRef[], musclesWorked: string[]) {
    if (!session || !uid || !sessionId) return;
    const newExercises: WorkoutExercise[] = picked.map((ref) => ({
      id: genId(),
      ref,
      sets: [
        { id: genId(), targetReps: 8, targetKg: 0, done: false },
        { id: genId(), targetReps: 8, targetKg: 0, done: false },
        { id: genId(), targetReps: 8, targetKg: 0, done: false },
      ],
      done: false,
    }));
    const nextExercises = [...(session.exercises ?? []), ...newExercises];
    const newMuscles = [...new Set([...(session.musclesWorked ?? []), ...musclesWorked])];
    setSession((prev) => prev ? { ...prev, exercises: nextExercises, musclesWorked: newMuscles } : prev);
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", uid, "gymSessions", sessionId), {
        exercises: nextExercises,
        musclesWorked: newMuscles,
        updatedAt: new Date(),
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkout() {
    if (!uid || !sessionId) return;
    const ok = window.confirm("Workout verwijderen? Dit kan niet ongedaan worden gemaakt.");
    if (!ok) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "users", uid, "gymSessions", sessionId));
      router.push("/?tab=gym");
    } catch (e: any) {
      setError(e?.message ?? "Verwijderen mislukt.");
      setSaving(false);
    }
  }

  async function finishWorkout() {
    if (!sessionId || !uid || !session) return;
    const hasUndoneSet = (session.exercises ?? []).some((ex) => (ex.sets ?? []).some((s) => !s.done));
    if (hasUndoneSet) {
      const ok = window.confirm(
        "Niet alle sets zijn afgevinkt.\n\nDe getrainde spiergroepen worden niet weergegeven totdat de workout volledig is afgerond.\n\nToch afronden?"
      );
      if (!ok) return;
    }
    setSaving(true);
    setError("");
    try {
      const now = Date.now();
      await updateDoc(doc(db, "users", uid, "gymSessions", sessionId), {
        status: hasUndoneSet ? "unfinished" : "finished",
        finishedAt: now,
        durationSec: session.startedAt ? Math.round((now - session.startedAt) / 1000) : 0,
        updatedAt: new Date(),
      });
      router.push("/?tab=gym");
    } catch (e: any) {
      setError(e?.message ?? "Afronden mislukt.");
    } finally {
      setSaving(false);
    }
  }

  // ── Fallback screens ──────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className={styles.screen}>
        <div className={styles.centerCard}>
          <h2 className={styles.h2}>Geen sessie-ID</h2>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>Terug</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.screen}>
        <div className={styles.centerCard}>
          <p className={styles.muted}>Laden…</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className={styles.screen}>
        <div className={styles.centerCard}>
          <h2 className={styles.h2}>Fout</h2>
          <p className={styles.error}>{error}</p>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>Terug</button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.screen}>
        <div className={styles.centerCard}>
          <h2 className={styles.h2}>Workout niet gevonden</h2>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>Terug</button>
        </div>
      </div>
    );
  }

  const startedAt = session.startedAt ?? Date.now();
  const topDate = formatDateLong(startedAt);
  const locked = session.status === "finished";
  const fromTemplate = !!session.templateId;

  const elapsedMs = locked && session.finishedAt
    ? session.finishedAt - startedAt
    : Date.now() - startedAt;
  const duration = formatDuration(elapsedMs);

  // ── Main render ───────────────────────────────────────────────────
  return (
    <div className={styles.screen}>
      {/* Sticky top bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button
            className={styles.ghostCircle}
            type="button"
            aria-label="Terug"
            onClick={() => {
              if (locked) { router.push("/?tab=gym"); return; }
              const ok = window.confirm("Workout nog niet afgerond.\n\nJe voortgang wordt opgeslagen. Terug?");
              if (ok) router.push("/?tab=gym");
            }}
          >
            <FiChevronLeft size={22} />
          </button>
        </div>

        <span className={styles.timer}>{duration}</span>

        <div className={styles.topBarRight}>
          {locked ? (
            <button className={styles.deleteBtn} type="button" disabled={saving} onClick={deleteWorkout} aria-label="Verwijderen">
              <IoTrashOutline size={18} />
            </button>
          ) : (
            <button className={styles.finishBtn} type="button" disabled={saving} onClick={finishWorkout}>
              {saving ? "Bezig…" : "Afronden"}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Meta block */}
        <div className={styles.metaBlock}>
          <div className={styles.title}>{session.name ?? "Workout"}</div>
          <div className={styles.metaRow}>
            <div className={styles.metaItem}>
              <IoCalendarOutline size={14} />
              {topDate}
            </div>
          </div>
          {totalSets > 0 && (
            <div className={styles.progressRow}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
              </div>
              <span className={styles.progressLabel}>{doneSets}/{totalSets} sets</span>
            </div>
          )}
        </div>

        {/* Exercise list */}
        <div className={styles.list}>
          {Array.isArray(session.exercises) && session.exercises.length > 0 ? (
            session.exercises.map((ex, exIdx) => {
              const allDone = (ex.sets ?? []).length > 0 && (ex.sets ?? []).every((s) => s.done);
              return (
                <section
                  key={ex.id ?? exIdx}
                  className={`${styles.exerciseCard} ${allDone ? styles.exerciseCardDone : ""}`}
                >
                  <div className={styles.exerciseHeader}>
                    <div className={styles.exerciseLeft}>
                      <div className={styles.exerciseThumb}>
                        {ex.ref?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ex.ref.image} alt={ex.ref?.name ?? ""} className={styles.exerciseImg} />
                        ) : (
                          <div className={styles.thumbFallback} />
                        )}
                      </div>
                      <div className={styles.exerciseInfo}>
                        <div className={styles.exerciseName}>{ex.ref?.name ?? `Oefening ${exIdx + 1}`}</div>
                        <div className={styles.exerciseSubRow}>
                          <span className={styles.exerciseSetCount}>{(ex.sets ?? []).length} sets</span>
                          {allDone && <span className={styles.exerciseDoneBadge}>✓ Klaar</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      className={styles.infoBtn}
                      type="button"
                      aria-label="Oefening info"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPickerMode("info");
                        setPickerInfoId(ex.ref?.exerciseId ?? null);
                        setPickerOpen(true);
                      }}
                    >
                      i
                    </button>
                  </div>

                  {/* Set header */}
                  <div className={fromTemplate ? styles.setHeaderRow : styles.setHeaderRow2}>
                    <div className={styles.setHeaderCell}>Set</div>
                    {fromTemplate && <div className={styles.setHeaderCell}>Vorig</div>}
                    <div className={styles.setHeaderCell}>Kg</div>
                    <div className={styles.setHeaderCell}>Reps</div>
                    <div className={styles.setHeaderCell} />
                  </div>

                  {/* Sets */}
                  <div className={styles.setList}>
                    {(ex.sets ?? []).length > 0 ? (
                      (ex.sets ?? []).map((set, setIdx) => {
                        const kgValue = set.targetKg === 0 || typeof set.targetKg === "number" ? String(set.targetKg) : "";
                        const repsValue = set.targetReps === 0 || typeof set.targetReps === "number" ? String(set.targetReps) : "";
                        const prevKey = set.templateSetId || (ex.ref?.exerciseId ? `${ex.ref.exerciseId}:${setIdx}` : `ex-${ex.id}:${setIdx}`);
                        const prev = fromTemplate ? prevByTemplateSetId.get(prevKey) : undefined;

                        return (
                          <div
                            key={set.id ?? setIdx}
                            className={`${fromTemplate ? styles.setRow : styles.setRow2} ${set.done ? styles.setRowDone : ""}`}
                          >
                            <div className={styles.setCellSet}>{setIdx + 1}</div>

                            {fromTemplate && (
                              <div className={styles.setCellPrev}>
                                {prev
                                  ? `${typeof prev.kg === "number" ? prev.kg : "-"}×${typeof prev.reps === "number" ? prev.reps : "-"}`
                                  : "—"}
                              </div>
                            )}

                            <div className={styles.setCellKg}>
                              <input
                                className={styles.kgInput}
                                type="text"
                                inputMode="decimal"
                                value={kgValue}
                                onChange={(e) => updateSetField(ex.id, set.id, "targetKg", e.target.value)}
                                disabled={saving || locked}
                                aria-label="Kg"
                              />
                            </div>

                            <input
                              className={styles.repsInput}
                              type="text"
                              inputMode="numeric"
                              value={repsValue}
                              onChange={(e) => updateSetField(ex.id, set.id, "targetReps", e.target.value)}
                              disabled={saving || locked}
                              aria-label="Reps"
                            />

                            <button
                              type="button"
                              className={styles.checkBtn}
                              onClick={() => toggleSetDone(ex.id, set.id)}
                              disabled={saving || locked}
                              aria-label="Set voltooien"
                            >
                              <span className={`${styles.check} ${set.done ? styles.checkOn : styles.checkOff}`}>
                                ✓
                              </span>
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className={styles.noSets}>Geen sets</div>
                    )}
                  </div>

                  {!locked && (
                    <button className={styles.addSetBtn} type="button" onClick={() => addSet(ex.id)}>
                      + Set toevoegen
                    </button>
                  )}
                </section>
              );
            })
          ) : (
            <div className={styles.empty}>Geen oefeningen in deze workout.</div>
          )}

          {/* Add exercise button */}
          {!locked && (
            <button
              className={styles.addExerciseBtn}
              type="button"
              onClick={() => {
                setPickerMode("add");
                setPickerInfoId(null);
                setPickerOpen(true);
              }}
            >
              <IoAdd size={16} />
              Oefening toevoegen
            </button>
          )}
        </div>
      </div>

      {saving && <div className={styles.savingToast}>Opslaan…</div>}

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerInfoId(null); }}
        onStart={({ exercises, musclesWorked }) => {
          setPickerOpen(false);
          setPickerInfoId(null);
          if (pickerMode === "add") addExercises(exercises as any, musclesWorked);
        }}
        initialInfoExerciseId={pickerMode === "info" ? pickerInfoId : null}
      />
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import homeStyles from "../home.module.css";
import gymStyles from "./gym.module.css";
import { FaRegTrashAlt } from "react-icons/fa";

import MuscleMap from "../components/gym/muscle-map/MuscleMap";
import ExercisePickerModal from "../components/gym/ExercisePickerModal";

import { auth } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";

import {
  createGymSession,
  deleteGymSession,
  subscribeToGymSessionsInRange,
} from "../firebase/gymService";
import type { GymSession, GymSessionExercise, GymSet } from "../types/gym";
import { startOfWeekMs, formatDateTime } from "../lib/dateUtils";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultSets(): GymSet[] {
  return [
    { id: id(), targetReps: 8, targetKg: 0, done: false },
    { id: id(), targetReps: 8, targetKg: 0, done: false },
    { id: id(), targetReps: 8, targetKg: 0, done: false },
  ];
}

function isSessionUnfinished(s: GymSession): boolean {
  if ((s as any).finishedAt) return false;

  const exs = s.exercises ?? [];
  if (exs.length === 0) return false;

  for (const ex of exs) {
    const sets = ex.sets ?? [];
    if (sets.length > 0) {
      if (sets.some((set) => !set.done)) return true;
    } else {
      if (ex.done === false) return true;
    }
  }
  return false;
}

function addDaysMs(ms: number, days: number) {
  return ms + days * 24 * 60 * 60 * 1000;
}

export default function GymHomePage() {
  const router = useRouter();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [sessions, setSessions] = useState<GymSession[]>([]);

  const [uid, setUid] = useState<string>("");
  const [authReady, setAuthReady] = useState(false);

  // Week selection
  const [weekStartMs, setWeekStartMs] = useState(() => startOfWeekMs(new Date()));
  const weekEndMs = useMemo(() => addDaysMs(weekStartMs, 7), [weekStartMs]);

  const weekLabel = useMemo(() => {
    const start = new Date(weekStartMs);
    const endInclusive = new Date(weekEndMs - 1);

    const currentYear = new Date().getFullYear();
    const startYear = start.getFullYear();
    const endYear = endInclusive.getFullYear();

    const shouldShowYear =
      startYear !== currentYear || endYear !== currentYear || startYear !== endYear;

    const options: Intl.DateTimeFormatOptions = shouldShowYear
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric" };

    const fmt = new Intl.DateTimeFormat("en-US", options);
    const anyFmt = fmt as any;

    // formatRange formats ranges concisely (and smartly includes year when needed) [web:110]
    if (typeof anyFmt.formatRange === "function") {
      return anyFmt.formatRange(start, endInclusive);
    }

    return `${fmt.format(start)} - ${fmt.format(endInclusive)}`;
  }, [weekStartMs, weekEndMs]);

  // Disable future weeks
  const thisWeekStartMs = useMemo(() => startOfWeekMs(new Date()), []);
  const isCurrentWeek = weekStartMs === thisWeekStartMs;
  const disableNext = isCurrentWeek;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? "");
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to workouts in selected week
  useEffect(() => {
    if (!uid) {
      setSessions([]);
      return;
    }
    return subscribeToGymSessionsInRange(uid, weekStartMs, weekEndMs, setSessions);
  }, [uid, weekStartMs, weekEndMs]);

  const weekMuscles = useMemo(() => {
    const slugs = new Set<string>();
    for (const s of sessions) {
      (s.musclesWorked || []).forEach((m) => slugs.add(String(m)));
    }
    return [...slugs];
  }, [sessions]);

  async function handleDelete(sessionId: string) {
    if (!uid) return;
    const ok = window.confirm("Delete this workout? This can’t be undone.");
    if (!ok) return;
    await deleteGymSession(uid, sessionId);
  }

  return (
    <div className={homeStyles.screen}>
      <div className={homeStyles.headerRow}>
        <div>
          <div className={homeStyles.headerTitle}>Gym</div>
          <div className={homeStyles.headerSubtitle}>
            Track workouts & progressive overload
          </div>
        </div>

        <button
          className={homeStyles.headerButton}
          type="button"
          onClick={() => setPickerOpen(true)}
        >
          +
        </button>
      </div>

      <div className={homeStyles.scrollArea}>
        <div className={homeStyles.section}>
          {/* Week selector card */}
          <div className={homeStyles.card}>
            <div className={gymStyles.weekHeader}>
              <div className={homeStyles.cardTitle}>Select week</div>
              <div className={gymStyles.weekLabel}>{weekLabel}</div>
            </div>

            <div
              className={gymStyles.weekSegWrap}
              role="group"
              aria-label="Week navigation"
            >
              <button
                type="button"
                onClick={() => setWeekStartMs((v) => addDaysMs(v, -7))}
                className={`${gymStyles.weekSegBtn} ${gymStyles.weekSegBtnLeft}`}
                aria-label="Previous week"
                title="Previous week"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={() => setWeekStartMs(startOfWeekMs(new Date()))}
                disabled={isCurrentWeek}
                className={`${gymStyles.weekSegBtn} ${gymStyles.weekSegBtnMid}`}
                aria-label="Go to this week"
                title={isCurrentWeek ? "Already on this week" : "This week"}
              >
                This week
              </button>

              <button
                type="button"
                onClick={() => setWeekStartMs((v) => addDaysMs(v, 7))}
                disabled={disableNext}
                className={`${gymStyles.weekSegBtn} ${gymStyles.weekSegBtnRight}`}
                aria-label="Next week"
                title={disableNext ? "Can’t go to future weeks" : "Next week"}
              >
                ›
              </button>
            </div>
          </div>

          {/* Muscles worked card */}
          <div className={homeStyles.card}>
            <div className={homeStyles.cardTitle} style={{ textAlign: "center" }}>
              Muscles worked on this week
            </div>

            <div className={gymStyles.muscleMaps}>
              <div className={gymStyles.muscleMapItem}>
                <MuscleMap view="front" workedSlugs={weekMuscles} height={260} />
              </div>
              <div className={gymStyles.muscleMapItem}>
                <MuscleMap view="back" workedSlugs={weekMuscles} height={260} />
              </div>
            </div>
          </div>

          {/* Workouts list card */}
          <div className={homeStyles.card}>
            <div className={homeStyles.cardTitle}>Workouts (selected week)</div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {!authReady ? (
                <div className={homeStyles.modalEmptyText}>Loading account…</div>
              ) : !uid ? (
                <div className={homeStyles.modalEmptyText}>
                  You’re not signed in. Go to <code>/auth</code>.
                </div>
              ) : sessions.length === 0 ? (
                <div className={homeStyles.modalEmptyText}>No workouts in this week.</div>
              ) : (
                sessions.map((s) => {
                  const unfinished = isSessionUnfinished(s);

                  return (
                    <div
                      key={s.id}
                      className={gymStyles.exerciseRow2}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/gym/workout/${s.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/gym/workout/${s.id}`);
                        }
                      }}
                      style={{ cursor: "pointer", width: "100%", textAlign: "left" }}
                    >
                      <div className={gymStyles.exerciseMain}>
                        <div className={gymStyles.exerciseName}>
                          {s.name || "Workout"}{" "}
                          {unfinished ? (
                            <span className={homeStyles.overTarget}>(unfinished)</span>
                          ) : (
                            <span style={{ color: "#7EE2A8" }}>(finished)</span>
                          )}
                        </div>

                        <div className={gymStyles.exerciseMeta}>
                          {formatDateTime(s.startedAt)} • {(s.exercises || []).length} exercises
                        </div>
                      </div>

                      <div className={gymStyles.weekRowRight}>
<button
  type="button"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDelete(s.id);
  }}
  className={gymStyles.iconDangerBtn}
  aria-label="Delete workout"
  title="Delete workout"
>
  <FaRegTrashAlt size={16} />
</button>


                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            className={gymStyles.primaryBtn}
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={!uid}
            style={!uid ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
          >
            Start workout
          </button>
        </div>

        <div className={homeStyles.bottomSpacer} />
      </div>

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onStart={async ({ exercises, musclesWorked }) => {
          setPickerOpen(false);
          if (!uid) return;

          const sessionExercises: GymSessionExercise[] = exercises.map((r) => ({
            id: id(),
            ref: r,
            sets: defaultSets(),
            done: false,
          }));

          const newSession: Omit<GymSession, "id"> = {
            name: "Workout",
            startedAt: Date.now(),
            exercises: sessionExercises,
            musclesWorked: musclesWorked || [],
          };

          const sessionId = await createGymSession(uid, newSession);
          router.push(`/gym/workout/${sessionId}`);
        }}
      />
    </div>
  );
}

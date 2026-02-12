"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import homeStyles from "../home.module.css";
import gymStyles from "./gym.module.css";

import MuscleMap from "../components/gym/muscle-map/MuscleMap";
import ExercisePickerModal from "../components/gym/ExercisePickerModal";

import { auth } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";

import { createGymSession, subscribeToRecentGymSessions } from "../firebase/gymService";
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
  // If you ever add finishedAt later, this will keep working
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

export default function GymHomePage() {
  const router = useRouter();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [recent, setRecent] = useState<GymSession[]>([]);

  const [uid, setUid] = useState<string>("");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? "");
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) {
      setRecent([]);
      return;
    }
    return subscribeToRecentGymSessions(uid, 20, setRecent);
  }, [uid]);

  const weekStart = useMemo(() => startOfWeekMs(new Date()), []);
  const weekMuscles = useMemo(() => {
    const slugs = new Set<string>();
    for (const s of recent) {
      if (!s?.startedAt) continue;
      if (s.startedAt < weekStart) continue;
      (s.musclesWorked || []).forEach((m) => slugs.add(String(m)));
    }
    return [...slugs];
  }, [recent, weekStart]);

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
          <div className={homeStyles.card}>
            <div className={homeStyles.cardTitle}>Muscles worked on this week</div>
            <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
              <MuscleMap view="front" workedSlugs={weekMuscles} height={260} />
              <MuscleMap view="back" workedSlugs={weekMuscles} height={260} />
            </div>
          </div>

          <div className={homeStyles.card}>
            <div className={homeStyles.cardTitle}>Recent workouts</div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {!authReady ? (
                <div className={homeStyles.modalEmptyText}>Loading account…</div>
              ) : !uid ? (
                <div className={homeStyles.modalEmptyText}>
                  You’re not signed in. Go to <code>/auth</code>.
                </div>
              ) : recent.length === 0 ? (
                <div className={homeStyles.modalEmptyText}>
                  No workouts yet. Press + to start one.
                </div>
              ) : (
                recent.map((s) => {
                  const unfinished = isSessionUnfinished(s);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={gymStyles.exerciseRow}
                      onClick={() => router.push(`/gym/workout/${s.id}`)}
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

                      <div style={{ color: "#97969B" }}>{">"}</div>
                    </button>
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

          // Use router.push for client navigation (instead of window.location.href)
          router.push(`/gym/workout/${sessionId}`);
        }}
      />
    </div>
  );
}

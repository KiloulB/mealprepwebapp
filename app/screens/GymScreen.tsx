// app/gym/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import homeStyles from "../home.module.css";
import gymStyles from "../gym/gym.module.css";

import { FaRegTrashAlt, FaPlus } from "react-icons/fa";

import {
  IoPlayCircleOutline,
  IoCreateOutline,
  IoDuplicateOutline,
  IoAdd,
} from "react-icons/io5";

import MuscleMap from "../components/gym/muscle-map/MuscleMap";
import ExercisePickerModal from "../components/gym/ExercisePickerModal";
import TemplateMakerModal from "../components/gym/TemplateMakerModal";
import TemplateStartModal from "../components/gym/TemplateStartModal";

import { auth } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";

import { createGymSession, deleteGymSession, subscribeToGymSessionsInRange } from "../firebase/gymService";

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

  // Header actions menu
  const [menuOpen, setMenuOpen] = useState(false);

  // Modals
  const [templateMakerOpen, setTemplateMakerOpen] = useState(false);
  const [templateStartOpen, setTemplateStartOpen] = useState(false);

  // Week selection
  const [weekStartMs, setWeekStartMs] = useState(() => startOfWeekMs(new Date()));
  const weekEndMs = useMemo(() => addDaysMs(weekStartMs, 7), [weekStartMs]);

  const weekLabel = useMemo(() => {
    const start = new Date(weekStartMs);
    const endInclusive = new Date(weekEndMs - 1);

    const currentYear = new Date().getFullYear();
    const startYear = start.getFullYear();
    const endYear = endInclusive.getFullYear();

    const shouldShowYear = startYear !== currentYear || endYear !== currentYear || startYear !== endYear;

    const options: Intl.DateTimeFormatOptions = shouldShowYear
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric" };

    const fmt = new Intl.DateTimeFormat("nl-NL", options);
    const anyFmt = fmt as any;

    if (typeof anyFmt.formatRange === "function") {
      return anyFmt.formatRange(start, endInclusive);
    }
    return `${fmt.format(start)} - ${fmt.format(endInclusive)}`;
  }, [weekStartMs, weekEndMs]);

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

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  async function handleDelete(sessionId: string) {
    if (!uid) return;
    const ok = window.confirm("Verwijder deze workout? Dit kan niet ongedaan worden gemaakt.");
    if (!ok) return;
    await deleteGymSession(uid, sessionId);
  }

const fabMenuItems = useMemo(
  () => [
    { id: "start", label: "Workout starten", icon: <IoPlayCircleOutline size={18} /> },
    { id: "makeTemplate", label: "Template maken", icon: <IoCreateOutline size={18} /> },
    { id: "startFromTemplate", label: "Workout starten vanuit template", icon: <IoDuplicateOutline  size={18} /> },
  ],
  []
);



  const handleMenuPress = (actionId: string) => {
    setMenuOpen(false);
    if (actionId === "start") setPickerOpen(true);
    if (actionId === "makeTemplate") setTemplateMakerOpen(true);
    if (actionId === "startFromTemplate") setTemplateStartOpen(true);
  };

  return (
    <div className={homeStyles.screen}>
      {/* Header met actieknop */}
      <div className={homeStyles.headerRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={homeStyles.headerTitle}>Gym</div>
            <div className={homeStyles.headerSubtitle}>Maak, bewerk en volg je workouts</div>
          </div>

          <div className={gymStyles.headerMenuWrap}>
            <button
              className={homeStyles.headerButton}
              onClick={() => setMenuOpen((v) => !v)}
              type="button"
              disabled={!uid}
              aria-label="Acties openen"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="gym-actions-menu"
              title={!uid ? "Log in om acties te gebruiken" : "Acties"}
            >
              <IoAdd size={24} color="#9CA3AF" />
            </button>

{menuOpen && (
  <div className={gymStyles.headerMenu} id="gym-actions-menu" role="menu">
    {fabMenuItems.map((item) => (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        className={gymStyles.fabMenuItem}
        onClick={() => handleMenuPress(item.id)}
      >
        <span className={gymStyles.fabIcon}>{item.icon}</span>
        <span className={gymStyles.fabLabel}>{item.label}</span>
      </button>
    ))}
  </div>
)}

          </div>
        </div>
      </div>

      <div className={homeStyles.scrollArea}>
        <div className={homeStyles.section}>
          {/* Week selector */}
          <div className={homeStyles.card}>
            <div className={gymStyles.weekHeader}>
              <div className={homeStyles.cardTitle}>{weekLabel}</div>
            </div>

            <div className={gymStyles.weekSegWrap} role="group" aria-label="Week navigatie">
              <button
                type="button"
                onClick={() => setWeekStartMs((v) => addDaysMs(v, -7))}
                className={`${gymStyles.weekSegBtn} ${gymStyles.weekSegBtnLeft}`}
                aria-label="Vorige week"
                title="Vorige week"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={() => setWeekStartMs(startOfWeekMs(new Date()))}
                disabled={isCurrentWeek}
                className={`${gymStyles.weekSegBtn} ${gymStyles.weekSegBtnMid}`}
                aria-label="Ga naar deze week"
                title={isCurrentWeek ? "Je bent al op deze week" : "Deze week"}
              >
                Deze week
              </button>

              <button
                type="button"
                onClick={() => setWeekStartMs((v) => addDaysMs(v, 7))}
                disabled={disableNext}
                className={`${gymStyles.weekSegBtn} ${gymStyles.weekSegBtnRight}`}
                aria-label="Volgende week"
                title={disableNext ? "Kan niet naar toekomstige weken" : "Volgende week"}
              >
                ›
              </button>
            </div>
          </div>

          {/* Spieren gewerkt */}
          <div className={homeStyles.card}>
            <div className={homeStyles.cardTitle} style={{ textAlign: "center" }}>
              Spieren getraind deze week
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

          {/* Workouts lijst */}
          <div className={homeStyles.card}>
            <div className={gymStyles.cardHeaderRow}>
              <div className={homeStyles.cardTitle}>Workouts (geselecteerde week)</div>


            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {!authReady ? (
                <div className={homeStyles.modalEmptyText}>Account laden…</div>
              ) : !uid ? (
                <div className={homeStyles.modalEmptyText}>
                  Je bent niet ingelogd. Ga naar <code>/auth</code>.
                </div>
              ) : sessions.length === 0 ? (
                <div className={homeStyles.modalEmptyText}>Geen workouts deze week.</div>
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
                            <span className={homeStyles.overTarget}>(niet afgerond)</span>
                          ) : (
                            <span style={{ color: "#7EE2A8" }}>(afgerond)</span>
                          )}
                        </div>

                        <div className={gymStyles.exerciseMeta}>
                          {formatDateTime(s.startedAt)} • {(s.exercises || []).length} oefeningen
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
                          aria-label="Workout verwijderen"
                          title="Workout verwijderen"
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
        </div>
      </div>

      {/* Overlay voor buiten klik */}
      {menuOpen && (
        <button
          className={gymStyles.fabOverlay}
          onClick={() => setMenuOpen(false)}
          type="button"
          aria-label="Menu sluiten"
        />
      )}

      {/* Workout starten picker */}
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

      <TemplateMakerModal open={templateMakerOpen} uid={uid} onClose={() => setTemplateMakerOpen(false)} />

      <TemplateStartModal
        open={templateStartOpen}
        uid={uid}
        onClose={() => setTemplateStartOpen(false)}
        onStarted={(sessionId) => router.push(`/gym/workout/${sessionId}`)}
      />
    </div>
  );
}

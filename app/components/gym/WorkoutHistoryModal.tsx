"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { FaRegTrashAlt } from "react-icons/fa";
import { IoCalendarOutline, IoTimeOutline } from "react-icons/io5";

import gymStyles from "../../gym/gym.module.css";
import MuscleMap from "./muscle-map/MuscleMap";
import type { GymSession, GymSessionExercise } from "../../types/gym";
import { updateGymSession, deleteGymSession } from "../../firebase/gymService";

function formatDateLong(ms: number) {
  try {
    return new Date(ms).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return "";
  }
}

function formatDuration(s: { durationSec?: number; finishedAt?: number; startedAt: number }): string {
  const secs =
    s.durationSec ??
    (s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 1000) : null);
  if (!secs || secs < 0) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}u ${m}m` : `${m}m`;
}

export default function WorkoutHistoryModal({
  session: initialSession,
  uid,
  onClose,
  onDeleted,
}: {
  session: GymSession;
  uid: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [session, setSession] = useState(initialSession);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dur = formatDuration(session);

  async function persist(exercises: GymSessionExercise[]) {
    setSaving(true);
    const allDone =
      exercises.length > 0 &&
      exercises.every((ex) => (ex.sets ?? []).length > 0 && (ex.sets ?? []).every((s) => s.done));
    try {
      // JSON round-trip strips `undefined` fields that Firestore rejects
      const cleanExercises = JSON.parse(JSON.stringify(exercises));
      await updateGymSession(uid, session.id, {
        exercises: cleanExercises,
        ...(allDone ? { status: "finished" } : {}),
      });
      setSession((prev) => ({
        ...prev,
        exercises,
        ...(allDone ? { status: "finished" as const } : {}),
      }));
    } finally {
      setSaving(false);
    }
  }

  function toggleSetDone(exId: string, setId: string) {
    const next = session.exercises.map((ex) => {
      if (ex.id !== exId) return ex;
      const nextSets = (ex.sets ?? []).map((s) => (s.id === setId ? { ...s, done: !s.done } : s));
      return { ...ex, sets: nextSets, done: nextSets.every((s) => s.done) };
    });
    setSession((prev) => ({ ...prev, exercises: next }));
    persist(next);
  }

  function updateSetField(
    exId: string,
    setId: string,
    field: "targetKg" | "targetReps",
    raw: string
  ) {
    const parsed =
      raw.trim() === "" ? 0 : field === "targetKg" ? Number(raw) : parseInt(raw, 10);
    const next = session.exercises.map((ex) => {
      if (ex.id !== exId) return ex;
      const nextSets = (ex.sets ?? []).map((s) =>
        s.id === setId ? { ...s, [field]: parsed } : s
      );
      return { ...ex, sets: nextSets };
    });
    setSession((prev) => ({ ...prev, exercises: next }));
    persist(next);
  }

  async function handleDelete() {
    if (!window.confirm(`"${session.name}" verwijderen?`)) return;
    setDeleting(true);
    try {
      await deleteGymSession(uid, session.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  const allSetsDone =
    session.exercises.length > 0 &&
    session.exercises.every((ex) => (ex.sets ?? []).length > 0 && (ex.sets ?? []).every((s) => s.done));
  const showMuscles = (session.status === "finished" || allSetsDone) && (session.musclesWorked ?? []).length > 0;
  const isUnfinished = session.status === "unfinished" && !allSetsDone;

  return createPortal(
    <div className={gymStyles.historyDetailOverlay}>
      {/* Top bar */}
      <div className={gymStyles.historyDetailTopBar}>
        <button
          type="button"
          className={gymStyles.historyDetailIconBtn}
          onClick={onClose}
          aria-label="Sluiten"
        >
          <FiX size={20} />
        </button>

        <div className={gymStyles.historyDetailTitleWrap}>
          <span className={gymStyles.historyDetailTitle}>{session.name || "Workout"}</span>
          {isUnfinished && (
            <span className={gymStyles.historyUnfinishedBadge}>Onvoltooid</span>
          )}
        </div>

        <button
          type="button"
          className={gymStyles.historyDetailDeleteBtn}
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Verwijderen"
        >
          <FaRegTrashAlt size={16} />
        </button>
      </div>

      {/* Meta */}
      <div className={gymStyles.historyDetailMeta}>
        <span className={gymStyles.historyDetailMetaItem}>
          <IoCalendarOutline size={14} />
          {formatDateLong(session.startedAt)}
        </span>
        {dur ? (
          <span className={gymStyles.historyDetailMetaItem}>
            <IoTimeOutline size={14} />
            {dur}
          </span>
        ) : null}
      </div>

      {/* Scrollable body */}
      <div className={gymStyles.historyDetailScroll}>
        {session.exercises.map((ex, exIdx) => (
          <div key={ex.id ?? exIdx} className={gymStyles.tmExCard}>
            <div className={gymStyles.tmExCardHeader}>
              {ex.ref?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ex.ref.image}
                  alt={ex.ref.name ?? ""}
                  style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--bg-card-2)", flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div className={gymStyles.exerciseName} style={{ fontSize: 16 }}>
                  {ex.ref?.name ?? `Oefening ${exIdx + 1}`}
                </div>
                <div className={gymStyles.exerciseMeta}>
                  {(ex.sets ?? []).length} sets
                </div>
              </div>
            </div>

            {/* Set header */}
            <div className={gymStyles.tmSetHeader}>
              <div>Set</div>
              <div>Kg</div>
              <div>Reps</div>
              <div />
            </div>

            {/* Set rows */}
            {(ex.sets ?? []).map((s, idx) => (
              <div
                key={s.id ?? idx}
                className={`${gymStyles.tmSetRow} ${s.done ? gymStyles.tmSetRowDone : ""}`}
              >
                <div className={gymStyles.tmSetNum}>{idx + 1}</div>
                <input
                  className={gymStyles.tmInput}
                  type="text"
                  inputMode="decimal"
                  value={typeof s.targetKg === "number" ? String(s.targetKg) : ""}
                  onChange={(e) => updateSetField(ex.id, s.id, "targetKg", e.target.value)}
                  aria-label="Kg"
                />
                <input
                  className={gymStyles.tmInput}
                  type="text"
                  inputMode="numeric"
                  value={typeof s.targetReps === "number" ? String(s.targetReps) : ""}
                  onChange={(e) => updateSetField(ex.id, s.id, "targetReps", e.target.value)}
                  aria-label="Reps"
                />
                <button
                  type="button"
                  className={gymStyles.historySetCheckBtn}
                  onClick={() => toggleSetDone(ex.id, s.id)}
                  aria-label={s.done ? "Set als niet gedaan markeren" : "Set als gedaan markeren"}
                >
                  <span
                    className={`${gymStyles.historySetCheck} ${s.done ? gymStyles.historySetCheckOn : gymStyles.historySetCheckOff}`}
                  >
                    âœ“
                  </span>
                </button>
              </div>
            ))}
          </div>
        ))}

        {/* Muscle map */}
        {showMuscles && (
          <div style={{ marginBottom: 32 }}>
            <div className={gymStyles.tmSectionLabel}>Spiergroepen</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <MuscleMap view="front" workedSlugs={session.musclesWorked} height={130} />
              <MuscleMap view="back" workedSlugs={session.musclesWorked} height={130} />
            </div>
          </div>
        )}
      </div>

      {saving && <div className={gymStyles.savingToast}>Opslaanâ€¦</div>}
    </div>,
    document.body
  );
}

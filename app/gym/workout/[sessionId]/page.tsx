"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/config"; // keep this matching your project

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
  createdAt?: any;
  updatedAt?: any;
};

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

  // Wait for Firebase auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? "");
    });
    return () => unsub();
  }, []);

  // Subscribe to session doc
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

    // Your assumed path (same as earlier):
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

        setSession({ id: snap.id, ...(snap.data() as Omit<WorkoutSession, "id">) });
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

  async function toggleSetDone(exerciseId: string, setId: string) {
    if (!sessionId || !uid) return;
    if (!session?.exercises) return;

    // Optimistic update
    const nextExercises: WorkoutExercise[] = session.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;

      const nextSets = (ex.sets ?? []).map((s) =>
        s.id === setId ? { ...s, done: !s.done } : s
      );

      const allDone = nextSets.length > 0 && nextSets.every((s) => !!s.done);

      return { ...ex, sets: nextSets, done: allDone };
    });

    setSession((prev) => (prev ? { ...prev, exercises: nextExercises } : prev));

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

  if (!sessionId) {
    return (
      <div className="p-6 text-white">
        <h2 className="text-xl font-semibold">Missing sessionId</h2>
        <p className="text-gray-400">
          URL must be <code>/gym/workout/&lt;sessionId&gt;</code>
        </p>
        <button
          className="mt-4 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
          onClick={() => router.push("/")}
        >
          Go home
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-white">
        <p>Loading workout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-white">
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-red-400 mt-2">{error}</p>
        <p className="text-gray-400 mt-2">
          sessionId: <code>{sessionId}</code>
        </p>
        <button
          className="mt-4 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
          onClick={() => router.push("/")}
        >
          Go home
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 text-white">
        <h2 className="text-xl font-semibold">Workout not found</h2>
        <button
          className="mt-4 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
          onClick={() => router.push("/")}
        >
          Go home
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{session.name ?? "Workout"}</h1>
          <div className="text-sm text-gray-400 mt-1">
            {saving ? "Saving..." : " "}
          </div>
        </div>

        <button
          className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700"
          onClick={() => router.push("/")}
        >
          Back
        </button>
      </div>

      {Array.isArray(session.musclesWorked) && session.musclesWorked.length > 0 && (
        <div className="mb-6 text-sm text-gray-300">
          Muscles: {session.musclesWorked.join(", ")}
        </div>
      )}

      <div className="space-y-6">
        {Array.isArray(session.exercises) && session.exercises.length > 0 ? (
          session.exercises.map((ex, exIdx) => (
            <div key={ex.id ?? exIdx} className="bg-gray-900 rounded p-4">
              <div className="flex items-start gap-4">
                {ex.ref?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ex.ref.image}
                    alt={ex.ref?.name ?? "Exercise"}
                    className="w-20 h-20 object-cover rounded"
                  />
                ) : null}

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">
                      {ex.ref?.name ?? `Exercise ${exIdx + 1}`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {ex.done ? "Exercise done" : ""}
                    </div>
                  </div>

                  {Array.isArray(ex.ref?.equipment) && ex.ref!.equipment!.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      Equipment: {ex.ref!.equipment!.join(", ")}
                    </div>
                  )}

                  {Array.isArray(ex.sets) && ex.sets.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {ex.sets.map((set, setIdx) => (
                        <button
                          key={set.id ?? setIdx}
                          type="button"
                          className={`w-full flex items-center justify-between rounded px-3 py-2 text-left ${
                            set.done ? "bg-green-900/40" : "bg-gray-800"
                          } hover:bg-gray-700`}
                          onClick={() => toggleSetDone(ex.id, set.id)}
                          disabled={saving}
                        >
                          <div className="text-sm">
                            <span className="text-gray-300">
                              Set {setIdx + 1}:
                            </span>{" "}
                            {set.targetReps ?? "-"} reps @ {set.targetKg ?? 0} kg
                          </div>

                          <div className="text-sm">
                            {set.done ? "Done" : "Tap to complete"}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-400">No sets</div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-gray-400">No exercises in this workout.</div>
        )}
      </div>
    </div>
  );
}

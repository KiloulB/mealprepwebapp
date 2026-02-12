"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../../firebase/config"; // adjust if needed

type WorkoutSet = {
  done?: boolean;
};

type WorkoutExercise = {
  done?: boolean;
  sets?: WorkoutSet[];
};

type SessionDoc = {
  name?: string;
  musclesWorked?: string[];
  exercises?: WorkoutExercise[];
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
};

function isUnfinished(s: SessionDoc): boolean {
  const exs = s.exercises ?? [];
  if (exs.length === 0) return false;

  // unfinished if ANY set is not done, or (fallback) any exercise not done
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

export default function RecentWorkouts() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [items, setItems] = useState<Array<{ id: string; data: SessionDoc }>>(
    []
  );
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? "");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;

    setError("");

    // same path you used for the workout page:
    const col = collection(db, "users", uid, "gymSessions");

    const q = query(col, orderBy("updatedAt", "desc"), limit(10));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as SessionDoc,
        }));
        setItems(next);
      },
      (e) => setError(e.message)
    );

    return () => unsub();
  }, [uid]);

  const rendered = useMemo(() => {
    return items.map((it) => {
      const unfinished = isUnfinished(it.data);
      return { ...it, unfinished };
    });
  }, [items]);

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold">Recent workouts</h2>
        <button
          className="text-sm text-blue-400 hover:text-blue-300"
          onClick={() => router.push("/gym")}
        >
          View all
        </button>
      </div>

      {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

      {rendered.length === 0 ? (
        <div className="text-gray-400 text-sm">No workouts yet.</div>
      ) : (
        <div className="space-y-2">
          {rendered.map(({ id, data, unfinished }) => (
            <button
              key={id}
              className="w-full text-left bg-black/30 hover:bg-black/40 rounded-lg p-3 border border-white/5"
              onClick={() => router.push(`/gym/workout/${id}`)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-white font-medium">
                  {data.name ?? "Workout"}
                </div>

                {unfinished ? (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-200 border border-yellow-400/20">
                    Unfinished
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/15 text-green-200 border border-green-400/20">
                    Finished
                  </span>
                )}
              </div>

              {Array.isArray(data.musclesWorked) && data.musclesWorked.length > 0 && (
                <div className="text-gray-400 text-xs mt-1">
                  {data.musclesWorked.join(", ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import homeStyles from "../home.module.css";
import gymStyles from "../gym/Gym.module.css";
import { IoChevronBack } from "react-icons/io5";

import { useUser } from "../context/UserContext";
import { applyProgressiveOverload, getGymPlanById, saveGymSession } from "../firebase/gymService";
import type { GymPlan, GymPerformedExercise } from "../types/gym";

type SetInput = { reps: string; weightKg: string };

export default function GymStartScreen() {
  const router = useRouter();
  const { authUser } = useUser();

  const params = useParams<{ planId?: string }>(); // dynamic segment [web:251]
  const planId = typeof params?.planId === "string" ? params.planId : "";

  const searchParams = useSearchParams();
  const workoutId = searchParams.get("workoutId") || "";

  const [plan, setPlan] = useState<GymPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const workout = useMemo(() => {
    return plan?.workouts?.find((w) => w.id === workoutId) || null;
  }, [plan, workoutId]);

  const [performed, setPerformed] = useState<Record<string, SetInput[]>>({});

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!authUser) return;
      if (!planId) return;
      if (!workoutId) return;

      setLoading(true);
      try {
        const p = await getGymPlanById(authUser.uid, planId);
        if (!alive) return;

        setPlan(p);

        // init performed inputs from plan prescription
        if (p) {
          const w = p.workouts.find((x) => x.id === workoutId);
          if (w) {
            const init: Record<string, SetInput[]> = {};
            w.items.forEach((it) => {
              init[it.exerciseId] = Array.from({ length: it.sets }).map(() => ({
                reps: "",
                weightKg: String(it.currentWeightKg ?? 0),
              }));
            });
            setPerformed(init);
          }
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setPlan(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authUser, planId, workoutId]);

  const finishWorkout = async () => {
    if (!authUser) return;
    if (!planId) return;
    if (!workoutId) return;
    if (!workout) return;

    setSaving(true);

    const performedArr: GymPerformedExercise[] = workout.items.map((it) => {
      const sets = (performed[it.exerciseId] || []).map((s) => ({
        reps: parseInt(s.reps || "0", 10) || 0,
        weightKg: parseFloat(s.weightKg || "0") || 0,
      }));
      return { exerciseId: it.exerciseId, sets };
    });

    try {
      await saveGymSession(authUser.uid, {
        planId,
        workoutId,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        performed: performedArr,
        overloadApplied: false,
      });

      await applyProgressiveOverload(authUser.uid, planId, workoutId, performedArr);

      router.push(`/gym/${planId}`);
    } finally {
      setSaving(false);
    }
  };

  // --- UI states ---
  if (!planId) {
    return (
      <div className={homeStyles.screen}>
        <div className={homeStyles.headerRow}>
          <button className={gymStyles.backBtn} type="button" onClick={() => router.push("/gym")}>
            <IoChevronBack size={20} />
          </button>
          <div>
            <h1 className={homeStyles.headerTitle}>Workout</h1>
            <p className={homeStyles.headerSubtitle}>Missing planId in URL</p>
          </div>
        </div>
      </div>
    );
  }

  if (!workoutId) {
    return (
      <div className={homeStyles.screen}>
        <div className={homeStyles.headerRow}>
          <button className={gymStyles.backBtn} type="button" onClick={() => router.push(`/gym/${planId}`)}>
            <IoChevronBack size={20} />
          </button>
          <div>
            <h1 className={homeStyles.headerTitle}>Workout</h1>
            <p className={homeStyles.headerSubtitle}>Missing workoutId</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={homeStyles.screen}>
        <div className={homeStyles.headerRow}>
          <button className={gymStyles.backBtn} type="button" onClick={() => router.push(`/gym/${planId}`)}>
            <IoChevronBack size={20} />
          </button>
          <div>
            <h1 className={homeStyles.headerTitle}>Workout</h1>
            <p className={homeStyles.headerSubtitle}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!plan || !workout) {
    return (
      <div className={homeStyles.screen}>
        <div className={homeStyles.headerRow}>
          <button className={gymStyles.backBtn} type="button" onClick={() => router.push(`/gym/${planId}`)}>
            <IoChevronBack size={20} />
          </button>
          <div>
            <h1 className={homeStyles.headerTitle}>Workout</h1>
            <p className={homeStyles.headerSubtitle}>Plan/workout not found</p>
          </div>
        </div>
      </div>
    );
  }

  // --- main ---
  return (
    <div className={homeStyles.screen}>
      <div className={homeStyles.headerRow}>
        <button className={gymStyles.backBtn} type="button" onClick={() => router.push(`/gym/${planId}`)}>
          <IoChevronBack size={20} />
        </button>
        <div>
          <h1 className={homeStyles.headerTitle}>{workout.name}</h1>
          <p className={homeStyles.headerSubtitle}>Log je sets en reps</p>
        </div>
      </div>

      <div className={homeStyles.scrollArea}>
        <div className={homeStyles.section}>
          <div className={homeStyles.card}>
            <div className={gymStyles.runner}>
              {workout.items.map((it) => (
                <div key={it.exerciseId} className={gymStyles.exerciseBlock}>
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={gymStyles.exerciseThumb} src={it.imageUrl} alt={it.name} loading="lazy" />
                  ) : null}

                  <div className={gymStyles.exerciseHeader}>
                    <div className={gymStyles.exerciseTitle}>{it.name}</div>
                    <div className={gymStyles.exerciseMeta}>
                      {it.sets} sets • {it.repMin}-{it.repMax} reps • {it.currentWeightKg}kg
                    </div>
                  </div>

                  {(performed[it.exerciseId] || []).map((s, idx) => (
                    <div key={idx} className={gymStyles.setRow}>
                      <div className={gymStyles.setNum}>{idx + 1}</div>

                      <input
                        className={gymStyles.smallInput}
                        placeholder="reps"
                        inputMode="numeric"
                        value={s.reps}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPerformed((prev) => ({
                            ...prev,
                            [it.exerciseId]: prev[it.exerciseId].map((x, i) => (i === idx ? { ...x, reps: v } : x)),
                          }));
                        }}
                      />

                      <input
                        className={gymStyles.smallInput}
                        placeholder="kg"
                        inputMode="decimal"
                        value={s.weightKg}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPerformed((prev) => ({
                            ...prev,
                            [it.exerciseId]: prev[it.exerciseId].map((x, i) => (i === idx ? { ...x, weightKg: v } : x)),
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              ))}

              <button className={gymStyles.primaryBtn} type="button" onClick={finishWorkout} disabled={saving}>
                {saving ? "Opslaan..." : "Finish workout"}
              </button>
            </div>
          </div>

          <div className={homeStyles.bottomSpacer} />
        </div>
      </div>
    </div>
  );
}

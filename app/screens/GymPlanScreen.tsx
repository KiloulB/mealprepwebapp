"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import homeStyles from "../home.module.css";
import gymStyles from "../gym/Gym.module.css";
import { IoChevronBack, IoCreateOutline, IoPlay } from "react-icons/io5";

import { useUser } from "../context/UserContext";
import { getGymPlanById } from "../firebase/gymService";
import type { GymPlan } from "../types/gym";
import GymPlanModal from "../components/gym/GymPlanModal";
import { deleteGymPlan } from "../firebase/gymService"; // optional: remove if you don't want delete here

export default function GymPlanScreen() {
  const router = useRouter();
  const params = useParams<{ planId?: string }>(); // App Router dynamic segment [web:251]
  const planId = typeof params?.planId === "string" ? params.planId : "";

  const { authUser } = useUser();

  const [plan, setPlan] = useState<GymPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!authUser) return;
      if (!planId) return;

      setLoading(true);
      try {
        const p = await getGymPlanById(authUser.uid, planId);
        if (!alive) return;
        setPlan(p);
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
  }, [authUser, planId]);

  // ---- UI states ----
  if (!planId) {
    return (
      <div className={homeStyles.screen}>
        <div className={homeStyles.headerRow}>
          <button className={gymStyles.backBtn} type="button" onClick={() => router.push("/gym")}>
            <IoChevronBack size={20} />
          </button>
          <div>
            <h1 className={homeStyles.headerTitle}>Gym</h1>
            <p className={homeStyles.headerSubtitle}>No plan selected</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className={homeStyles.screen}>
        <div className={homeStyles.headerRow}>
          <button className={gymStyles.backBtn} type="button" onClick={() => router.push("/gym")}>
            <IoChevronBack size={20} />
          </button>
          <div>
            <h1 className={homeStyles.headerTitle}>Gym</h1>
            <p className={homeStyles.headerSubtitle}>Not signed in</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={homeStyles.screen}>
        <div className={homeStyles.headerRow}>
          <button className={gymStyles.backBtn} type="button" onClick={() => router.push("/gym")}>
            <IoChevronBack size={20} />
          </button>
          <div>
            <h1 className={homeStyles.headerTitle}>Plan</h1>
            <p className={homeStyles.headerSubtitle}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className={homeStyles.screen}>
        <div className={homeStyles.headerRow}>
          <button className={gymStyles.backBtn} type="button" onClick={() => router.push("/gym")}>
            <IoChevronBack size={20} />
          </button>
          <div>
            <h1 className={homeStyles.headerTitle}>Plan</h1>
            <p className={homeStyles.headerSubtitle}>Plan not found</p>
          </div>
        </div>

        <div className={homeStyles.scrollArea}>
          <div className={homeStyles.section}>
            <div className={homeStyles.card} style={{ padding: 14 }}>
              <button
                className={gymStyles.startBtn}
                type="button"
                onClick={() => router.push("/gym")}
              >
                Back to Gym
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- main screen ----
  return (
    <div className={homeStyles.screen}>
      <div className={homeStyles.headerRow}>
        <button className={gymStyles.backBtn} type="button" onClick={() => router.push("/gym")}>
          <IoChevronBack size={20} />
        </button>

        <div style={{ flex: 1 }}>
          <h1 className={homeStyles.headerTitle}>{plan.title}</h1>
          <p className={homeStyles.headerSubtitle}>Kies een workout om te starten</p>
        </div>

        <button className={gymStyles.editBtn} type="button" onClick={() => setEditOpen(true)} aria-label="Edit">
          <IoCreateOutline size={20} />
        </button>
      </div>

      <div className={homeStyles.scrollArea}>
        <div className={homeStyles.section}>
          <div className={homeStyles.card}>
            <div className={gymStyles.list}>
              {(plan.workouts || []).map((w) => (
                <div key={w.id} className={gymStyles.workoutRow}>
                  <div style={{ minWidth: 0 }}>
                    <div className={gymStyles.planTitle}>{w.name}</div>
                    <div className={gymStyles.planMeta}>{(w.items || []).length} oefeningen</div>
                  </div>

                  <button
                    className={gymStyles.startBtn}
                    type="button"
                    onClick={() =>
                      router.push(`/gym/${plan.id}/start?workoutId=${encodeURIComponent(w.id)}`)
                    }
                  >
                    <IoPlay size={18} />
                    Start
                  </button>
                </div>
              ))}
            </div>

            {/* Optional delete button */}
            <div style={{ padding: 14 }}>
              <button
                type="button"
                style={{
                  width: "100%",
                  borderRadius: 14,
                  padding: "12px 14px",
                  border: "1px solid rgba(228, 34, 42, 0.35)",
                  background: "rgba(228, 34, 42, 0.12)",
                  color: "#ffb4b8",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
                onClick={async () => {
                  await deleteGymPlan(authUser.uid, plan.id);
                  router.push("/gym");
                }}
              >
                Delete plan
              </button>
            </div>
          </div>

          <div className={homeStyles.bottomSpacer} />
        </div>
      </div>

      {editOpen && (
        <GymPlanModal
          userId={authUser.uid}
          plan={plan}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}

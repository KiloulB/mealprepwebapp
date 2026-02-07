"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import homeStyles from "../home.module.css";
import gymStyles from "../gym/Gym.module.css";
import { IoAdd, IoBarbellOutline, IoClose, IoCreateOutline } from "react-icons/io5";

import { useUser } from "../context/UserContext";
import { subscribeToGymPlans } from "../firebase/gymService";
import type { GymPlan } from "../types/gym";
import GymPlanModal from "../components/gym/GymPlanModal";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function GymScreen() {
  const router = useRouter();
  const { authUser } = useUser();

  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [fabOpen, setFabOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<GymPlan | null>(null);

  const [selectOpen, setSelectOpen] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    const unsub = subscribeToGymPlans(authUser.uid, setPlans);
    return () => unsub && unsub();
  }, [authUser]);

  const fabItems = useMemo(
    () => [
      { id: "new", label: "New plan", icon: <IoBarbellOutline size={18} /> },
      { id: "edit", label: "Edit plan", icon: <IoCreateOutline size={18} /> },
    ],
    [],
  );

  const onFab = (id: string) => {
    setFabOpen(false);
    if (id === "new") {
      setEditingPlan(null);
      setModalOpen(true);
    }
    if (id === "edit") {
      if (!plans.length) return;
      setSelectOpen(true);
    }
  };

  return (
    <div className={homeStyles.screen}>
      <div className={homeStyles.headerRow}>
        <div>
          <h1 className={homeStyles.headerTitle}>Gym</h1>
          <p className={homeStyles.headerSubtitle}>Maak plannen, start workouts, track progress</p>
        </div>
      </div>

      <div className={homeStyles.scrollArea}>
        <div className={homeStyles.section}>
          <div className={homeStyles.card}>
            {plans.length === 0 ? (
              <div className={gymStyles.empty}>
                <IoBarbellOutline size={44} color="#97969b" />
                <div className={gymStyles.emptyTitle}>Nog geen plannen</div>
                <div className={gymStyles.emptySub}>Tik op + om een plan te maken</div>
              </div>
            ) : (
              <div className={gymStyles.list}>
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={gymStyles.planBtn}
                    onClick={() => router.push(`/gym/${p.id}`)}
                  >
                    <div className={gymStyles.planTitle}>{p.title}</div>
                    <div className={gymStyles.planMeta}>{(p.workouts || []).length} workouts</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={homeStyles.bottomSpacer} />
        </div>
      </div>

      {fabOpen && (
        <button className={gymStyles.fabOverlay} onClick={() => setFabOpen(false)} type="button" aria-label="Close menu" />
      )}

      {fabOpen && (
        <div className={gymStyles.fabMenu}>
          {fabItems.map((it) => (
            <button key={it.id} className={gymStyles.fabItem} onClick={() => onFab(it.id)} type="button">
              <span className={gymStyles.fabIcon}>{it.icon}</span>
              <span className={gymStyles.fabLabel}>{it.label}</span>
            </button>
          ))}
        </div>
      )}

      <button className={gymStyles.fab} onClick={() => setFabOpen((v) => !v)} type="button" aria-label="Add">
        <IoAdd size={26} color="#000" />
      </button>

      {modalOpen && authUser && (
        <GymPlanModal
          userId={authUser.uid}
          plan={editingPlan}
          onClose={() => {
            setModalOpen(false);
            setEditingPlan(null);
          }}
        />
      )}

      {selectOpen && (
        <div className={homeStyles.modalOverlay} role="dialog" aria-modal="true">
          <div className={cx(homeStyles.modalCard, gymStyles.modalNarrow)}>
            <div className={cx(homeStyles.flexBetween, homeStyles.modalHeader)}>
              <h3 className={homeStyles.modalTitle}>Selecteer plan</h3>
              <button className={homeStyles.iconButton} onClick={() => setSelectOpen(false)} type="button" aria-label="Close">
                <IoClose size={22} />
              </button>
            </div>

            <div className={gymStyles.selectList}>
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={gymStyles.selectItem}
                  onClick={() => {
                    setEditingPlan(p);
                    setSelectOpen(false);
                    setModalOpen(true);
                  }}
                >
                  <div className={gymStyles.selectMain}>
                    <div className={gymStyles.selectTitle}>{p.title}</div>
                    <div className={gymStyles.selectMeta}>{(p.workouts || []).length} workouts</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

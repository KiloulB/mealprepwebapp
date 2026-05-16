"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IoAdd, IoCheckmarkCircle, IoTrashOutline, IoInformationCircleOutline,
  IoRestaurantOutline, IoChevronForward,
} from "react-icons/io5";
import { useUser } from "../context/UserContext";
import { completeMealPrepPlan, deleteMealPrepPlan } from "../firebase/mealPrepService";
import type { MealPrepPlan, PrepMeal } from "../types/mealPrep";
import PlanSetupModal from "../components/mealprep/PlanSetupModal";
import HelpOverlay from "../components/HelpOverlay";
import styles from "./MealPrepScreen.module.css";

const DAY_LABELS    = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const DAY_FULL      = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const MONTH_NL      = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
const PATTERN_COLORS: Record<string, string> = {
  daily: "var(--accent)", alternateA: "#2A9DB5", alternateB: "#72A82C", manual: "#A1A1A1",
};

function daysBetween(a: string, b: string): number {
  const da = new Date(a), db = new Date(b);
  da.setHours(0,0,0,0); db.setHours(0,0,0,0);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}
function todayIso() { return new Date().toISOString().split("T")[0]; }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_NL[d.getMonth()]}`;
}
function cookDayLabel(n: number) { return DAY_FULL[n - 1] ?? "?"; }
function weekInfo(plan: MealPrepPlan) {
  const passed = Math.max(0, daysBetween(plan.startDate, todayIso()));
  const total  = plan.timeSpanWeeks;
  const current = Math.max(1, Math.min(total, Math.floor(passed / 7) + 1));
  const pct     = Math.min(100, Math.round((passed / (total * 7)) * 100));
  return { current, total, pct };
}
function getMealForDay(meals: PrepMeal[], weekday: number): PrepMeal | null {
  for (const m of meals) {
    if (m.pattern === "daily") return m;
    if (m.pattern === "manual" && m.manualDays?.includes(weekday)) return m;
  }
  return null;
}
function buildSlots(plan: MealPrepPlan) {
  const mA = plan.meals.find(m => m.pattern === "alternateA") ?? null;
  const mB = plan.meals.find(m => m.pattern === "alternateB") ?? null;
  const hasAlt = mA !== null || mB !== null;
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now); mon.setDate(now.getDate() - dow); mon.setHours(0,0,0,0);
  return Array.from({ length: 7 }, (_, i) => {
    const day  = i + 1;
    const date = new Date(mon); date.setDate(mon.getDate() + i);
    const iso  = date.toISOString().split("T")[0];
    const nonAlt = plan.meals.filter(m => m.pattern !== "alternateA" && m.pattern !== "alternateB");
    const direct = getMealForDay(nonAlt, day);
    if (direct) return { day, label: DAY_LABELS[i], iso, date, meal: direct as PrepMeal | null };
    if (hasAlt) {
      const diff = daysBetween(plan.startDate, iso);
      return { day, label: DAY_LABELS[i], iso, date, meal: (diff % 2 === 0 ? mA : mB) as PrepMeal | null };
    }
    return { day, label: DAY_LABELS[i], iso, date, meal: null as PrepMeal | null };
  });
}

export default function MealPrepScreen() {
  const { authUser, mealPrepPlan, helpModeEnabled } = useUser();
  const router = useRouter();

  const todayDow  = ((new Date().getDay() + 6) % 7) + 1;
  const [setupOpen,      setSetupOpen]      = useState(false);
  const [helpOpen,       setHelpOpen]       = useState(false);
  const [completing,     setCompleting]     = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  const plan      = mealPrepPlan;
  const isActive  = plan?.status === "active";
  const today     = todayIso();
  const daysLeft  = plan?.endDate ? daysBetween(today, plan.endDate) : null;
  const slots     = isActive ? buildSlots(plan!) : [];
  const todayMeal = slots.find(s => s.day === todayDow)?.meal ?? null;

  const doComplete = async () => {
    if (!authUser) return;
    setCompleting(true);
    try { await completeMealPrepPlan(authUser.uid); } finally { setCompleting(false); }
  };
  const doDelete = async () => {
    if (!authUser) return;
    setDeleting(true);
    try { await deleteMealPrepPlan(authUser.uid); setConfirmDelete(false); } finally { setDeleting(false); }
  };

  const HELP_STEPS = [
    {
      title: "Plan aanmaken",
      description: (<><p><strong>Tik op +</strong> en doorloop de stappen om je maaltijdplan in te stellen.</p></>),
    },
    {
      title: "Vandaag",
      description: (<><p>De kaart bovenaan toont altijd de maaltijd van vandaag. Tik erop om het recept te openen.</p></>),
    },
    {
      title: "Deze week",
      description: (<><p>Tik op een dag in de weekstrip om het bijbehorende recept direct te openen.</p><p>Gekleurde stippen geven het eetpatroon aan.</p></>),
    },
  ];

  return (
    <div className={styles.screen}>

      {/* â”€â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Meal Prep</span>
        <button className={styles.addBtn} onClick={() => setSetupOpen(true)} aria-label="Nieuw plan">
          <IoAdd size={20} />
        </button>
      </div>

      {isActive && plan ? (() => {
        const wi = weekInfo(plan);
        return (
          <>
            {/* â”€â”€â”€ Progress strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className={styles.progressStrip}>
              <span className={styles.progressLabel}>Week {wi.current}/{wi.total}</span>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${wi.pct}%` }} />
              </div>
              {daysLeft !== null && daysLeft >= 0 && (
                <span className={[styles.progressDays, daysLeft <= 3 ? styles.progressDaysWarn : ""].join(" ")}>
                  {daysLeft === 0 ? "Vandaag laatste dag" : `${daysLeft} d`}
                </span>
              )}
            </div>

            {/* â”€â”€â”€ Today card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className={styles.todayCard}>
              <div className={styles.todayMeta}>
                <span className={styles.todayTag}>Vandaag</span>
                <span className={styles.todayDate}>{DAY_FULL[todayDow - 1]}, {fmtDate(today)}</span>
              </div>

              {todayMeal ? (
                <button
                  className={styles.todayRecipeBtn}
                  onClick={() => router.push(`/recipes/${todayMeal.recipeId}`)}
                >
                  <div className={styles.todayRecipeInner}>
                    <span className={styles.todayRecipeName}>{todayMeal.recipeTitle}</span>
                    {todayMeal.kcal > 0 && (
                      <span className={styles.todayRecipeMacros}>
                        {todayMeal.kcal} kcal{todayMeal.protein > 0 ? ` Â· ${todayMeal.protein}g eiwit` : ""}
                      </span>
                    )}
                  </div>
                  <span className={styles.todayChevronWrap}>
                    <IoChevronForward size={16} />
                  </span>
                </button>
              ) : (
                <p className={styles.todayEmpty}>Geen maaltijd gepland voor vandaag.</p>
              )}
            </div>

            {/* â”€â”€â”€ Week strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className={styles.weekSection}>
              <span className={styles.weekTitle}>Deze week</span>
              <div className={styles.weekStrip}>
                {slots.map(slot => {
                  const isToday = slot.day === todayDow;
                  const hasMeal = slot.meal !== null;
                  return (
                    <button
                      key={slot.day}
                      className={[
                        styles.weekBtn,
                        isToday ? styles.weekBtnToday : "",
                        !hasMeal ? styles.weekBtnEmpty : "",
                      ].join(" ")}
                      onClick={() => hasMeal && router.push(`/recipes/${slot.meal!.recipeId}`)}
                      disabled={!hasMeal}
                    >
                      <span className={styles.weekBtnDay}>{slot.label}</span>
                      <span className={styles.weekBtnNum}>{slot.date.getDate()}</span>
                      <span
                        className={styles.weekBtnDot}
                        style={{
                          background: hasMeal
                            ? (PATTERN_COLORS[slot.meal!.pattern] ?? "var(--accent)")
                            : "rgba(255,255,255,0.07)",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* â”€â”€â”€ Cook day info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className={styles.cookInfo}>
              <span className={styles.cookInfoText}>
                Kookdag: <strong>{cookDayLabel(plan.cookDay)}</strong>
              </span>
            </div>

            {/* â”€â”€â”€ Plan actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {!confirmDelete ? (
              <div className={styles.actionsRow}>
                <button className={styles.completeBtn} onClick={doComplete} disabled={completing}>
                  <IoCheckmarkCircle size={15} />
                  {completing ? "Bezigâ€¦" : "Voltooien"}
                </button>
                <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} disabled={deleting}>
                  <IoTrashOutline size={15} />
                  Verwijderen
                </button>
              </div>
            ) : (
              <div className={styles.confirmCard}>
                <p className={styles.confirmQ}>Plan verwijderen?</p>
                <div className={styles.confirmBtns}>
                  <button className={styles.confirmYes} onClick={doDelete} disabled={deleting}>
                    {deleting ? "Bezigâ€¦" : "Ja, verwijder"}
                  </button>
                  <button className={styles.confirmNo} onClick={() => setConfirmDelete(false)}>
                    Annuleer
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })() : plan?.status === "completed" ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} style={{ background: "rgba(114,168,44,0.1)" }}>
            <IoCheckmarkCircle size={36} color="#72A82C" />
          </div>
          <span className={styles.emptyTitle}>Plan afgerond!</span>
          <span className={styles.emptySub}>Goed gedaan. Klaar voor de volgende week?</span>
          <button className={styles.emptyBtn} onClick={() => setSetupOpen(true)}>
            <IoAdd size={16} /> Nieuw plan
          </button>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <IoRestaurantOutline size={36} style={{ color: "var(--accent)" }} />
          </div>
          <span className={styles.emptyTitle}>Nog geen plan</span>
          <span className={styles.emptySub}>Stel een meal prep plan in en weet elke dag precies wat je eet.</span>
          <button className={styles.emptyBtn} onClick={() => setSetupOpen(true)}>
            <IoAdd size={16} /> Plan aanmaken
          </button>
        </div>
      )}

      {setupOpen && (
        <PlanSetupModal onClose={() => setSetupOpen(false)} existingPlan={plan ?? undefined} />
      )}
      {helpModeEnabled && (
        <button className={styles.helpBtn} onClick={() => setHelpOpen(true)} aria-label="Uitleg">
          <IoInformationCircleOutline size={22} />
        </button>
      )}
      {helpOpen && (
        <HelpOverlay steps={HELP_STEPS} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  );
}

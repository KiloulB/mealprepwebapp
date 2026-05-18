"use client";

import { useState } from "react";
import {
  IoAdd, IoPencilOutline, IoCheckmarkCircle, IoTrashOutline, IoInformationCircleOutline,
  IoRestaurantOutline, IoChevronForward,
} from "react-icons/io5";
import { useUser } from "../context/UserContext";
import { completeMealPrepPlan, deleteMealPrepPlan } from "../firebase/mealPrepService";
import { getRecipeById } from "../firebase/dataService";
import { builtinRecipes } from "../data/builtinRecipes";
import type { MealPrepPlan, PrepMeal } from "../types/mealPrep";
import type { Recipe } from "../types/user";
import PlanSetupModal from "../components/mealprep/PlanSetupModal";
import RecipeDetailModal from "../components/RecipeDetailModal";
import HelpOverlay from "../components/HelpOverlay";
import styles from "./MealPrepScreen.module.css";

const ACCENT_STYLE = { color: "var(--accent)" } as const;

const DAY_LABELS    = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const DAY_FULL      = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const MONTH_NL      = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
const PATTERN_COLORS: Record<string, string> = {
  daily: "var(--accent)", alternateA: "#2A9DB5", alternateB: "#72A82C", manual: "#A1A1A1",
};
const MEAL_TYPE_NL: Record<string, string> = {
  breakfast: "Ontbijt", lunch: "Lunch", dinner: "Avondeten",
};
const MEAL_TYPE_SHORT: Record<string, string> = {
  breakfast: "Ontb.", lunch: "Lunch", dinner: "Avond.",
};

function selectedDayLabel(selectedDow: number, todayDow: number): string {
  const diff = selectedDow - todayDow;
  if (diff === 0) return "Vandaag";
  if (diff === -1) return "Gisteren";
  if (diff === 1) return "Morgen";
  return DAY_FULL[selectedDow - 1];
}

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
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  const openRecipe = async (recipeId: string) => {
    if (!authUser) return;
    const fromFirestore = await getRecipeById(authUser.uid, recipeId).catch(() => null);
    if (fromFirestore) { setDetailRecipe(fromFirestore); return; }
    const builtin = builtinRecipes.find((b) => b.id === recipeId) ?? null;
    setDetailRecipe(builtin);
  };

  const todayDow  = ((new Date().getDay() + 6) % 7) + 1;
  const [setupOpen,      setSetupOpen]      = useState(false);
  const [helpOpen,       setHelpOpen]       = useState(false);
  const [completing,     setCompleting]     = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [selectedDow,    setSelectedDow]    = useState(todayDow);

  const plan          = mealPrepPlan;
  const isActive      = plan?.status === "active";
  const today         = todayIso();
  const daysLeft      = plan?.endDate ? daysBetween(today, plan.endDate) : null;
  const slots         = isActive ? buildSlots(plan!) : [];
  const selectedSlot  = slots.find(s => s.day === selectedDow);
  const selectedMeal  = selectedSlot?.meal ?? null;

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
        <button className={styles.addBtn} onClick={() => setSetupOpen(true)} aria-label={isActive ? "Plan bewerken" : "Nieuw plan"}>
          {isActive ? <IoPencilOutline size={18} /> : <IoAdd size={20} />}
        </button>
      </div>

      {isActive && plan ? (() => {
        const wi = weekInfo(plan);
        const isCookDay = todayDow === plan.cookDay;
        const cookSummary: { recipeId: string; recipeTitle: string; count: number }[] = isCookDay
          ? slots.reduce<{ recipeId: string; recipeTitle: string; count: number }[]>((acc, slot) => {
              if (!slot.meal) return acc;
              const existing = acc.find(x => x.recipeId === slot.meal!.recipeId);
              if (existing) { existing.count++; } else { acc.push({ recipeId: slot.meal.recipeId, recipeTitle: slot.meal.recipeTitle, count: 1 }); }
              return acc;
            }, [])
          : [];
        const cookSummaryLabel = cookSummary.length === 1 ? "recept" : "recepten";
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
                <span className={styles.todayTag}>{selectedDayLabel(selectedDow, todayDow)}</span>
                <span className={styles.todayDate}>{DAY_FULL[selectedDow - 1]}, {fmtDate(selectedSlot?.iso ?? today)}</span>
                {plan.mealTypes.length > 0 && (
                  <span className={styles.todayMealType}>
                    {plan.mealTypes.map(t => MEAL_TYPE_NL[t] ?? t).join(" · ")}
                  </span>
                )}
              </div>

              {selectedMeal ? (
                <button
                  className={styles.todayRecipeBtn}
                  onClick={() => openRecipe(selectedMeal.recipeId)}
                >
                  <div className={styles.todayRecipeInner}>
                    <span className={styles.todayRecipeName}>{selectedMeal.recipeTitle}</span>
                    {selectedMeal.kcal > 0 && (
                      <span className={styles.todayRecipeMacros}>
                        {selectedMeal.kcal} kcal{selectedMeal.protein > 0 ? ` · ${selectedMeal.protein}g eiwit` : ""}
                      </span>
                    )}
                  </div>
                  <span className={styles.todayChevronWrap}>
                    <IoChevronForward size={16} />
                  </span>
                </button>
              ) : (
                <p className={styles.todayEmpty}>Geen maaltijd gepland.</p>
              )}
            </div>

            {/* â”€â”€â”€ Week strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className={styles.weekSection}>
              <span className={styles.weekTitle}>Deze week</span>
              <div className={styles.weekStrip}>
                {slots.map(slot => {
                  const isToday    = slot.day === todayDow;
                  const isSelected = slot.day === selectedDow;
                  const hasMeal    = slot.meal !== null;
                  return (
                    <button
                      key={slot.day}
                      className={[
                        styles.weekBtn,
                        isToday ? styles.weekBtnToday : "",
                        isSelected && !isToday ? styles.weekBtnSelected : "",
                        !hasMeal ? styles.weekBtnEmpty : "",
                      ].join(" ")}
                      onClick={() => { if (hasMeal) setSelectedDow(slot.day); }}
                      disabled={!hasMeal}
                    >
                      <span className={styles.weekBtnDay}>{slot.label}</span>
                      <span className={styles.weekBtnNum}>{slot.date.getDate()}</span>
                      {slot.day === plan.cookDay && (
                        <IoRestaurantOutline size={10} style={ACCENT_STYLE} />
                      )}
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

            {/* â”€â”€â”€ Cook summary (only on cook day) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {isCookDay && (
              <div className={styles.cookSummaryCard}>
                <div className={styles.cookSummaryHeader}>
                  <IoRestaurantOutline size={15} style={ACCENT_STYLE} />
                  <span className={styles.cookSummaryTitle}>Vandaag bereiden</span>
                  <span className={styles.cookSummaryCount}>{cookSummary.length} {cookSummaryLabel}</span>
                </div>
                <div className={styles.cookSummaryList}>
                  {cookSummary.map((item) => (
                    <button key={item.recipeId} className={styles.cookSummaryRow} onClick={() => openRecipe(item.recipeId)}>
                      <span className={styles.cookSummaryRecipe}>{item.recipeTitle}</span>
                      <span className={styles.cookSummaryPills}>{item.count}x deze week</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* â”€â”€â”€ Plan actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {!confirmDelete ? (
              <div className={styles.actionsRow}>
                <button className={styles.completeBtn} onClick={doComplete} disabled={completing}>
                  <IoCheckmarkCircle size={15} />
                  {completing ? "Bezig…" : "Voltooien"}
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
                    {deleting ? "Bezig…" : "Ja, verwijder"}
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

      {detailRecipe && (
        <RecipeDetailModal recipe={detailRecipe} onClose={() => setDetailRecipe(null)} />
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

"use client";

import { useState } from "react";
import { IoAdd, IoCheckmarkCircle, IoTrashOutline, IoInformationCircleOutline } from "react-icons/io5";
import { useUser } from "../context/UserContext";
import { completeMealPrepPlan, deleteMealPrepPlan } from "../firebase/mealPrepService";
import type { MealPrepPlan, PrepMeal } from "../types/mealPrep";
import PlanSetupModal from "../components/mealprep/PlanSetupModal";
import HelpOverlay from "../components/HelpOverlay";
import styles from "./MealPrepScreen.module.css";

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MONTH_LABELS_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MEAL_TYPE_LABELS: Record<string, string> = { breakfast: "Ontbijt", lunch: "Lunch", dinner: "Avondeten" };

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA); const b = new Date(isoB);
  a.setHours(0,0,0,0); b.setHours(0,0,0,0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function todayIso(): string { return new Date().toISOString().split("T")[0]; }
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_LABELS_NL[d.getMonth()]}`;
}
function freqLabel(plan: MealPrepPlan): string {
  if (plan.cookFrequency === "weekly") return "Wekelijks";
  if (plan.cookFrequency === "biweekly") return "Om de 2 weken";
  return `Elke ${plan.cookFrequencyDays ?? "?"} dagen`;
}
function cookDayLabel(cookDay: number): string {
  return ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"][cookDay - 1] ?? "?";
}

function getMealForDay(meals: PrepMeal[], isoWeekday: number): PrepMeal | null {
  for (const meal of meals) {
    if (meal.pattern === "daily") return meal;
    if (meal.pattern === "manual" && meal.manualDays?.includes(isoWeekday)) return meal;
  }
  return null;
}

function buildWeekSlots(plan: MealPrepPlan): { day: number; label: string; isoDate: string; meal: PrepMeal | null }[] {
  const mealA = plan.meals.find((m) => m.pattern === "alternateA") ?? null;
  const mealB = plan.meals.find((m) => m.pattern === "alternateB") ?? null;
  const hasAlternating = mealA !== null || mealB !== null;
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayDow);
  monday.setHours(0,0,0,0);

  return Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const isoDate = date.toISOString().split("T")[0];
    const nonAlt = plan.meals.filter((m) => m.pattern !== "alternateA" && m.pattern !== "alternateB");
    const directMeal = getMealForDay(nonAlt, day);
    if (directMeal) return { day, label: DAY_LABELS[i], isoDate, meal: directMeal };
    if (hasAlternating) {
      const diff = daysBetween(plan.startDate, isoDate);
      return { day, label: DAY_LABELS[i], isoDate, meal: diff % 2 === 0 ? mealA : mealB };
    }
    return { day, label: DAY_LABELS[i], isoDate, meal: null };
  });
}

export default function MealPrepScreen() {
  const { authUser, mealPrepPlan, helpModeEnabled } = useUser();
  const [setupOpen, setSetupOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const plan = mealPrepPlan;
  const isActive = plan?.status === "active";
  const today = todayIso();
  const todayIsoWeekday = ((new Date().getDay() + 6) % 7) + 1;

  const daysLeft = plan?.endDate ? daysBetween(today, plan.endDate) : null;
  const showReminder = isActive && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;

  const weekSlots = isActive ? buildWeekSlots(plan!) : [];
  const selectedSlot = selectedDay != null ? weekSlots.find((s) => s.day === selectedDay) ?? null : null;

  const handleComplete = async () => {
    if (!authUser) return;
    setCompleting(true);
    try { await completeMealPrepPlan(authUser.uid); } finally { setCompleting(false); }
  };

  const handleDelete = async () => {
    if (!authUser) return;
    setDeleting(true);
    try { await deleteMealPrepPlan(authUser.uid); setConfirmDelete(false); } finally { setDeleting(false); }
  };

  const MEALPREP_HELP_STEPS = [
    {
      title: "Plan aanmaken",
      description: (
        <>
          <p><strong>Hoe begin je?</strong><br />Tik op de + knop rechtsboven. Je doorloopt 4 stappen om je plan in te stellen.</p>
          <p><strong>Stap 1 — Maaltijdtype</strong><br />Kies voor welke maaltijden je van tevoren kookt: ontbijt, lunch of avondeten. Je kunt er meerdere kiezen.</p>
          <p><strong>Stap 2 — Planning</strong><br />Kies je kookdag (de vaste dag waarop je alles bereidt), hoe vaak je kookt (wekelijks, tweewekelijks of elke X dagen) en hoe lang het plan loopt (1–12 weken).</p>
          <p><strong>Stap 3 — Maaltijden</strong><br />Voeg recepten toe en stel per recept een eetpatroon in: elke dag hetzelfde, om de dag (Dag A / Dag B), of handmatig op specifieke weekdagen.</p>
          <p><strong>Stap 4 — Bevestigen</strong><br />Controleer je samenvatting en tik op &apos;Opslaan&apos; om het plan te activeren.</p>
        </>
      ),
    },
    {
      title: "Weekkalender",
      description: (
        <>
          <p><strong>Wat zie je?</strong><br />De kalender toont de huidige week met voor elke dag het eerste woord van het geplande recept. De dag van vandaag is oranje omrand.</p>
          <p><strong>Details bekijken</strong><br />Tik op een dag om het detailvenster te openen. Je ziet dan de volledige receptnaam, het aantal calorieën en de eiwitten voor die dag.</p>
          <p><strong>Geen recept?</strong><br />Als er voor een dag geen recept is gepland, staat er een streepje. Dat betekent dat die dag buiten je patroon valt.</p>
        </>
      ),
    },
    {
      title: "Recepten kiezen",
      description: (
        <>
          <p><strong>Ingebouwde recepten</strong><br />Je kunt kiezen uit 50 kant-en-klare Nederlandse dinerrecepten, verdeeld in categorieën: pasta, rijst, vlees, vis, vegetarisch, soep, wraps en wok. Gebruik de zoekbalk om snel te filteren.</p>
          <p><strong>Eigen recepten</strong><br />Tik op het tabblad &apos;Eigen&apos; om recepten te kiezen die je zelf hebt aangemaakt in het Voeding-scherm. Zo gebruik je jouw favoriete maaltijden in je prep plan.</p>
          <p><strong>Macros zichtbaar</strong><br />Per recept zie je direct de calorieën, het eiwitgehalte en het aantal porties. Zo kies je bewust wat bij jouw doelen past.</p>
        </>
      ),
    },
    {
      title: "Plan beheren",
      description: (
        <>
          <p><strong>Herinnering</strong><br />Als je plan nog 3 dagen of minder loopt, verschijnt er een oranje banner bovenaan met het exacte aantal dagen en je kookdag. Zo weet je tijdig wanneer je weer moet koken.</p>
          <p><strong>Plan voltooien</strong><br />Tik op &apos;Voltooien&apos; in de plankaart als je tevreden bent met het plan. Het plan wordt als afgerond gemarkeerd en je kunt daarna een nieuw plan starten.</p>
          <p><strong>Plan verwijderen</strong><br />Wil je stoppen? Tik op &apos;Verwijderen&apos; en bevestig. Het plan wordt volledig gewist. Je kunt altijd opnieuw beginnen via de + knop.</p>
        </>
      ),
    },
  ];

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Meal Prep</span>
        <button className={styles.addBtn} onClick={() => setSetupOpen(true)}>
          <IoAdd size={22} />
        </button>
      </div>

      {showReminder && (
        <div className={styles.reminderBanner}>
          <span className={styles.reminderIcon}>⚠️</span>
          <div className={styles.reminderText}>
            <span className={styles.reminderTitle}>Bijna tijd om te koken</span>
            <span className={styles.reminderSub}>
              Loopt over {daysLeft} dag{daysLeft === 1 ? "" : "en"} af — kookdag is {cookDayLabel(plan!.cookDay)}
            </span>
          </div>
        </div>
      )}

      {isActive && plan ? (
        <>
          {/* Plan info card */}
          <div className={styles.planCard}>
            {(plan.mealTypes ?? []).length > 0 && (
              <div className={styles.planCardRow}>
                <span className={styles.planCardLabel}>Maaltijden</span>
                <span className={styles.planCardValue}>
                  {(plan.mealTypes ?? []).map((t) => MEAL_TYPE_LABELS[t] ?? t).join(", ")}
                </span>
              </div>
            )}
            <div className={styles.planCardRow}>
              <span className={styles.planCardLabel}>Kookdag</span>
              <span className={styles.planCardValue}>{cookDayLabel(plan.cookDay)}</span>
            </div>
            <div className={styles.planCardRow}>
              <span className={styles.planCardLabel}>Frequentie</span>
              <span className={styles.planCardValue}>{freqLabel(plan)}</span>
            </div>
            <div className={styles.planCardRow}>
              <span className={styles.planCardLabel}>Duur</span>
              <span className={styles.planCardValue}>{plan.timeSpanWeeks} {plan.timeSpanWeeks !== 1 ? "weken" : "week"}</span>
            </div>
            <div className={styles.planCardRow}>
              <span className={styles.planCardLabel}>Loopt t/m</span>
              <span className={styles.planCardValue}>{formatShortDate(plan.endDate)}</span>
            </div>

            <div className={styles.planCardActions}>
              <button className={styles.completeBtn} onClick={handleComplete} disabled={completing}>
                <IoCheckmarkCircle size={15} />
                {completing ? "Bezig…" : "Voltooien"}
              </button>
              <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} disabled={deleting}>
                <IoTrashOutline size={15} />
                Verwijderen
              </button>
            </div>

            {confirmDelete && (
              <div className={styles.confirmDeleteRow}>
                <span className={styles.confirmDeleteText}>Weet je het zeker?</span>
                <button className={styles.confirmDeleteYes} onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Bezig…" : "Ja, verwijder"}
                </button>
                <button className={styles.confirmDeleteNo} onClick={() => setConfirmDelete(false)}>
                  Annuleer
                </button>
              </div>
            )}
          </div>

          {/* Week calendar */}
          <div className={styles.weekCard}>
            <div className={styles.weekCardTitle}>Deze week</div>
            <div className={styles.weekRow}>
              {weekSlots.map((slot) => (
                <button
                  key={slot.day}
                  className={`${styles.weekDay} ${slot.day === todayIsoWeekday ? styles.weekDayToday : ""} ${selectedDay === slot.day ? styles.weekDaySelected : ""}`}
                  onClick={() => setSelectedDay(selectedDay === slot.day ? null : slot.day)}
                >
                  <span className={styles.weekDayLabel}>{slot.label}</span>
                  <span className={styles.weekDayMeal}>
                    {slot.meal ? slot.meal.recipeTitle.split(" ")[0] : "—"}
                  </span>
                </button>
              ))}
            </div>

            {selectedSlot && (
              <div className={styles.dayDetail}>
                <div className={styles.dayDetailTitle}>
                  {["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"][selectedSlot.day - 1]}
                </div>
                {selectedSlot.meal ? (
                  <>
                    <div className={styles.dayDetailRecipe}>{selectedSlot.meal.recipeTitle}</div>
                    {selectedSlot.meal.kcal > 0 && (
                      <div className={styles.dayDetailMeta}>
                        {selectedSlot.meal.kcal} kcal
                        {selectedSlot.meal.protein > 0 && ` · ${selectedSlot.meal.protein}g eiwit`}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.dayDetailEmpty}>Geen maaltijd gepland</div>
                )}
              </div>
            )}
          </div>

          {/* Meals list */}
          <div className={styles.mealsCard}>
            <div className={styles.mealsCardTitle}>Maaltijden</div>
            {plan.meals.map((meal) => (
              <div key={meal.id} className={styles.mealRow}>
                <div className={styles.mealInfo}>
                  <span className={styles.mealTitle}>{meal.recipeTitle}</span>
                  {meal.kcal > 0 && (
                    <span className={styles.mealMeta}>{meal.kcal} kcal · {meal.protein}g eiwit</span>
                  )}
                </div>
                <span className={styles.mealPattern}>
                  {meal.pattern === "daily" ? "Elke dag"
                    : meal.pattern === "alternateA" ? "Dag A"
                    : meal.pattern === "alternateB" ? "Dag B"
                    : "Handmatig"}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : plan?.status === "completed" ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>✅</span>
          <span className={styles.emptyTitle}>Plan voltooid!</span>
          <span className={styles.emptySub}>Maak een nieuw plan via de + knop.</span>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🥗</span>
          <span className={styles.emptyTitle}>Geen actief plan</span>
          <span className={styles.emptySub}>Tik op + om je meal prep in te plannen.</span>
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
        <HelpOverlay steps={MEALPREP_HELP_STEPS} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  );
}
